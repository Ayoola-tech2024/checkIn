import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const semesterId = searchParams.get('semesterId');

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        departments: {
          include: {
            department: {
              include: {
                students: {
                  orderBy: { matricNumber: 'asc' },
                },
              },
            },
          },
        },
        sessions: {
          where: semesterId
            ? {
                scheduledAt: {
                  gte: (await db.semester.findUnique({ where: { id: semesterId } }))?.startDate,
                  lte: (await db.semester.findUnique({ where: { id: semesterId } }))?.endDate,
                },
              }
            : undefined,
          orderBy: { scheduledAt: 'asc' },
        },
        grading: {
          where: semesterId ? { semesterId } : undefined,
        },
      },
    });

    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const totalMarks = course.grading.length > 0 ? course.grading[0].totalMarks : 0;
    const sessions = course.sessions;
    const totalSessions = sessions.length;

    // Get all attendances for these sessions
    const sessionIds = sessions.map((s) => s.id);
    const attendances = await db.attendance.findMany({
      where: { sessionId: { in: sessionIds } },
    });

    // Group by department
    const departments = course.departments.map((cd) => {
      const dept = cd.department;
      const students = dept.students.map((student) => {
        // Get attendance for each session
        const sessionStatuses = sessions.map((session) => {
          const attendance = attendances.find(
            (a) => a.studentId === student.id && a.sessionId === session.id
          );
          return {
            date: session.scheduledAt.toISOString().split('T')[0],
            status: attendance ? attendance.status : 'absent',
          };
        });

        const presentCount = sessionStatuses.filter(
          (s) => s.status === 'present'
        ).length;
        const attendancePercentage =
          totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
        const marks =
          totalMarks > 0
            ? Math.round((attendancePercentage / 100) * totalMarks * 100) / 100
            : 0;

        return {
          name: student.name,
          matricNumber: student.matricNumber,
          sessions: sessionStatuses,
          attendancePercentage,
          marks,
        };
      });

      return {
        name: dept.name,
        students,
      };
    });

    // Get semester name
    let semesterName = 'All Semesters';
    if (semesterId) {
      const semester = await db.semester.findUnique({ where: { id: semesterId } });
      if (semester) {
        semesterName = semester.name;
      }
    }

    const exportData = {
      courseName: course.name,
      courseCode: course.code,
      semesterName,
      departments,
    };

    return NextResponse.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Export attendance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
