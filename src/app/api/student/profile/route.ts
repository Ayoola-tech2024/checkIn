import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
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
        id: student.id,
        name: student.name,
        email: student.email,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName: department?.name,
        departmentCode: department?.code,
        schoolId: student.school_id,
        schoolName,
        schoolCode,
        level: typeof student.level === 'number' ? student.level : (typeof student.level === 'string' ? parseInt(student.level as string, 10) || 100 : 100),
        activated: student.activated,
        selfieData: student.selfie_data || null,
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

export async function PUT(request: NextRequest) {
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

    const { name, email, currentPassword, newPassword } = await request.json();

    // Fetch current student record
    const { data: students, error: fetchError } = await db
      .from('students')
      .select('*')
      .eq('id', studentId);

    if (fetchError || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;
    const updateFields: Record<string, unknown> = {};

    if (typeof name === 'string' && name.trim()) {
      updateFields.name = name.trim();
    }
    if (typeof email === 'string' && email.trim()) {
      updateFields.email = email.trim().toLowerCase();
    }

    // Handle password change if both current and new passwords are provided
    if (currentPassword && newPassword) {
      if (!student.password_hash) {
        return NextResponse.json(
          { success: false, error: 'No password set for this account. Please contact support.' },
          { status: 400 }
        );
      }

      if (typeof newPassword !== 'string' || newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'New password must be at least 6 characters' },
          { status: 400 }
        );
      }

      let isValid = await verifyPassword(currentPassword, student.password_hash as string);
      if (!isValid) {
        isValid = await verifyPassword(currentPassword.trim().toUpperCase(), student.password_hash as string)
          || await verifyPassword(currentPassword.trim().toLowerCase(), student.password_hash as string);
      }

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }

      updateFields.password_hash = await hashPassword(newPassword);
    }

    if (Object.keys(updateFields).length > 0) {
      const { error: updateError } = await db
        .from('students')
        .update(updateFields)
        .eq('id', studentId);

      if (updateError) {
        console.error('Failed to update student profile in DB:', updateError);
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    }

    // Fetch updated profile to return
    const { data: updatedStudents, error: refetchError } = await db
      .from('students')
      .select('*')
      .eq('id', studentId);

    if (refetchError || !updatedStudents || updatedStudents.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch updated profile' },
        { status: 500 }
      );
    }

    const updatedStudent = updatedStudents[0] as Record<string, unknown>;

    // Manually join department
    let department: Record<string, unknown> | null = null;
    if (updatedStudent.department_id) {
      const { data: depts } = await db.from('departments').select('*').eq('id', updatedStudent.department_id as string);
      department = (depts?.[0] as Record<string, unknown>) || null;
    }

    // Fetch school info
    let schoolName: string | undefined;
    let schoolCode: string | undefined;
    if (updatedStudent.school_id) {
      const { data: schoolData } = await db.from('schools').select('name, code').eq('id', updatedStudent.school_id as string);
      schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
      schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedStudent.id,
        name: updatedStudent.name,
        email: updatedStudent.email,
        matricNumber: updatedStudent.matric_number,
        departmentId: updatedStudent.department_id,
        departmentName: department?.name,
        departmentCode: department?.code,
        schoolId: updatedStudent.school_id,
        schoolName,
        schoolCode,
        level: typeof updatedStudent.level === 'number' ? updatedStudent.level : (typeof updatedStudent.level === 'string' ? parseInt(updatedStudent.level as string, 10) || 100 : 100),
        activated: updatedStudent.activated,
        selfieData: updatedStudent.selfie_data || null,
        createdAt: updatedStudent.created_at,
      },
    });
  } catch (error) {
    console.error('Update student profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
