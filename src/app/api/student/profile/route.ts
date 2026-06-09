import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    const { data: students, error } = await db
      .from('students')
      .select('*, departments(*)')
      .eq('id', studentId);

    if (error || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;
    const department = student.departments as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        email: student.email,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName: department?.name,
        departmentCode: department?.code,
        activated: student.activated,
        createdAt: student.created_at,
      },
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
