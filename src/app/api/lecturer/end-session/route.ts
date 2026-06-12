import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function POST(request: NextRequest) {
  try {
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

    if (session.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Session cannot be ended. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // Update session status
    await db.from('sessions').update({ status: 'completed' }).eq('id', sessionId);

    // Get session_departments for this session
    const { data: sessionDepts } = await db
      .from('session_departments')
      .select('*')
      .eq('session_id', sessionId);

    const deptIds = (sessionDepts || []).map((sd: Record<string, unknown>) => sd.department_id as string);

    // Get attendances for this session
    const { data: attendances } = await db
      .from('attendances')
      .select('student_id')
      .eq('session_id', sessionId);

    const attendedStudentIds = (attendances || []).map((a: Record<string, unknown>) => a.student_id as string);

    // Find all students in target departments without attendance records
    let absentStudents: Record<string, unknown>[] = [];
    if (deptIds.length > 0) {
      let studentQuery = db.from('students').select('*').in('department_id', deptIds);
      const { data: allDeptStudents } = await studentQuery;

      absentStudents = ((allDeptStudents || []) as Record<string, unknown>[]).filter(
        (s: Record<string, unknown>) => !attendedStudentIds.includes(s.id as string)
      );
    }

    // Create absent attendance records for students who haven't checked in
    if (absentStudents.length > 0) {
      const absentInserts = absentStudents.map((student) => ({
        student_id: student.id,
        session_id: sessionId,
        status: 'absent',
      }));

      await db.from('attendances').insert(absentInserts);
    }

    return NextResponse.json({
      success: true,
      data: {
        id: sessionId,
        status: 'completed',
        absentStudentsCreated: absentStudents.length,
        totalAttendances: attendedStudentIds.length + absentStudents.length,
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
