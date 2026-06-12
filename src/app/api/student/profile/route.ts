import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { verifyPassword, hashPassword } from '@/lib/auth';

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
    const { id, name, email, currentPassword, newPassword } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Fetch current student record
    const { data: students, error: fetchError } = await db
      .from('students')
      .select('*')
      .eq('id', id);

    if (fetchError || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    // Handle password change if both current and new passwords are provided
    if (currentPassword && newPassword) {
      if (!student.password_hash) {
        return NextResponse.json(
          { success: false, error: 'No password set for this account. Please contact support.' },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(currentPassword, student.password_hash as string);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }

      const hashedNewPassword = await hashPassword(newPassword);
      const { error: updateError } = await db
        .from('students')
        .update({ name, email, password_hash: hashedNewPassword })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    } else {
      // Update without changing password
      const { error: updateError } = await db
        .from('students')
        .update({ name, email })
        .eq('id', id);

      if (updateError) {
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
      .eq('id', id);

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
