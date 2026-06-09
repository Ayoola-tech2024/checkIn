import { NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
  try {
    const [
      departmentsResult,
      studentsResult,
      activatedStudentsResult,
      lecturersResult,
      coursesResult,
      venuesResult,
      sessionsResult,
    ] = await Promise.all([
      db.from('departments').select('id'),
      db.from('students').select('id'),
      db.from('students').select('id').eq('activated', true),
      db.from('lecturers').select('id'),
      db.from('courses').select('id'),
      db.from('venues').select('id'),
      db.from('sessions').select('id'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalDepartments: departmentsResult.data?.length || 0,
        totalStudents: studentsResult.data?.length || 0,
        activatedStudents: activatedStudentsResult.data?.length || 0,
        totalLecturers: lecturersResult.data?.length || 0,
        totalCourses: coursesResult.data?.length || 0,
        totalVenues: venuesResult.data?.length || 0,
        totalSessions: sessionsResult.data?.length || 0,
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
