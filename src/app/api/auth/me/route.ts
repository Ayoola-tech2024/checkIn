import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-context';
import { db } from '@/lib/insforge';

// Returns the full authenticated user record from the database.
export async function GET(request: Request) {
  const auth = getAuthUser(request);
  if (!auth) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }

  try {
    if (auth.role === 'student') {
      const { data: students } = await db.from('students').select('*').eq('id', auth.userId);
      const student = students?.[0] as Record<string, unknown> | undefined;
      if (!student) {
        return NextResponse.json({ success: false, error: 'Student not found' }, { status: 404 });
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
        const { data: depts } = await db.from('departments').select('name').eq('id', student.department_id as string);
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
        activated: Boolean(student.activated),
      };

      return NextResponse.json({ success: true, data: userData });
    }

    if (auth.role === 'lecturer' || auth.role === 'hod') {
      const { data: lecturers } = await db.from('lecturers').select('*').eq('id', auth.userId);
      const lecturer = lecturers?.[0] as Record<string, unknown> | undefined;
      if (!lecturer) {
        return NextResponse.json({ success: false, error: 'Lecturer not found' }, { status: 404 });
      }

      let schoolName: string | undefined;
      let schoolCode: string | undefined;
      if (lecturer.school_id) {
        const { data: schoolData } = await db.from('schools').select('name, code').eq('id', lecturer.school_id as string);
        schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
        schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;
      }

      let departmentName: string | undefined;
      if (lecturer.department_id) {
        const { data: depts } = await db.from('departments').select('name').eq('id', lecturer.department_id as string);
        departmentName = (depts?.[0] as Record<string, unknown>)?.name as string | undefined;
      }

      let hodDepartmentName: string | undefined;
      if (lecturer.hod_department_id) {
        const { data: hodDepts } = await db.from('departments').select('name').eq('id', lecturer.hod_department_id as string);
        hodDepartmentName = (hodDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
      }

      const { data: lecturerCourses } = await db.from('courses').select('*').eq('lecturer_id', lecturer.id as string);
      const coursesWithDepts = await Promise.all(
        (lecturerCourses || []).map(async (c: Record<string, unknown>) => {
          const { data: courseDepts } = await db.from('course_departments').select('department_id').eq('course_id', c.id as string);
          const deptIds = (courseDepts || []).map((cd: Record<string, unknown>) => cd.department_id as string);
          let departments: { id: string; name: string; code: string }[] = [];
          if (deptIds.length > 0) {
            const { data: deptData } = await db.from('departments').select('id, name, code').in('id', deptIds);
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

      const userData = {
        id: lecturer.id as string,
        name: lecturer.name as string,
        email: lecturer.email as string,
        role: auth.role,
        schoolId: lecturer.school_id as string | undefined,
        schoolName,
        schoolCode,
        departmentId: lecturer.department_id as string | undefined,
        departmentName,
        isHod: Boolean(lecturer.is_hod),
        hodDepartmentId: lecturer.hod_department_id as string | undefined,
        hodDepartmentName,
        courses: coursesWithDepts,
      };

      return NextResponse.json({ success: true, data: userData });
    }

    if (auth.role === 'admin') {
      const { data: admins } = await db.from('admins').select('*').eq('id', auth.userId);
      const admin = admins?.[0] as Record<string, unknown> | undefined;
      if (!admin) {
        return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
      }

      const userData = {
        id: admin.id as string,
        name: admin.name as string,
        email: admin.email as string,
        role: 'admin' as const,
      };

      return NextResponse.json({ success: true, data: userData });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: auth.userId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
      },
    });
  } catch (err) {
    console.error('Error fetching full user profile in /api/auth/me:', err);
    return NextResponse.json({
      success: true,
      data: {
        id: auth.userId,
        name: auth.name,
        email: auth.email,
        role: auth.role,
      },
    });
  }
}
