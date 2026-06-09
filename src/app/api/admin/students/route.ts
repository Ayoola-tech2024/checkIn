import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, matricNumber, departmentId } = await request.json();

    if (!name || !matricNumber || !departmentId) {
      return NextResponse.json(
        { success: false, error: 'Name, matric number, and department are required' },
        { status: 400 }
      );
    }

    // Verify department exists
    const { data: depts } = await db.from('departments').select('id, name').eq('id', departmentId);
    if (!depts || depts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check if matric number already exists
    const { data: existingStudents } = await db
      .from('students')
      .select('id')
      .eq('matric_number', matricNumber);

    if (existingStudents && existingStudents.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Student with this matric number already exists' },
        { status: 409 }
      );
    }

    const department = depts[0] as Record<string, unknown>;
    const defaultPassword = generateDefaultPassword();
    const passwordHash = await hashPassword(defaultPassword);

    const { data: students, error } = await db
      .from('students')
      .insert({
        name,
        matric_number: matricNumber,
        department_id: departmentId,
        password_hash: passwordHash,
        activated: false,
      })
      .select();

    if (error || !students || students.length === 0) {
      console.error('Student creation error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create student' },
        { status: 500 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName: department.name,
        activated: false,
        defaultPassword,
      },
    });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
