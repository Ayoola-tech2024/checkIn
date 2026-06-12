import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { verifyPassword, generateDefaultPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, matricNumber } = await request.json();

    if (!password || !role) {
      return NextResponse.json(
        { success: false, error: 'Password and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'lecturer', 'student'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be admin, lecturer, or student' },
        { status: 400 }
      );
    }

    if (role === 'admin') {
      if (!email) {
        return NextResponse.json(
          { success: false, error: 'Email is required' },
          { status: 400 }
        );
      }
      const { data: admins, error } = await db.from('admins').select('*').eq('email', email);
      if (error || !admins || admins.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      const admin = admins[0] as Record<string, unknown>;
      const valid = await verifyPassword(password, admin.password_hash as string);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          id: admin.id,
          name: admin.name,
          email: admin.email,
          role: 'admin',
        },
      });
    }

    if (role === 'lecturer') {
      if (!email) {
        return NextResponse.json(
          { success: false, error: 'Email is required' },
          { status: 400 }
        );
      }

      // Fetch lecturer without nested resources
      const { data: lecturers, error } = await db.from('lecturers').select('*').eq('email', email);
      if (error || !lecturers || lecturers.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      const lecturer = lecturers[0] as Record<string, unknown>;

      // Handle password
      if (!lecturer.password_hash) {
        const { hashPassword } = await import('@/lib/auth');
        const defaultHash = await hashPassword(generateDefaultPassword());
        await db.from('lecturers').update({ password_hash: defaultHash }).eq('id', lecturer.id as string);
        const valid = await verifyPassword(password, defaultHash);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials. Default password is CheckIn@2024' },
            { status: 401 }
          );
        }
      } else {
        const valid = await verifyPassword(password, lecturer.password_hash as string);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials' },
            { status: 401 }
          );
        }
      }

      // Fetch school info
      let schoolName: string | undefined;
      let schoolCode: string | undefined;
      if (lecturer.school_id) {
        const { data: schoolData } = await db.from('schools').select('name, code').eq('id', lecturer.school_id as string);
        schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
        schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
      }

      // Manually fetch courses for this lecturer
      const { data: lecturerCourses } = await db
        .from('courses')
        .select('*')
        .eq('lecturer_id', lecturer.id as string);

      // For each course, manually fetch its departments
      const coursesWithDepts = await Promise.all(
        (lecturerCourses || []).map(async (c: Record<string, unknown>) => {
          const { data: courseDepts } = await db
            .from('course_departments')
            .select('department_id')
            .eq('course_id', c.id as string);

          const deptIds = (courseDepts || []).map((cd: Record<string, unknown>) => cd.department_id as string);

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
          role: 'lecturer',
          schoolId: lecturer.school_id,
          schoolName,
          schoolCode,
          departmentId: lecturer.department_id,
          departmentName: lecturerDepartmentName,
          isHod: lecturer.is_hod ?? false,
          hodDepartmentId: lecturer.hod_department_id,
          hodDepartmentName,
          courses: coursesWithDepts,
        },
      });
    }

    if (role === 'student') {
      if (!email && !matricNumber) {
        return NextResponse.json(
          { success: false, error: 'Email or Matric Number is required' },
          { status: 400 }
        );
      }

      let student: Record<string, unknown> | null = null;

      if (matricNumber) {
        const { data: students } = await db
          .from('students')
          .select('*')
          .eq('matric_number', matricNumber);
        student = (students?.[0] as Record<string, unknown>) || null;
      }

      if (!student && email) {
        const { data: students } = await db
          .from('students')
          .select('*')
          .eq('email', email);
        student = (students?.[0] as Record<string, unknown>) || null;
      }

      if (!student) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials. Student not found.' },
          { status: 401 }
        );
      }

      // Handle password
      if (!student.password_hash) {
        const { hashPassword } = await import('@/lib/auth');
        const defaultHash = await hashPassword(generateDefaultPassword());
        await db.from('students').update({ password_hash: defaultHash }).eq('id', student.id as string);
        const valid = await verifyPassword(password, defaultHash);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials. Default password is CheckIn@2024' },
            { status: 401 }
          );
        }
      } else {
        const valid = await verifyPassword(password, student.password_hash as string);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials. Default password is CheckIn@2024' },
            { status: 401 }
          );
        }
      }

      // Fetch school info
      let schoolName: string | undefined;
      let schoolCode: string | undefined;
      if (student.school_id) {
        const { data: schoolData } = await db.from('schools').select('name, code').eq('id', student.school_id as string);
        schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
        schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
      }

      // Manually fetch department
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
          id: student.id,
          name: student.name,
          email: student.email,
          role: 'student',
          matricNumber: student.matric_number,
          departmentId: student.department_id,
          departmentName,
          schoolId: student.school_id,
          schoolName,
          schoolCode,
          level: typeof student.level === 'number' ? student.level : (typeof student.level === 'string' ? parseInt(student.level as string, 10) || 100 : 100),
          activated: student.activated,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Unknown error' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
