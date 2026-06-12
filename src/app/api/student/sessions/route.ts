import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Get student
    const { data: students, error: studentError } = await db
      .from('students')
      .select('*')
      .eq('id', studentId);

    if (studentError || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    // Find all session_departments targeting this student's department
    const { data: sessionDepts, error: sdError } = await db
      .from('session_departments')
      .select('*')
      .eq('department_id', student.department_id as string);

    if (sdError) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!sessionDepts || sessionDepts.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Get unique session IDs
    const sessionIds = [...new Set(
      (sessionDepts || []).map((sd: Record<string, unknown>) => sd.session_id as string).filter(Boolean)
    )];

    if (sessionIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch sessions
    const { data: sessions } = await db
      .from('sessions')
      .select('*')
      .in('id', sessionIds);

    // Get attendance records for this student
    const { data: attendances } = await db
      .from('attendances')
      .select('*')
      .eq('student_id', studentId);

    const attendanceMap = new Map(
      (attendances || []).map((a: Record<string, unknown>) => [a.session_id, a])
    );

    // Fetch related data
    const courseIds = [...new Set((sessions || []).map((s: Record<string, unknown>) => s.course_id as string).filter(Boolean))];
    const venueIds = [...new Set((sessions || []).map((s: Record<string, unknown>) => s.venue_id as string).filter(Boolean))];

    const [coursesResult, venuesResult] = await Promise.all([
      courseIds.length > 0 ? db.from('courses').select('*').in('id', courseIds) : { data: [] },
      venueIds.length > 0 ? db.from('venues').select('*').in('id', venueIds) : { data: [] },
    ]);

    const courseMap = new Map(
      (coursesResult.data || []).map((c: Record<string, unknown>) => [c.id, c])
    );
    const venueMap = new Map(
      (venuesResult.data || []).map((v: Record<string, unknown>) => [v.id, v])
    );

    // Get all session_departments for these sessions (to show full dept list)
    const { data: allSessionDepts } = await db
      .from('session_departments')
      .select('*')
      .in('session_id', sessionIds);

    // Fetch departments for all session_departments
    const allDeptIds = [...new Set((allSessionDepts || []).map((sd: Record<string, unknown>) => sd.department_id as string).filter(Boolean))];
    const allDeptMap = new Map<string, Record<string, unknown>>();

    if (allDeptIds.length > 0) {
      const { data: depts } = await db
        .from('departments')
        .select('id, name, code')
        .in('id', allDeptIds);
      for (const d of depts || []) {
        allDeptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    const sessionDeptMap = new Map<string, Record<string, unknown>[]>();
    for (const sd of allSessionDepts || []) {
      const rec = sd as Record<string, unknown>;
      const sid = rec.session_id as string;
      if (!sessionDeptMap.has(sid)) sessionDeptMap.set(sid, []);
      sessionDeptMap.get(sid)!.push(rec);
    }

    // Build sessions response
    const result = (sessions || [])
      .map((session: Record<string, unknown>) => {
        const attendance = attendanceMap.get(session.id as string) as Record<string, unknown> | undefined;
        const course = courseMap.get(session.course_id as string) as Record<string, unknown> | undefined;
        const venue = venueMap.get(session.venue_id as string) as Record<string, unknown> | undefined;
        const deptLinks = sessionDeptMap.get(session.id as string) || [];

        return {
          id: session.id,
          title: session.title,
          courseId: session.course_id,
          courseName: course?.name,
          courseCode: course?.code,
          venueId: session.venue_id,
          venueName: venue?.name,
          lecturerId: session.lecturer_id,
          level: typeof session.level === 'number' ? session.level : (typeof session.level === 'string' ? parseInt(session.level as string, 10) || 0 : 0),
          distanceThreshold: session.distance_threshold,
          durationMinutes: session.duration_minutes,
          scheduledAt: session.scheduled_at,
          startedAt: session.started_at,
          endsAt: session.ends_at,
          status: session.status,
          lecturerLat: session.lecturer_lat,
          lecturerLng: session.lecturer_lng,
          departments: deptLinks.map((d: Record<string, unknown>) => {
            const dept = allDeptMap.get(d.department_id as string);
            return {
              id: d.department_id as string,
              name: dept?.name || '',
              code: dept?.code || '',
            };
          }),
          attendance: attendance
            ? {
                id: attendance.id,
                status: attendance.status,
                similarityScore: attendance.similarity_score,
                checkInTime: attendance.check_in_time,
              }
            : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Get student sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
