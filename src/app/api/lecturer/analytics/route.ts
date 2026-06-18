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

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get session with related data
    const { data: sessions, error: sessionError } = await db
      .from('sessions')
      .select('*')
      .eq('id', sessionId);

    if (sessionError || !sessions || sessions.length === 0) {
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

    // Fetch related data in parallel
    const [
      courseResult,
      venueResult,
      lecturerResult,
      sessionDeptsResult,
      attendancesResult,
    ] = await Promise.all([
      db.from('courses').select('id, name, code').eq('id', session.course_id as string),
      db.from('venues').select('id, name').eq('id', session.venue_id as string),
      db.from('lecturers').select('id, name').eq('id', session.lecturer_id as string),
      db.from('session_departments').select('*').eq('session_id', sessionId),
      db.from('attendances').select('*').eq('session_id', sessionId),
    ]);

    // Manually join departments for session_departments
    const sdDeptIds = (sessionDeptsResult.data || []).map((d: Record<string, unknown>) => d.department_id as string).filter(Boolean);
    const uniqueSdDeptIds = [...new Set(sdDeptIds)];
    let sdDeptMap = new Map<string, Record<string, unknown>>();
    if (uniqueSdDeptIds.length > 0) {
      const { data: sdDepts } = await db.from('departments').select('id, name, code').in('id', uniqueSdDeptIds);
      for (const d of sdDepts || []) {
        sdDeptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Manually join students for attendances
    const attStudentIds = (attendancesResult.data || []).map((a: Record<string, unknown>) => a.student_id as string).filter(Boolean);
    const uniqueAttStudentIds = [...new Set(attStudentIds)];
    let attStudentMap = new Map<string, Record<string, unknown>>();
    if (uniqueAttStudentIds.length > 0) {
      const { data: attStudents } = await db.from('students').select('id, name, matric_number, department_id').in('id', uniqueAttStudentIds);
      for (const s of attStudents || []) {
        attStudentMap.set((s as Record<string, unknown>).id as string, s as Record<string, unknown>);
      }
    }

    const course = courseResult.data?.[0] as Record<string, unknown> | undefined;
    const venue = venueResult.data?.[0] as Record<string, unknown> | undefined;
    const lecturer = lecturerResult.data?.[0] as Record<string, unknown> | undefined;

    const deptLinks = (sessionDeptsResult.data || []).map((d: Record<string, unknown>) => ({
      ...d,
      departments: sdDeptMap.get(d.department_id as string) || null,
    })) as Record<string, unknown>[];
    const attendances = (attendancesResult.data || []).map((a: Record<string, unknown>) => ({
      ...a,
      students: attStudentMap.get(a.student_id as string) || null,
    })) as Record<string, unknown>[];

    // Get department IDs for counting target students
    const deptIds = deptLinks.map((d: Record<string, unknown>) => {
      const dept = d.departments as Record<string, unknown>;
      return dept?.id || (d.department_id as string);
    });

    // Count total target students
    let totalTargetStudents = 0;
    if (deptIds.length > 0) {
      const { data: targetStudents } = await db
        .from('students')
        .select('id')
        .in('department_id', deptIds);
      totalTargetStudents = targetStudents?.length || 0;
    }

    // Need department info for students in attendances
    const studentDeptIds = attendances.map((a: Record<string, unknown>) => {
      const student = a.students as Record<string, unknown>;
      return student?.department_id;
    }).filter(Boolean) as string[];

    let departmentMap = new Map<string, Record<string, unknown>>();
    if (studentDeptIds.length > 0) {
      const uniqueDeptIds = [...new Set(studentDeptIds)];
      const { data: depts } = await db.from('departments').select('*').in('id', uniqueDeptIds);
      for (const d of depts || []) {
        departmentMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Calculate attendance stats
    const presentCount = attendances.filter((a: Record<string, unknown>) => a.status === 'present').length;
    const absentCount = attendances.filter((a: Record<string, unknown>) => a.status === 'absent').length;
    const pendingCount = attendances.filter(
      (a: Record<string, unknown>) => a.status === 'pending_review' || a.status === 'pending'
    ).length;
    const rejectedLocationCount = attendances.filter(
      (a: Record<string, unknown>) => a.status === 'rejected_location'
    ).length;
    const rejectedIdentityCount = attendances.filter(
      (a: Record<string, unknown>) => a.status === 'rejected_identity'
    ).length;
    const rejectedCount = rejectedLocationCount + rejectedIdentityCount;

    // Late arrivals: checked in after session endsAt
    const sessionEnd = session.ends_at
      ? new Date(session.ends_at as string)
      : session.started_at
        ? new Date(new Date(session.started_at as string).getTime() + (session.duration_minutes as number) * 60000)
        : null;

    const lateCount = sessionEnd
      ? attendances.filter(
          (a: Record<string, unknown>) =>
            a.status === 'present' &&
            a.check_in_time &&
            new Date(a.check_in_time as string) > sessionEnd
        ).length
      : 0;

    // Detailed attendance list
    const attendanceList = attendances.map((a: Record<string, unknown>) => {
      const student = a.students as Record<string, unknown>;
      const studentDept = departmentMap.get(student?.department_id as string);
      return {
        id: a.id,
        studentId: a.student_id,
        studentName: student?.name,
        matricNumber: student?.matric_number,
        departmentName: studentDept?.name,
        sessionId: a.session_id,
        status: a.status,
        similarityScore: a.similarity_score,
        checkInTime: a.check_in_time,
        studentLat: a.student_lat,
        studentLng: a.student_lng,
      };
    });

    // Absent students
    const absentStudents = attendances
      .filter((a: Record<string, unknown>) => a.status === 'absent')
      .map((a: Record<string, unknown>) => {
        const student = a.students as Record<string, unknown>;
        const studentDept = departmentMap.get(student?.department_id as string);
        return {
          id: a.student_id,
          name: student?.name,
          matricNumber: student?.matric_number,
          departmentName: studentDept?.name,
        };
      });

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          courseName: course?.name,
          courseCode: course?.code,
          venueName: venue?.name,
          lecturerName: lecturer?.name,
          level: session.level,
          distanceThreshold: session.distance_threshold,
          durationMinutes: session.duration_minutes,
          scheduledAt: session.scheduled_at,
          startedAt: session.started_at,
          endsAt: session.ends_at,
          status: session.status,
          departments: deptLinks.map((d: Record<string, unknown>) => {
            const dept = d.departments as Record<string, unknown>;
            return {
              id: dept?.id,
              name: dept?.name,
              code: dept?.code,
            };
          }),
        },
        totalTargetStudents,
        presentCount,
        absentCount,
        pendingCount,
        rejectedCount,
        rejectedLocationCount,
        rejectedIdentityCount,
        lateCount,
        attendances: attendanceList,
        absentStudents,
      },
    });
  } catch (error) {
    console.error('Get session analytics error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
