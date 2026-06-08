import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const departments = await db.department.findMany({
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      studentCount: dept._count.students,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, code } = await request.json();

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Name and code are required' },
        { status: 400 }
      );
    }

    const existing = await db.department.findFirst({
      where: {
        OR: [{ name }, { code }],
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Department with this name or code already exists' },
        { status: 409 }
      );
    }

    const department = await db.department.create({
      data: { name, code },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
        studentCount: 0,
      },
    });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
