import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const courses = await db.course.findMany({
      include: {
        lecturer: {
          select: { id: true, name: true, email: true },
        },
        departments: {
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = courses.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      level: c.level,
      lecturerId: c.lecturerId,
      lecturerName: c.lecturer.name,
      departments: c.departments.map((cd) => ({
        id: cd.department.id,
        name: cd.department.name,
        code: cd.department.code,
      })),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get courses error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, code, level, lecturerId, departmentIds } = await request.json();

    if (!name || !code || !level || !lecturerId || !departmentIds || !Array.isArray(departmentIds)) {
      return NextResponse.json(
        { success: false, error: 'Name, code, level, lecturerId, and departmentIds are required' },
        { status: 400 }
      );
    }

    // Verify lecturer exists
    const lecturer = await db.lecturer.findUnique({ where: { id: lecturerId } });
    if (!lecturer) {
      return NextResponse.json(
        { success: false, error: 'Lecturer not found' },
        { status: 404 }
      );
    }

    // Check unique code
    const existingCourse = await db.course.findUnique({ where: { code } });
    if (existingCourse) {
      return NextResponse.json(
        { success: false, error: 'Course with this code already exists' },
        { status: 409 }
      );
    }

    const course = await db.course.create({
      data: {
        name,
        code,
        level,
        lecturerId,
        departments: {
          create: departmentIds.map((departmentId: string) => ({
            departmentId,
          })),
        },
      },
      include: {
        lecturer: { select: { id: true, name: true, email: true } },
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
        id: course.id,
        name: course.name,
        code: course.code,
        level: course.level,
        lecturerId: course.lecturerId,
        lecturerName: course.lecturer.name,
        departments: course.departments.map((cd) => ({
          id: cd.department.id,
          name: cd.department.name,
          code: cd.department.code,
        })),
      },
    });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
