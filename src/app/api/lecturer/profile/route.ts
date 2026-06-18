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
    const lecturerId = auth.userId;

    const { data: lecturers, error } = await db
      .from('lecturers')
      .select('*')
      .eq('id', lecturerId);

    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lecturer not found' },
        { status: 404 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    // Fetch school info
    let schoolName: string | undefined;
    let schoolCode: string | undefined;
    if (lecturer.school_id) {
      const { data: schoolData } = await db.from('schools').select('name, code').eq('id', lecturer.school_id as string);
      schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
      schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
    }

    // Fetch lecturer's courses
    const { data: lecturerCourses } = await db
      .from('courses')
      .select('*')
      .eq('lecturer_id', lecturerId);

    // For each course, fetch its departments
    const coursesWithDepts = await Promise.all(
      (lecturerCourses || []).map(async (c: Record<string, unknown>) => {
        const { data: courseDepts } = await db
          .from('course_departments')
          .select('department_id')
          .eq('course_id', c.id as string);

        const deptIds = (courseDepts || []).map(
          (cd: Record<string, unknown>) => cd.department_id as string
        );

        let departments: { id: string; name: string; code: string }[] = [];
        if (deptIds.length > 0) {
          const { data: deptData } = await db
            .from('departments')
            .select('id, name, code')
            .in('id', deptIds);
          departments = (deptData || []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            name: d.name as string,
            code: d.code as string,
          }));
        }

        return {
          id: c.id as string,
          name: c.name as string,
          code: c.code as string,
          level: typeof c.level === 'number' ? c.level : (typeof c.level === 'string' ? parseInt(c.level as string, 10) || 0 : 0),
          lecturerId: c.lecturer_id as string,
          departments,
        };
      })
    );

    // Fetch department name for lecturer if department_id exists
    let lecturerDepartmentName: string | undefined;
    if (lecturer.department_id) {
      const { data: lecturerDepts } = await db
        .from('departments')
        .select('name')
        .eq('id', lecturer.department_id as string);
      lecturerDepartmentName = (lecturerDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch HOD department name if hod_department_id exists
    let hodDepartmentName: string | undefined;
    if (lecturer.hod_department_id) {
      const { data: hodDepts } = await db
        .from('departments')
        .select('name')
        .eq('id', lecturer.hod_department_id as string);
      hodDepartmentName = (hodDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        schoolId: lecturer.school_id,
        schoolName,
        schoolCode,
        departmentId: lecturer.department_id,
        departmentName: lecturerDepartmentName,
        isHod: lecturer.is_hod ?? false,
        hodDepartmentId: lecturer.hod_department_id,
        hodDepartmentName,
        createdAt: lecturer.created_at,
        courses: coursesWithDepts,
      },
    });
  } catch (error) {
    console.error('Get lecturer profile error:', error);
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
    const id = auth.userId;

    const { name, email, currentPassword, newPassword } = await request.json();

    // Fetch current lecturer record
    const { data: lecturers, error: fetchError } = await db
      .from('lecturers')
      .select('*')
      .eq('id', id);

    if (fetchError || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lecturer not found' },
        { status: 404 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    // Handle password change if both current and new passwords are provided
    if (currentPassword && newPassword) {
      if (!lecturer.password_hash) {
        return NextResponse.json(
          { success: false, error: 'No password set for this account. Please contact support.' },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(currentPassword, lecturer.password_hash as string);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }

      const hashedNewPassword = await hashPassword(newPassword);
      const { error: updateError } = await db
        .from('lecturers')
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
        .from('lecturers')
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
    const { data: updatedLecturers, error: refetchError } = await db
      .from('lecturers')
      .select('*')
      .eq('id', id);

    if (refetchError || !updatedLecturers || updatedLecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch updated profile' },
        { status: 500 }
      );
    }

    const updatedLecturer = updatedLecturers[0] as Record<string, unknown>;

    // Fetch school info
    let schoolName: string | undefined;
    let schoolCode: string | undefined;
    if (updatedLecturer.school_id) {
      const { data: schoolData } = await db.from('schools').select('name, code').eq('id', updatedLecturer.school_id as string);
      schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
      schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
    }

    // Fetch department name if department_id exists
    let lecturerDepartmentName: string | undefined;
    if (updatedLecturer.department_id) {
      const { data: lecturerDepts } = await db
        .from('departments')
        .select('name')
        .eq('id', updatedLecturer.department_id as string);
      lecturerDepartmentName = (lecturerDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch HOD department name if hod_department_id exists
    let hodDepartmentName: string | undefined;
    if (updatedLecturer.hod_department_id) {
      const { data: hodDepts } = await db
        .from('departments')
        .select('name')
        .eq('id', updatedLecturer.hod_department_id as string);
      hodDepartmentName = (hodDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updatedLecturer.id,
        name: updatedLecturer.name,
        email: updatedLecturer.email,
        schoolId: updatedLecturer.school_id,
        schoolName,
        schoolCode,
        departmentId: updatedLecturer.department_id,
        departmentName: lecturerDepartmentName,
        isHod: updatedLecturer.is_hod ?? false,
        hodDepartmentId: updatedLecturer.hod_department_id,
        hodDepartmentName,
        createdAt: updatedLecturer.created_at,
      },
    });
  } catch (error) {
    console.error('Update lecturer profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
