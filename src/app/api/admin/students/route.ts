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

export async function PUT(request: NextRequest) {
  try {
    const { id, name, matricNumber, departmentId } = await request.json();

    if (!id || !name || !matricNumber || !departmentId) {
      return NextResponse.json(
        { success: false, error: 'ID, name, matric number, and department are required' },
        { status: 400 }
      );
    }

    // Check if matric number is taken by another student
    const { data: existingStudents } = await db
      .from('students')
      .select('id')
      .eq('matric_number', matricNumber);

    if (existingStudents && existingStudents.length > 0 && (existingStudents[0] as Record<string, unknown>).id !== id) {
      return NextResponse.json(
        { success: false, error: 'Matric number is already in use by another student' },
        { status: 409 }
      );
    }

    const { data: students, error } = await db
      .from('students')
      .update({
        name,
        matric_number: matricNumber,
        department_id: departmentId,
      })
      .eq('id', id)
      .select();

    if (error || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update student' },
        { status: 500 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    // Get department name
    let departmentName: string | undefined;
    const { data: dept } = await db.from('departments').select('name').eq('id', departmentId);
    if (dept && dept.length > 0) {
      departmentName = (dept[0] as Record<string, unknown>).name as string;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName,
      },
    });
  } catch (error) {
    console.error('Update student error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Delete attendance records first
    await db.from('attendances').delete().eq('student_id', id);

    const { error } = await db.from('students').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete student' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete student error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
