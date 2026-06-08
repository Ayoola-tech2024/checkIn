import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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
      const admin = await db.admin.findUnique({ where: { email } });
      if (!admin) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      const valid = await verifyPassword(password, admin.passwordHash);
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
      const lecturer = await db.lecturer.findUnique({
        where: { email },
        include: { courses: { include: { departments: { include: { department: true } } } } },
      });
      if (!lecturer) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }
      // If lecturer has no password yet, set the default password on first login
      if (!lecturer.passwordHash) {
        const { hashPassword } = await import('@/lib/auth');
        const defaultHash = await hashPassword(generateDefaultPassword());
        await db.lecturer.update({
          where: { id: lecturer.id },
          data: { passwordHash: defaultHash },
        });
        // Verify with the default password
        const valid = await verifyPassword(password, defaultHash);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials. Default password is CheckIn@2024' },
            { status: 401 }
          );
        }
      } else {
        const valid = await verifyPassword(password, lecturer.passwordHash);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials' },
            { status: 401 }
          );
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          id: lecturer.id,
          name: lecturer.name,
          email: lecturer.email,
          role: 'lecturer',
          courses: lecturer.courses.map((c) => ({
            id: c.id,
            name: c.name,
            code: c.code,
            level: c.level,
            departments: c.departments.map((cd) => ({
              id: cd.department.id,
              name: cd.department.name,
              code: cd.department.code,
            })),
          })),
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

      let student;
      if (matricNumber) {
        student = await db.student.findUnique({
          where: { matricNumber },
          include: { department: true },
        });
      } else if (email) {
        student = await db.student.findUnique({
          where: { email },
          include: { department: true },
        });
      }

      if (!student) {
        return NextResponse.json(
          { success: false, error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      // If student is not activated, they can still log in with the default password
      // to access the activation flow
      if (!student.passwordHash) {
        // Auto-set default password for imported students who don't have one yet
        const { hashPassword } = await import('@/lib/auth');
        const defaultHash = await hashPassword(generateDefaultPassword());
        await db.student.update({
          where: { id: student.id },
          data: { passwordHash: defaultHash },
        });
        const valid = await verifyPassword(password, defaultHash);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials. Default password is CheckIn@2024' },
            { status: 401 }
          );
        }
      } else {
        const valid = await verifyPassword(password, student.passwordHash);
        if (!valid) {
          return NextResponse.json(
            { success: false, error: 'Invalid credentials. Default password is CheckIn@2024' },
            { status: 401 }
          );
        }
      }
      return NextResponse.json({
        success: true,
        data: {
          id: student.id,
          name: student.name,
          email: student.email,
          role: 'student',
          matricNumber: student.matricNumber,
          departmentId: student.departmentId,
          departmentName: student.department.name,
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
