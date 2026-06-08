import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');
    const semesterId = searchParams.get('semesterId');

    if (!lecturerId) {
      return NextResponse.json(
        { success: false, error: 'Lecturer ID is required' },
        { status: 400 }
      );
    }

    // Get lecturer's courses
    const courses = await db.course.findMany({
      where: { lecturerId },
      include: {
        grading: {
          where: semesterId ? { semesterId } : undefined,
          include: {
            semester: { select: { id: true, name: true } },
          },
        },
      },
    });

    const data = courses.map((course) => ({
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      level: course.level,
      grading: course.grading.map((g) => ({
        id: g.id,
        courseId: g.courseId,
        semesterId: g.semesterId,
        semesterName: g.semester.name,
        totalMarks: g.totalMarks,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get grading error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { courseId, semesterId, totalMarks } = await request.json();

    if (!courseId || !semesterId || totalMarks === undefined) {
      return NextResponse.json(
        { success: false, error: 'Course ID, semester ID, and total marks are required' },
        { status: 400 }
      );
    }

    // Verify course exists
    const course = await db.course.findUnique({ where: { id: courseId } });
    if (!course) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Verify semester exists
    const semester = await db.semester.findUnique({ where: { id: semesterId } });
    if (!semester) {
      return NextResponse.json(
        { success: false, error: 'Semester not found' },
        { status: 404 }
      );
    }

    // Upsert grading
    const grading = await db.courseGrading.upsert({
      where: {
        courseId_semesterId: { courseId, semesterId },
      },
      create: {
        courseId,
        semesterId,
        totalMarks: parseFloat(totalMarks),
      },
      update: {
        totalMarks: parseFloat(totalMarks),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: grading.id,
        courseId: grading.courseId,
        semesterId: grading.semesterId,
        totalMarks: grading.totalMarks,
      },
    });
  } catch (error) {
    console.error('Set grading error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
