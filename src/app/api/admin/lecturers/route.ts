import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const lecturers = await db.lecturer.findMany({
      include: {
        courses: {
          select: {
            id: true,
            name: true,
            code: true,
            level: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = lecturers.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      courses: l.courses,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get lecturers error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const existing = await db.lecturer.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Lecturer with this email already exists' },
        { status: 409 }
      );
    }

    const lecturer = await db.lecturer.create({
      data: { name, email },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        courses: [],
      },
    });
  } catch (error) {
    console.error('Create lecturer error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
