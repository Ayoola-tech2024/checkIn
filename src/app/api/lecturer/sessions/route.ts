import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const sessions = await db.session.findMany({
      where: { lecturerId },
      include: {
        course: { select: { id: true, name: true, code: true, level: true } },
        venue: { select: { id: true, name: true } },
        departments: {
          include: {
            department: { select: { id: true, name: true, code: true } },
          },
        },
        _count: {
          select: { attendances: true },
        },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    // Get attendance counts by status for each session
    const sessionIds = sessions.map((s) => s.id);

    const attendanceCounts = await db.attendance.groupBy({
      by: ['sessionId', 'status'],
      where: { sessionId: { in: sessionIds } },
      _count: { status: true },
    });

    const countMap = new Map<string, Record<string, number>>();
    for (const ac of attendanceCounts) {
      if (!countMap.has(ac.sessionId)) {
        countMap.set(ac.sessionId, {});
      }
      const map = countMap.get(ac.sessionId)!;
      map[ac.status] = ac._count.status;
    }

    // Count total target students per session
    const data = await Promise.all(
      sessions.map(async (session) => {
        const deptIds = session.departments.map((d) => d.departmentId);
        const totalTargetStudents = await db.student.count({
          where: { departmentId: { in: deptIds } },
        });

        return {
          id: session.id,
          title: session.title,
          courseId: session.courseId,
          courseName: session.course.name,
          courseCode: session.course.code,
          venueId: session.venueId,
          venueName: session.venue.name,
          lecturerId: session.lecturerId,
          level: session.level,
          distanceThreshold: session.distanceThreshold,
          durationMinutes: session.durationMinutes,
          scheduledAt: session.scheduledAt,
          startedAt: session.startedAt,
          endsAt: session.endsAt,
          status: session.status,
          lecturerLat: session.lecturerLat,
          lecturerLng: session.lecturerLng,
          departments: session.departments.map((d) => ({
            id: d.department.id,
            name: d.department.name,
            code: d.department.code,
          })),
          attendanceCounts: countMap.get(session.id) || {},
          totalAttendances: session._count.attendances,
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
    const conflictingVenueSessions = await db.session.findMany({
      where: {
        venueId,
        status: { in: ['scheduled', 'active'] },
        scheduledAt: {
          lt: sessionEnd,
        },
        // Session ends after our start
        // We need: scheduledAt + durationMinutes > scheduledDate
        // This means: we need sessions where their scheduledAt < sessionEnd
        // AND their scheduledAt + durationMinutes > scheduledDate
      },
      include: {
        course: { select: { name: true, code: true } },
        venue: { select: { name: true } },
      },
    });

    // Filter for actual time overlap
    const venueConflicts = conflictingVenueSessions.filter((s) => {
      const existingStart = new Date(s.scheduledAt);
      const existingEnd = new Date(existingStart.getTime() + s.durationMinutes * 60000);
      return existingEnd > scheduledDate && existingStart < sessionEnd;
    });

    if (venueConflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Venue is already booked for the requested time window',
          data: {
            conflicts: venueConflicts.map((s) => ({
              id: s.id,
              title: s.title,
              courseName: s.course.name,
              scheduledAt: s.scheduledAt,
              durationMinutes: s.durationMinutes,
            })),
          },
        },
        { status: 409 }
      );
    }

    // ===== VALIDATION: Department concurrency guardrail =====
    const conflictingDeptSessions = await db.sessionDepartment.findMany({
      where: {
        departmentId: { in: departmentIds },
        session: {
          status: { in: ['scheduled', 'active'] },
          scheduledAt: {
            lt: sessionEnd,
          },
        },
      },
      include: {
        session: {
          include: {
            course: { select: { name: true, code: true } },
            departments: {
              include: {
                department: { select: { name: true } },
              },
            },
          },
        },
        department: { select: { name: true } },
      },
    });

    // Filter for actual time overlap
    const deptConflicts = conflictingDeptSessions.filter((sd) => {
      const existingStart = new Date(sd.session.scheduledAt);
      const existingEnd = new Date(existingStart.getTime() + sd.session.durationMinutes * 60000);
      return existingEnd > scheduledDate && existingStart < sessionEnd;
    });

    // Deduplicate by session ID
    const uniqueDeptConflicts = Array.from(
      new Map(deptConflicts.map((sd) => [sd.session.id, sd])).values()
    );

    if (uniqueDeptConflicts.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'One or more departments are already booked for the requested time window',
          data: {
            conflicts: uniqueDeptConflicts.map((sd) => ({
              id: sd.session.id,
              title: sd.session.title,
              courseName: sd.session.course.name,
              scheduledAt: sd.session.scheduledAt,
              durationMinutes: sd.session.durationMinutes,
              conflictingDepartments: sd.session.departments
                .filter((d) => departmentIds.includes(d.departmentId))
                .map((d) => d.department.name),
            })),
          },
        },
        { status: 409 }
      );
    }

    // Create the session
    const session = await db.session.create({
      data: {
        title,
        courseId,
        venueId,
        lecturerId,
        level,
        distanceThreshold: threshold,
        durationMinutes: duration,
        scheduledAt: scheduledDate,
        departments: {
          create: departmentIds.map((departmentId: string) => ({
            departmentId,
          })),
        },
      },
      include: {
        course: { select: { id: true, name: true, code: true } },
        venue: { select: { id: true, name: true } },
        lecturer: { select: { id: true, name: true } },
        departments: {
          include: {
            department: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: session.id,
        title: session.title,
        courseId: session.courseId,
        courseName: session.course.name,
        courseCode: session.course.code,
        venueId: session.venueId,
        venueName: session.venue.name,
        lecturerId: session.lecturerId,
        lecturerName: session.lecturer.name,
        level: session.level,
        distanceThreshold: session.distanceThreshold,
        durationMinutes: session.durationMinutes,
        scheduledAt: session.scheduledAt,
        startedAt: session.startedAt,
        endsAt: session.endsAt,
        status: session.status,
        departments: session.departments.map((d) => ({
          id: d.department.id,
          name: d.department.name,
          code: d.department.code,
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
