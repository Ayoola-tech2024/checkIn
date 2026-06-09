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
      const { data: lecturers, error } = await db.from('lecturers').select('*, courses:courses(*)').eq('email', email);
      if (error || !lecturers || lecturers.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      const lecturer = lecturers[0] as Record<string, unknown>;

      // If lecturer has no password yet, set the default password on first login
      if (!lecturer.password_hash) {
        const { hashPassword } = await import('@/lib/auth');
        const defaultHash = await hashPassword(generateDefaultPassword());
        await db.from('lecturers').update({ password_hash: defaultHash }).eq('id', lecturer.id as string);
        // Verify with the default password
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

      // Fetch course_departments with department info for each course
      const lecturerCourses = (lecturer.courses as Record<string, unknown>[]) || [];
      const coursesWithDepts = await Promise.all(
        lecturerCourses.map(async (c) => {
          const { data: courseDepts } = await db
            .from('course_departments')
            .select('*, departments(*)')
            .eq('course_id', c.id as string);
          return {
            id: c.id,
            name: c.name,
            code: c.code,
            level: c.level,
            departments: (courseDepts || []).map((cd: Record<string, unknown>) => {
              const dept = cd.departments as Record<string, unknown>;
              return {
                id: dept?.id,
                name: dept?.name,
                code: dept?.code,
              };
            }),
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
      // Students can log in with either email or matricNumber
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
          .select('*, departments(*)')
          .eq('matric_number', matricNumber);
        student = (students?.[0] as Record<string, unknown>) || null;
      } else if (email) {
        const { data: students } = await db
          .from('students')
          .select('*, departments(*)')
          .eq('email', email);
        student = (students?.[0] as Record<string, unknown>) || null;
      }

      if (!student) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // If student is not activated, they can still log in with the default password
      // to access the activation flow
      if (!student.password_hash) {
        // Auto-set default password for imported students who don't have one yet
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

      const department = student.departments as Record<string, unknown> | null;

      return NextResponse.json({
        success: true,
        data: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: 'student',
          matricNumber: student.matric_number,
          departmentId: student.department_id,
          departmentName: department?.name,
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
