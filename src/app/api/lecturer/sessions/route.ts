import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');

    if (!lecturerId) {
      return NextResponse.json(
        { success: false, error: 'Lecturer ID is required' },
        { status: 400 }
      );
    }

    // Fetch sessions for this lecturer
    const { data: sessions, error } = await db
      .from('sessions')
      .select('*')
      .eq('lecturer_id', lecturerId)
      .order('scheduled_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const sessionIds = sessions.map((s: Record<string, unknown>) => s.id as string);

    // Fetch related data in parallel using manual joins
    const courseIds = [...new Set(sessions.map((s: Record<string, unknown>) => s.course_id as string).filter(Boolean))];
    const venueIds = [...new Set(sessions.map((s: Record<string, unknown>) => s.venue_id as string).filter(Boolean))];

    const [coursesResult, venuesResult, sessionDeptsResult, attendancesResult] = await Promise.all([
      courseIds.length > 0 ? db.from('courses').select('id, name, code, level').in('id', courseIds) : { data: [] },
      venueIds.length > 0 ? db.from('venues').select('id, name').in('id', venueIds) : { data: [] },
      db.from('session_departments').select('*').in('session_id', sessionIds),
      db.from('attendances').select('id, session_id, status').in('session_id', sessionIds),
    ]);

    const courseMap = new Map(
      (coursesResult.data || []).map((c: Record<string, unknown>) => [c.id, c])
    );
    const venueMap = new Map(
      (venuesResult.data || []).map((v: Record<string, unknown>) => [v.id, v])
    );

    // Fetch department details for session_departments
    const deptIds = [...new Set((sessionDeptsResult.data || []).map((sd: Record<string, unknown>) => sd.department_id as string).filter(Boolean))];
    const deptMap = new Map<string, Record<string, unknown>>();

    if (deptIds.length > 0) {
      const { data: depts } = await db
        .from('departments')
        .select('id, name, code')
        .in('id', deptIds);
      for (const d of depts || []) {
        deptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Build session_departments map
    const sessionDeptMap = new Map<string, Record<string, unknown>[]>();
    for (const sd of sessionDeptsResult.data || []) {
      const rec = sd as Record<string, unknown>;
      const sid = rec.session_id as string;
      if (!sessionDeptMap.has(sid)) sessionDeptMap.set(sid, []);
      sessionDeptMap.get(sid)!.push(rec);
    }

    // Build attendance counts map
    const attendanceCountMap = new Map<string, Record<string, number>>();
    const totalAttendanceMap = new Map<string, number>();
    for (const a of attendancesResult.data || []) {
      const rec = a as Record<string, unknown>;
      const sid = rec.session_id as string;
      const status = rec.status as string;
      if (!attendanceCountMap.has(sid)) attendanceCountMap.set(sid, {});
      const counts = attendanceCountMap.get(sid)!;
      counts[status] = (counts[status] || 0) + 1;
      totalAttendanceMap.set(sid, (totalAttendanceMap.get(sid) || 0) + 1);
    }

    // Count target students per session
    const data = await Promise.all(
      sessions.map(async (session: Record<string, unknown>) => {
        const deptLinks = sessionDeptMap.get(session.id as string) || [];
        const deptIdsForSession = deptLinks.map((d: Record<string, unknown>) => d.department_id as string);

        let totalTargetStudents = 0;
        if (deptIdsForSession.length > 0) {
          const { data: targetStudents } = await db
            .from('students')
            .select('id')
            .in('department_id', deptIdsForSession);
          totalTargetStudents = targetStudents?.length || 0;
        }

        const course = courseMap.get(session.course_id as string) as Record<string, unknown> | undefined;
        const venue = venueMap.get(session.venue_id as string) as Record<string, unknown> | undefined;

        return {
          id: session.id,
          title: session.title,
          courseId: session.course_id,
          courseName: course?.name,
          courseCode: course?.code,
          venueId: session.venue_id,
          venueName: venue?.name,
          lecturerId: session.lecturer_id,
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
            const dept = deptMap.get(d.department_id as string);
            return {
              id: d.department_id as string,
              name: dept?.name || '',
              code: dept?.code || '',
            };
          }),
          attendanceCounts: attendanceCountMap.get(session.id as string) || {},
          totalAttendances: totalAttendanceMap.get(session.id as string) || 0,
          totalTargetStudents,
        };
      })
    );

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get lecturer sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      title,
      courseId,
      venueId,
      lecturerId,
      level,
      departmentIds,
      distanceThreshold,
      durationMinutes,
      scheduledAt,
    } = await request.json();

    if (!title || !courseId || !venueId || !lecturerId || !level || !departmentIds || !Array.isArray(departmentIds) || !scheduledAt) {
      return NextResponse.json(
        { success: false, error: 'Title, courseId, venueId, lecturerId, level, departmentIds, and scheduledAt are required' },
        { status: 400 }
      );
    }

    const scheduledDate = new Date(scheduledAt);
    const duration = durationMinutes || 15;
    const threshold = distanceThreshold || 50;
    const sessionEnd = new Date(scheduledDate.getTime() + duration * 60000);

    // ===== VALIDATION: Venue concurrency guardrail =====
    const { data: venueSessions } = await db
      .from('sessions')
      .select('*')
      .eq('venue_id', venueId);

    // Filter for actual time overlap with scheduled or active sessions
    const venueConflicts = (venueSessions || []).filter((s: Record<string, unknown>) => {
      if (s.status !== 'scheduled' && s.status !== 'active') return false;
      const existingStart = new Date(s.scheduled_at as string);
      const existingEnd = new Date(existingStart.getTime() + (s.duration_minutes as number) * 60000);
      return existingEnd > scheduledDate && existingStart < sessionEnd;
    });

    if (venueConflicts.length > 0) {
      const conflictCourseIds = venueConflicts.map((s: Record<string, unknown>) => s.course_id as string).filter(Boolean);
      const conflictCourses = conflictCourseIds.length > 0
        ? await db.from('courses').select('id, name, code').in('id', conflictCourseIds)
        : { data: [] };

      const courseMap = new Map(
        (conflictCourses.data || []).map((c: Record<string, unknown>) => [c.id, c])
      );

      return NextResponse.json(
        {
          success: false,
          error: 'Venue is already booked for the requested time window',
          data: {
            conflicts: venueConflicts.map((s: Record<string, unknown>) => {
              const course = courseMap.get(s.course_id as string) as Record<string, unknown> | undefined;
              return {
                id: s.id,
                title: s.title,
                courseName: course?.name,
                scheduledAt: s.scheduled_at,
                durationMinutes: s.duration_minutes,
              };
            }),
          },
        },
        { status: 409 }
      );
    }

    // ===== VALIDATION: Department concurrency guardrail =====
    const { data: deptSessionLinks } = await db
      .from('session_departments')
      .select('*')
      .in('department_id', departmentIds);

    // Filter for sessions that overlap
    const deptConflictSessionIds = [...new Set(
      (deptSessionLinks || []).map((dsl: Record<string, unknown>) => dsl.session_id as string).filter(Boolean)
    )];

    const deptConflicts: Record<string, unknown>[] = [];
    const seenSessionIds = new Set<string>();

    if (deptConflictSessionIds.length > 0) {
      const { data: conflictSessions } = await db
        .from('sessions')
        .select('*')
        .in('id', deptConflictSessionIds);

      for (const session of conflictSessions || []) {
        const s = session as Record<string, unknown>;
        if (s.status !== 'scheduled' && s.status !== 'active') continue;
        if (seenSessionIds.has(s.id as string)) continue;

        const existingStart = new Date(s.scheduled_at as string);
        const existingEnd = new Date(existingStart.getTime() + (s.duration_minutes as number) * 60000);
        if (existingEnd > scheduledDate && existingStart < sessionEnd) {
          seenSessionIds.add(s.id as string);
          deptConflicts.push(s);
        }
      }
    }

    if (deptConflicts.length > 0) {
      const conflictCourseIds = deptConflicts.map((s: Record<string, unknown>) => s.course_id as string).filter(Boolean);
      const conflictCourses = conflictCourseIds.length > 0
        ? await db.from('courses').select('id, name, code').in('id', conflictCourseIds)
        : { data: [] };

      // Get all session_departments for conflict sessions
      const conflictSessionIds = deptConflicts.map((s: Record<string, unknown>) => s.id as string);
      const { data: conflictSessionDepts } = conflictSessionIds.length > 0
        ? await db.from('session_departments').select('*').in('session_id', conflictSessionIds)
        : { data: [] };

      // Fetch department names
      const conflictDeptIds = [...new Set((conflictSessionDepts || []).map((csd: Record<string, unknown>) => csd.department_id as string).filter(Boolean))];
      const conflictDeptMap = new Map<string, string>();
      if (conflictDeptIds.length > 0) {
        const { data: conflictDepts } = await db.from('departments').select('id, name').in('id', conflictDeptIds);
        for (const d of conflictDepts || []) {
          conflictDeptMap.set((d as Record<string, unknown>).id as string, (d as Record<string, unknown>).name as string);
        }
      }

      const courseMap = new Map(
        (conflictCourses.data || []).map((c: Record<string, unknown>) => [c.id, c])
      );

      return NextResponse.json(
        {
          success: false,
          error: 'One or more departments are already booked for the requested time window',
          data: {
            conflicts: deptConflicts.map((s) => {
              const session = s as Record<string, unknown>;
              const course = courseMap.get(session.course_id as string) as Record<string, unknown> | undefined;
              const conflictingDepts = (conflictSessionDepts || [])
                .filter((csd: Record<string, unknown>) => csd.session_id === session.id && departmentIds.includes(csd.department_id))
                .map((csd: Record<string, unknown>) => conflictDeptMap.get(csd.department_id as string) || 'Unknown');

              return {
                id: session.id,
                title: session.title,
                courseName: course?.name,
                scheduledAt: session.scheduled_at,
                durationMinutes: session.duration_minutes,
                conflictingDepartments: conflictingDepts,
              };
            }),
          },
        },
        { status: 409 }
      );
    }

    // Create the session
    const { data: sessions, error: sessionError } = await db
      .from('sessions')
      .insert({
        title,
        course_id: courseId,
        venue_id: venueId,
        lecturer_id: lecturerId,
        level,
        distance_threshold: threshold,
        duration_minutes: duration,
        scheduled_at: scheduledDate.toISOString(),
      })
      .select();

    if (sessionError || !sessions || sessions.length === 0) {
      console.error('Session creation error:', sessionError);
      return NextResponse.json(
        { success: false, error: 'Failed to create session' },
        { status: 500 }
      );
    }

    const session = sessions[0] as Record<string, unknown>;

    // Create session_department links
    if (departmentIds.length > 0) {
      const sessionDeptInserts = departmentIds.map((departmentId: string) => ({
        session_id: session.id,
        department_id: departmentId,
      }));
      await db.from('session_departments').insert(sessionDeptInserts);
    }

    // Fetch related data for response
    const [courseResult, venueResult] = await Promise.all([
      db.from('courses').select('id, name, code').eq('id', courseId),
      db.from('venues').select('id, name').eq('id', venueId),
    ]);

    const course = courseResult.data?.[0] as Record<string, unknown> | undefined;
    const venue = venueResult.data?.[0] as Record<string, unknown> | undefined;

    // Fetch departments for the session
    const { data: deptData } = await db
      .from('departments')
      .select('id, name, code')
      .in('id', departmentIds);

    return NextResponse.json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        courseId: session.course_id,
        courseName: course?.name,
        courseCode: course?.code,
        venueId: session.venue_id,
        venueName: venue?.name,
        lecturerId: session.lecturer_id,
        level: session.level,
        distanceThreshold: session.distance_threshold,
        durationMinutes: session.duration_minutes,
        scheduledAt: session.scheduled_at,
        startedAt: session.started_at,
        endsAt: session.ends_at,
        status: session.status,
        departments: (deptData || []).map((d: Record<string, unknown>) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        })),
      },
    });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
