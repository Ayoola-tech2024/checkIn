import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const [
      totalDepartments,
      totalStudents,
      activatedStudents,
      totalLecturers,
      totalCourses,
      totalVenues,
      totalSessions,
    ] = await Promise.all([
      db.department.count(),
      db.student.count(),
      db.student.count({ where: { activated: true } }),
      db.lecturer.count(),
      db.course.count(),
      db.venue.count(),
      db.session.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalDepartments,
        totalStudents,
        activatedStudents,
        totalLecturers,
        totalCourses,
        totalVenues,
        totalSessions,
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
