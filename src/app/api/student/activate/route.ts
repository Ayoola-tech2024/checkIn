import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

    const student = await db.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    if (student.activated) {
      return NextResponse.json(
        { success: false, error: 'Account is already activated' },
        { status: 409 }
      );
    }

    // Check if email is already used by another student
    const emailExists = await db.student.findFirst({
      where: {
        email,
        NOT: { id: studentId },
      },
    });

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

    const updatedStudent = await db.student.update({
      where: { id: studentId },
      data: {
        email,
        passwordHash,
        facialData: facialDataString,
        selfieData: selfieData || null,
        activated: true,
      },
      include: { department: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        matricNumber: updatedStudent.matricNumber,
        departmentId: updatedStudent.departmentId,
        departmentName: updatedStudent.department.name,
        activated: updatedStudent.activated,
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
