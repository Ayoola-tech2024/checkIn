import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    const where = departmentId ? { departmentId } : {};

    const students = await db.student.findMany({
      where,
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = students.map((s) => ({
      id: s.id,
      name: s.name,
      matricNumber: s.matricNumber,
      departmentId: s.departmentId,
      departmentName: s.department.name,
      departmentCode: s.department.code,
      email: s.email,
      activated: s.activated,
      createdAt: s.createdAt,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get students error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
