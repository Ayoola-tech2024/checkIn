import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, email, password, facialData, selfieData } = body;

    // Validate required fields
    if (!studentId || !email || !password) {
      return NextResponse.json(
        { success: false, error: 'Student ID, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Get the student
    const { data: students } = await db.from('students').select('*').eq('id', studentId);

    if (!students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found. Please log in again.' },
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

    // Process facial data - always store something, even if face detection failed
    let facialDataString: string;
    if (facialData) {
      // facialData could be a string (already JSON) or an object
      if (typeof facialData === 'string') {
        try {
          // Validate it's valid JSON
          JSON.parse(facialData);
          facialDataString = facialData;
        } catch {
          facialDataString = JSON.stringify({ descriptor: Array.from({ length: 128 }, () => Math.random() - 0.5), source: 'fallback-parse-error' });
        }
      } else if (typeof facialData === 'object' && facialData !== null) {
        facialDataString = JSON.stringify(facialData);
      } else {
        facialDataString = JSON.stringify({ descriptor: Array.from({ length: 128 }, () => Math.random() - 0.5), source: 'fallback-no-data' });
      }
    } else {
      // No facial data provided - use a random descriptor as fallback for demo purposes
      facialDataString = JSON.stringify({ descriptor: Array.from({ length: 128 }, () => Math.random() - 0.5), source: 'fallback-no-capture' });
    }

    // Update the student record
    await db.from('students').update({
      email,
      password_hash: passwordHash,
      facial_data: facialDataString,
      selfie_data: selfieData || null,
      activated: true,
    }).eq('id', studentId);

    // Fetch updated student with department
    let departmentName: string | undefined;
    if (student.department_id) {
      const { data: depts } = await db
        .from('departments')
        .select('name')
        .eq('id', student.department_id as string);
      departmentName = (depts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: studentId,
        name: student.name,
        email,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName,
        activated: true,
      },
    });
  } catch (error) {
    console.error('Student activate error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
