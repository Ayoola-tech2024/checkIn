import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: {
        departments: {
          include: {
            department: true,
          },
        },
        attendances: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Session cannot be ended. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // Update session status
    await db.session.update({
      where: { id: sessionId },
      data: { status: 'completed' },
    });

    // Find all students in target departments who haven't checked in
    const deptIds = session.departments.map((d) => d.departmentId);

    // Get students who already have attendance records for this session
    const attendedStudentIds = session.attendances.map((a) => a.studentId);

    // Find all students in target departments without attendance records
    const absentStudents = await db.student.findMany({
      where: {
        departmentId: { in: deptIds },
        id: { notIn: attendedStudentIds },
      },
    });

    // Create absent attendance records for students who haven't checked in
    if (absentStudents.length > 0) {
      await db.attendance.createMany({
        data: absentStudents.map((student) => ({
          studentId: student.id,
          sessionId,
          status: 'absent',
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: sessionId,
        status: 'completed',
        absentStudentsCreated: absentStudents.length,
        totalAttendances: session.attendances.length + absentStudents.length,
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
