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
            level: (c.level as string) || '',
            lecturerId: c.lecturer_id as string,
            departments,
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: {
          id: lecturer.id,
          name: lecturer.name,
          email: lecturer.email,
          role: 'lecturer',
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
