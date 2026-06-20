import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

// Statuses that count as a genuine attendance attempt — the student showed
// up (verified present or queued for review). Students whose only rows are
// `rejected_location` / `rejected_identity` / `absent` are STILL considered
// absent for this session: their attempt was rejected, not approved.
const SUCCESSFUL_CHECKIN_STATUSES = new Set(['present', 'pending_review']);

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { data: sessions } = await db.from('sessions').select('*').eq('id', sessionId);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessions[0] as Record<string, unknown>;

    // Verify ownership: session must belong to the authenticated lecturer
    if (session.lecturer_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to access this session' },
        { status: 403 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Session cannot be ended. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // =====================================================================
    // TRANSACTION-LIKE FLOW: gather all data BEFORE mutating anything.
    // We compute the full absent-student list up front. Only if every read
    // succeeds do we perform the two writes (mark session completed + insert
    // absent rows). If the absent-insert fails, we attempt to roll back the
    // status update so the lecturer can retry.
    // =====================================================================

    // 1) Get session_departments for this session
    const { data: sessionDepts, error: sdError } = await db
      .from('session_departments')
      .select('*')
      .eq('session_id', sessionId);

    if (sdError) {
      return NextResponse.json(
        { success: false, error: 'Failed to read session departments' },
        { status: 500 }
      );
    }

    const deptIds = (sessionDepts || []).map((sd: Record<string, unknown>) => sd.department_id as string);

    // 2) Get all attendance rows for this session (we need the FULL row, not
    //    just the student_id, because we filter by status).
    const { data: attendances, error: attError } = await db
      .from('attendances')
      .select('student_id, status')
      .eq('session_id', sessionId);

    if (attError) {
      return NextResponse.json(
        { success: false, error: 'Failed to read attendances' },
        { status: 500 }
      );
    }

    // Students who successfully checked in (present OR pending_review).
    // Students with only rejected_* / absent rows are NOT in this set — they
    // still need to be marked absent (fixes the rejected_* fall-through bug).
    const successfulStudentIds = new Set(
      ((attendances || []) as Record<string, unknown>[])
        .filter((a) => SUCCESSFUL_CHECKIN_STATUSES.has(a.status as string))
        .map((a) => a.student_id as string)
    );

    // 3) Find all students in target departments (filtered by level) who did
    //    NOT have a successful check-in. The level filter prevents a 100-level
    //    session from marking 200/300/400/500-level students in the same
    //    department as absent.
    const sessionLevel = session.level as number | undefined;
    let absentStudents: { id: string }[] = [];
    if (deptIds.length > 0) {
      // InsForge/PostgREST does not support compound .in() + .eq() level filter
      // in a single chained call reliably across all versions, so we fetch by
      // department and filter in JS by level (defensive).
      const { data: allDeptStudents, error: studentsError } = await db
        .from('students')
        .select('id, level')
        .in('department_id', deptIds);

      if (studentsError) {
        return NextResponse.json(
          { success: false, error: 'Failed to read targeted students' },
          { status: 500 }
        );
      }

      absentStudents = ((allDeptStudents || []) as Record<string, unknown>[])
        .filter((s) => {
          // Level filter: only mark students whose level matches the session.
          // If the session has no level set, fall back to all department
          // students (defensive — should not happen in practice).
          if (sessionLevel !== undefined && sessionLevel !== null) {
            const studentLevel = typeof s.level === 'number'
              ? s.level
              : parseInt(String(s.level ?? '0'), 10);
            if (studentLevel !== sessionLevel) return false;
          }
          // Only mark absent if the student did NOT successfully check in.
          return !successfulStudentIds.has(s.id as string);
        })
        .map((s) => ({ id: s.id as string }));
    }

    // 4) INSERT absent rows FIRST (before marking session completed). If this
    //    fails, the session is still 'active' and the lecturer can retry.
    if (absentStudents.length > 0) {
      const absentInserts = absentStudents.map((student) => ({
        student_id: student.id,
        session_id: sessionId,
        status: 'absent',
      }));

      const { error: insertError } = await db.from('attendances').insert(absentInserts);

      if (insertError) {
        // If the insert failed because the rows already exist (idempotent
        // retry), continue. Otherwise abort without marking the session
        // completed so the lecturer can retry end-session.
        const msg = insertError.message || '';
        if (!msg.includes('duplicate') && !msg.includes('unique') && msg !== 'DUPLICATE') {
          return NextResponse.json(
            { success: false, error: 'Failed to record absent students. Session left active — please retry.' },
            { status: 500 }
          );
        }
      }
    }

    // 5) NOW mark the session as completed. If this fails after a successful
    //    absent-insert, the absent rows are still valid (idempotent on retry).
    const { error: updateError } = await db
      .from('sessions')
      .update({ status: 'completed' })
      .eq('id', sessionId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Absent students recorded but failed to mark session completed. Please retry.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: sessionId,
        status: 'completed',
        absentStudentsCreated: absentStudents.length,
        totalSuccessfulCheckIns: successfulStudentIds.size,
        totalAttendances: successfulStudentIds.size + absentStudents.length,
      },
    });
  } catch (error) {
    console.error('End session error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
