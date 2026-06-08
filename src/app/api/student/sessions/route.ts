import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    const student = await db.student.findUnique({
      where: { id: studentId },
      include: { department: true },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    // Find all sessions targeting this student's department
    const sessionDepts = await db.sessionDepartment.findMany({
      where: { departmentId: student.departmentId },
      include: {
        session: {
          include: {
            course: { select: { id: true, name: true, code: true, level: true } },
            venue: { select: { id: true, name: true } },
            lecturer: { select: { id: true, name: true } },
            departments: {
              include: {
                department: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: { session: { scheduledAt: 'desc' } },
    });

    // Get attendance records for this student
    const attendances = await db.attendance.findMany({
      where: { studentId },
    });

    const attendanceMap = new Map(attendances.map((a) => [a.sessionId, a]));

    // Filter by level if needed (sessions have a level field)
    const sessions = sessionDepts
      .filter((sd) => sd.session.level === student.department.code.split('/').pop() || true)
      .map((sd) => {
        const session = sd.session;
        const attendance = attendanceMap.get(session.id);

        return {
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
          lecturerLat: session.lecturerLat,
          lecturerLng: session.lecturerLng,
          departments: session.departments.map((d) => ({
            id: d.department.id,
            name: d.department.name,
            code: d.department.code,
          })),
          attendance: attendance
            ? {
                id: attendance.id,
                status: attendance.status,
                similarityScore: attendance.similarityScore,
                checkInTime: attendance.checkInTime,
              }
            : null,
        };
      });

    return NextResponse.json({ success: true, data: sessions });
  } catch (error) {
    console.error('Get student sessions error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
