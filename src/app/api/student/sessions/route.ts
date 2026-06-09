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

    const { data: students, error: studentError } = await db
      .from('students')
      .select('*, departments(*)')
      .eq('id', studentId);

    if (studentError || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;
    const studentDepartment = student.departments as Record<string, unknown> | null;

    // Find all session_departments targeting this student's department
    const { data: sessionDepts, error: sdError } = await db
      .from('session_departments')
      .select('*, sessions(*), departments(*)')
      .eq('department_id', student.department_id as string);

    if (sdError) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Get attendance records for this student
    const { data: attendances } = await db
      .from('attendances')
      .select('*')
      .eq('student_id', studentId);

    const attendanceMap = new Map(
      (attendances || []).map((a: Record<string, unknown>) => [a.session_id, a])
    );

    // Get all unique session IDs from session_departments
    const sessionIds = (sessionDepts || []).map(
      (sd: Record<string, unknown>) => (sd.sessions as Record<string, unknown>)?.id
    ).filter(Boolean) as string[];

    // Fetch related data for sessions
    const [coursesResult, venuesResult, lecturersResult] = await Promise.all([
      sessionIds.length > 0
        ? db.from('courses').select('*').in('id', (sessionDepts || []).map((sd: Record<string, unknown>) => ((sd.sessions as Record<string, unknown>)?.course_id)).filter(Boolean))
        : { data: [] },
      sessionIds.length > 0
        ? db.from('venues').select('*').in('id', (sessionDepts || []).map((sd: Record<string, unknown>) => ((sd.sessions as Record<string, unknown>)?.venue_id)).filter(Boolean))
        : { data: [] },
      sessionIds.length > 0
        ? db.from('lecturers').select('*').in('id', (sessionDepts || []).map((sd: Record<string, unknown>) => ((sd.sessions as Record<string, unknown>)?.lecturer_id)).filter(Boolean))
        : { data: [] },
    ]);

    const courseMap = new Map(
      (coursesResult.data || []).map((c: Record<string, unknown>) => [c.id, c])
    );
    const venueMap = new Map(
      (venuesResult.data || []).map((v: Record<string, unknown>) => [v.id, v])
    );
    const lecturerMap = new Map(
      (lecturersResult.data || []).map((l: Record<string, unknown>) => [l.id, l])
    );

    // For each session, also get its department links
    const { data: allSessionDepts } = sessionIds.length > 0
      ? await db.from('session_departments').select('*, departments(id, name, code)').in('session_id', sessionIds)
      : { data: [] };

    const sessionDeptMap = new Map<string, Record<string, unknown>[]>();
    for (const sd of allSessionDepts || []) {
      const rec = sd as Record<string, unknown>;
      const sid = rec.session_id as string;
      if (!sessionDeptMap.has(sid)) sessionDeptMap.set(sid, []);
      sessionDeptMap.get(sid)!.push(rec);
    }

    // Build sessions response
    const sessions = (sessionDepts || [])
      .map((sd: Record<string, unknown>) => {
        const session = sd.sessions as Record<string, unknown>;
        if (!session) return null;
        const attendance = attendanceMap.get(session.id as string) as Record<string, unknown> | undefined;
        const course = courseMap.get(session.course_id as string) as Record<string, unknown> | undefined;
        const venue = venueMap.get(session.venue_id as string) as Record<string, unknown> | undefined;
        const lecturer = lecturerMap.get(session.lecturer_id as string) as Record<string, unknown> | undefined;
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
          lecturerName: lecturer?.name,
          level: session.level,
          distanceThreshold: session.distance_threshold,
          durationMinutes: session.duration_minutes,
          scheduledAt: session.scheduled_at,
          startedAt: session.started_at,
          endsAt: session.ends_at,
          status: session.status,
          lecturerLat: session.lecturer_lat,
          lecturerLng: session.lecturer_lng,
          departments: deptLinks.map((d: Record<string, unknown>) => {
            const dept = d.departments as Record<string, unknown>;
            return {
              id: dept?.id,
              name: dept?.name,
              code: dept?.code,
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

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get student sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
