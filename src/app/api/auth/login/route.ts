import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { verifyPassword } from '@/lib/auth';
import { createSessionToken, getCookieOptions, getSessionCookieName } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const { email, password, role, matricNumber } = await request.json();

    if (!password || !role) {
      return NextResponse.json(
        { success: false, error: 'Password and role are required' },
        { status: 400 }
      );
    }

    if (!['admin', 'lecturer', 'student', 'hod'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role. Must be admin, hod, lecturer, or student' },
        { status: 400 }
      );
    }

    // Helper: set session cookie on the response
    const setSessionCookie = (response: NextResponse, token: string) => {
      const opts = getCookieOptions();
      response.cookies.set(getSessionCookieName(), token, opts);
      return response;
    };

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

      const userData = {
        id: admin.id as string,
        name: admin.name as string,
        email: admin.email as string,
        role: 'admin' as const,
      };
      const token = await createSessionToken({ ...userData, role: 'admin' });
      const response = NextResponse.json({ success: true, data: userData });
      return setSessionCookie(response, token);
    }

    if (role === 'lecturer' || role === 'hod') {
      if (!email) {
        return NextResponse.json(
          { success: false, error: 'Email is required' },
          { status: 400 }
        );
      }

      const { data: lecturers, error } = await db.from('lecturers').select('*').eq('email', email);
      if (error || !lecturers || lecturers.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      const lecturer = lecturers[0] as Record<string, unknown>;

      if (role === 'hod' && !lecturer.is_hod) {
        return NextResponse.json(
          { success: false, error: 'This account is not designated as a Head of Department' },
          { status: 403 }
        );
      }

      // SECURITY: No more auto-applying default password.
      // If password_hash is null, the account has not been properly provisioned.
      if (!lecturer.password_hash) {
        return NextResponse.json(
          { success: false, error: 'Account not activated. Please contact your administrator to set up your password.' },
          { status: 403 }
        );
      }

      const valid = await verifyPassword(password, lecturer.password_hash as string);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
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

      let lecturerDepartmentName: string | undefined;
      if (lecturer.department_id) {
        const { data: lecturerDepts } = await db
          .from('departments')
          .select('name')
          .eq('id', lecturer.department_id as string);
        lecturerDepartmentName = (lecturerDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
      }

      let hodDepartmentName: string | undefined;
      if (lecturer.hod_department_id) {
        const { data: hodDepts } = await db
          .from('departments')
          .select('name')
          .eq('id', lecturer.hod_department_id as string);
        hodDepartmentName = (hodDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
      }

      const responseRole = role === 'hod' ? 'hod' : 'lecturer';

      const userData = {
        id: lecturer.id as string,
        name: lecturer.name as string,
        email: lecturer.email as string,
        role: responseRole as 'lecturer' | 'hod',
        schoolId: lecturer.school_id as string | undefined,
        schoolName,
        schoolCode,
        departmentId: lecturer.department_id as string | undefined,
        departmentName: lecturerDepartmentName,
        isHod: lecturer.is_hod as boolean | undefined,
        hodDepartmentId: lecturer.hod_department_id as string | undefined,
        hodDepartmentName,
        courses: coursesWithDepts,
      };
      const token = await createSessionToken({
        userId: userData.id,
        role: userData.role,
        email: userData.email,
        name: userData.name,
      });
      const response = NextResponse.json({ success: true, data: userData });
      return setSessionCookie(response, token);
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

      // SECURITY: No more auto-applying default password.
      // If password_hash is null, the account must be activated first.
      if (!student.password_hash) {
        return NextResponse.json(
          { success: false, error: 'Account not activated. Please activate your account first using your matric number and default password.' },
          { status: 403 }
        );
      }

      const valid = await verifyPassword(password, student.password_hash as string);
      if (!valid) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      let schoolName: string | undefined;
      let schoolCode: string | undefined;
      if (student.school_id) {
        const { data: schoolData } = await db.from('schools').select('name, code').eq('id', student.school_id as string);
        schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
        schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
      }

      let departmentName: string | undefined;
      if (student.department_id) {
        const { data: depts } = await db
          .from('departments')
          .select('name')
          .eq('id', student.department_id as string);
        departmentName = (depts?.[0] as Record<string, unknown>)?.name as string | undefined;
      }

      const userData = {
        id: student.id as string,
        name: student.name as string,
        email: student.email as string,
        role: 'student' as const,
        matricNumber: student.matric_number as string,
        departmentId: student.department_id as string | undefined,
        departmentName,
        schoolId: student.school_id as string | undefined,
        schoolName,
        schoolCode,
        level: typeof student.level === 'number' ? student.level : (typeof student.level === 'string' ? parseInt(student.level as string, 10) || 100 : 100),
        activated: student.activated as boolean,
      };
      const token = await createSessionToken({
        userId: userData.id,
        role: 'student',
        email: userData.email,
        name: userData.name,
      });
      const response = NextResponse.json({ success: true, data: userData });
      return setSessionCookie(response, token);
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
