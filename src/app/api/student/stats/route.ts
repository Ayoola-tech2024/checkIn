import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // SECURITY: Use the authenticated student's ID, not a client-supplied one.
    const studentId = auth.userId;

    // Get all attendance records for this student
    const { data: attendances } = await db.from('attendances').select('*').eq('student_id', studentId);

    let totalPresent = 0;
    let totalAbsent = 0;
    let totalPending = 0;
    let totalRejected = 0;

    for (const a of attendances || []) {
      const rec = a as Record<string, unknown>;
      const status = rec.status as string;
      if (status === 'present') totalPresent++;
      else if (status === 'absent') totalAbsent++;
      else if (status === 'pending_review' || status === 'pending') totalPending++;
      else if (status === 'rejected_location' || status === 'rejected_identity') totalRejected++;
    }

    const totalSessions = (attendances || []).length;
    const attendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

    // Get upcoming sessions for the student's department
    const { data: student } = await db.from('students').select('department_id').eq('id', studentId);
    const departmentId = (student?.[0] as Record<string, unknown>)?.department_id as string;

    let upcomingSessions = 0;
    if (departmentId) {
      const { data: sessionDepts } = await db.from('session_departments').select('session_id').eq('department_id', departmentId);
      const deptSessionIds = (sessionDepts || []).map((sd: Record<string, unknown>) => sd.session_id as string);
      if (deptSessionIds.length > 0) {
        const { data: scheduledSessions } = await db.from('sessions').select('id').in('id', deptSessionIds).eq('status', 'scheduled');
        upcomingSessions = scheduledSessions?.length || 0;
      }
    }

    // Recent attendance (last 5)
    const recentAttendance = await Promise.all(
      ((attendances || []) as Record<string, unknown>[])
        .filter((a: Record<string, unknown>) => a.check_in_time)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          new Date(b.check_in_time as string).getTime() - new Date(a.check_in_time as string).getTime()
        )
        .slice(0, 5)
        .map(async (a: Record<string, unknown>) => {
          const sessionId = a.session_id as string;
          const { data: session } = await db.from('sessions').select('id, title, scheduled_at').eq('id', sessionId);
          const sessionData = session?.[0] as Record<string, unknown> | undefined;

          let courseName = '';
          if (sessionData?.course_id) {
            const { data: course } = await db.from('courses').select('name, code').eq('id', sessionData.course_id as string);
            courseName = (course?.[0] as Record<string, unknown>)?.name as string || '';
          }

          return {
            id: a.id,
            sessionId,
            sessionTitle: sessionData?.title || 'Unknown',
            courseName,
            status: a.status,
            similarityScore: a.similarity_score,
            checkInTime: a.check_in_time,
            scheduledAt: sessionData?.scheduled_at,
          };
        })
    );

    return NextResponse.json({
      success: true,
      data: {
        totalSessions,
        totalPresent,
        totalAbsent,
        totalPending,
        totalRejected,
        attendanceRate,
        upcomingSessions,
        recentAttendance,
      },
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
