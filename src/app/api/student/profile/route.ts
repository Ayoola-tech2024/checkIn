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
      .select('*')
      .eq('id', studentId);

    if (error || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    // Manually join department for student
    let department: Record<string, unknown> | null = null;
    if (student.department_id) {
      const { data: depts } = await db.from('departments').select('*').eq('id', student.department_id as string);
      department = (depts?.[0] as Record<string, unknown>) || null;
    }

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
