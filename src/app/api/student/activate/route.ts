import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword } from '@/lib/auth';
import { getAuthUser } from '@/lib/auth-context';
import { validateDescriptor } from '@/lib/face-utils';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // SECURITY: Use the authenticated student's ID, not a client-supplied one.
    const studentId = auth.userId;

    const body = await request.json();
    const { email, password, facialData, selfieData } = body;

    // Validate required fields
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email and password are required' },
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

    // Process facial data - face capture is now required for activation
    let facialDataString: string;
    if (facialData) {
      if (typeof facialData === 'string') {
        try {
          const parsed = JSON.parse(facialData);
          // SECURITY: validate descriptor shape on activation. Prevents a
          // malicious/buggy client from storing `{ descriptor: [] }` which
          // would brick that student's check-in forever.
          const descriptorToValidate = parsed?.descriptor ?? parsed;
          const descriptorError = validateDescriptor(descriptorToValidate);
          if (descriptorError) {
            return NextResponse.json(
              { success: false, error: descriptorError },
              { status: 400 }
            );
          }
          facialDataString = facialData;
        } catch {
          return NextResponse.json(
            { success: false, error: 'Invalid facial data format. Please recapture your face.' },
            { status: 400 }
          );
        }
      } else if (typeof facialData === 'object' && facialData !== null) {
        // SECURITY: validate descriptor shape before persisting.
        const descriptorToValidate = (facialData as { descriptor?: unknown }).descriptor ?? facialData;
        const descriptorError = validateDescriptor(descriptorToValidate);
        if (descriptorError) {
          return NextResponse.json(
            { success: false, error: descriptorError },
            { status: 400 }
          );
        }
        facialDataString = JSON.stringify(facialData);
      } else {
        return NextResponse.json(
          { success: false, error: 'Facial data is required for account activation.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, error: 'Facial verification is required for account activation. Please capture your face.' },
        { status: 400 }
      );
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

    // Fetch school info
    let schoolName: string | undefined;
    let schoolCode: string | undefined;
    if (student.school_id) {
      const { data: schoolData } = await db.from('schools').select('name, code').eq('id', student.school_id as string);
      schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
      schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
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
        schoolId: student.school_id,
        schoolName,
        schoolCode,
        level: typeof student.level === 'number' ? student.level : (typeof student.level === 'string' ? parseInt(student.level as string, 10) || 100 : 100),
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
