import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        course: { select: { id: true, name: true, code: true } },
        venue: { select: { id: true, name: true } },
        lecturer: { select: { id: true, name: true } },
        departments: {
          include: {
            department: { select: { id: true, name: true, code: true } },
          },
        },
        attendances: {
          include: {
            student: {
              include: {
                department: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Count total target students
    const deptIds = session.departments.map((d) => d.departmentId);
    const totalTargetStudents = await db.student.count({
      where: { departmentId: { in: deptIds } },
    });

    // Calculate attendance stats
    const attendances = session.attendances;
    const presentCount = attendances.filter((a) => a.status === 'present').length;
    const absentCount = attendances.filter((a) => a.status === 'absent').length;
    const pendingCount = attendances.filter(
      (a) => a.status === 'pending_review' || a.status === 'pending'
    ).length;
    const rejectedLocationCount = attendances.filter(
      (a) => a.status === 'rejected_location'
    ).length;
    const rejectedIdentityCount = attendances.filter(
      (a) => a.status === 'rejected_identity'
    ).length;
    const rejectedCount = rejectedLocationCount + rejectedIdentityCount;

    // Late arrivals: checked in after session endsAt
    const sessionEnd = session.endsAt
      ? new Date(session.endsAt)
      : session.startedAt
        ? new Date(new Date(session.startedAt).getTime() + session.durationMinutes * 60000)
        : null;

    const lateCount = sessionEnd
      ? attendances.filter(
          (a) =>
            a.status === 'present' &&
            a.checkInTime &&
            new Date(a.checkInTime) > sessionEnd
        ).length
      : 0;

    // Detailed attendance list
    const attendanceList = attendances.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student.name,
      matricNumber: a.student.matricNumber,
      departmentName: a.student.department.name,
      sessionId: a.sessionId,
      status: a.status,
      similarityScore: a.similarityScore,
      checkInTime: a.checkInTime,
      studentLat: a.studentLat,
      studentLng: a.studentLng,
    }));

    // Absent students
    const absentStudents = attendances
      .filter((a) => a.status === 'absent')
      .map((a) => ({
        id: a.studentId,
        name: a.student.name,
        matricNumber: a.student.matricNumber,
        departmentName: a.student.department.name,
      }));

    return NextResponse.json({
      success: true,
      data: {
        session: {
          id: session.id,
          title: session.title,
          courseName: session.course.name,
          courseCode: session.course.code,
          venueName: session.venue.name,
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
