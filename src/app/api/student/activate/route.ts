import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { studentId, email, password, facialData, selfieData } = await request.json();

    if (!studentId || !email || !password || !facialData) {
      return NextResponse.json(
        { success: false, error: 'Student ID, email, password, and facial data are required' },
        { status: 400 }
      );
    }

    const { data: students } = await db.from('students').select('*').eq('id', studentId);

    if (!students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    if (student.activated) {
      return NextResponse.json(
        { success: false, error: 'Account is already activated' },
        { status: 409 }
      );
    }

    // Check if email is already used by another student
    const { data: emailStudents } = await db
      .from('students')
      .select('id')
      .eq('email', email);

    const emailExists = (emailStudents || []).some(
      (s: Record<string, unknown>) => s.id !== studentId
    );

    if (emailExists) {
      return NextResponse.json(
        { success: false, error: 'Email is already in use by another student' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    // facialData is a JSON string with descriptor array
    const facialDataString = typeof facialData === 'string'
      ? facialData
      : JSON.stringify(facialData);

    await db.from('students').update({
      email,
      password_hash: passwordHash,
      facial_data: facialDataString,
      selfie_data: selfieData || null,
      activated: true,
    }).eq('id', studentId);

    // Fetch updated student with department
    const { data: updatedStudents } = await db
      .from('students')
      .select('*, departments(*)')
      .eq('id', studentId);

    const updatedStudent = updatedStudents?.[0] as Record<string, unknown> | undefined;
    const department = updatedStudent?.departments as Record<string, unknown> | null;

    return NextResponse.json({
      success: true,
      data: {
        id: updatedStudent?.id || studentId,
        name: updatedStudent?.name || student.name,
        email: updatedStudent?.email || email,
        matricNumber: updatedStudent?.matric_number || student.matric_number,
        departmentId: updatedStudent?.department_id || student.department_id,
        departmentName: department?.name,
        activated: true,
      },
    });
  } catch (error) {
    console.error('Student activate error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
