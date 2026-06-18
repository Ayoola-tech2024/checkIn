// ============================================================
// checkIn - HOD Profile API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Use the authenticated user's ID — never trust a client-supplied lecturerId.
    const lecturerId = auth.userId;

    const { data: lecturers, error } = await db.from('lecturers').select('*').eq('id', lecturerId);
    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecturer not found' }, { status: 404 });
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    if (!lecturer.is_hod) {
      return NextResponse.json({ success: false, error: 'Not a Head of Department' }, { status: 403 });
    }

    // Fetch department info
    let department: Record<string, unknown> | null = null;
    const deptId = (lecturer.hod_department_id || lecturer.department_id) as string;
    if (deptId) {
      const { data: depts } = await db.from('departments').select('*').eq('id', deptId);
      if (depts && depts.length > 0) {
        const dept = depts[0] as Record<string, unknown>;
        // Fetch school info
        let schoolName: string | undefined;
        let schoolCode: string | undefined;
        if (dept.school_id) {
          const { data: schools } = await db.from('schools').select('name, code').eq('id', dept.school_id as string);
          schoolName = (schools?.[0] as Record<string, unknown>)?.name as string;
          schoolCode = (schools?.[0] as Record<string, unknown>)?.code as string;
        }
        department = {
          id: dept.id,
          name: dept.name,
          code: dept.code,
          schoolId: dept.school_id,
          schoolName,
          schoolCode,
        };
      }
    }

    // Count lecturers in department
    let lecturerCount = 0;
    let courseCount = 0;
    let studentCount = 0;

    if (deptId) {
      const { data: deptLecturers } = await db.from('lecturers').select('id').eq('department_id', deptId);
      lecturerCount = deptLecturers?.length || 0;

      const { data: deptCourses } = await db.from('courses').select('id').eq('department_id', deptId);
      courseCount = deptCourses?.length || 0;

      const { data: deptStudents } = await db.from('students').select('id').eq('department_id', deptId);
      studentCount = deptStudents?.length || 0;
    }

    return NextResponse.json({
      success: true,
      data: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        isHod: lecturer.is_hod,
        hodDepartmentId: lecturer.hod_department_id,
        hodDepartmentName: department?.name,
        department,
        lecturerCount,
        courseCount,
        studentCount,
      },
    });
  } catch (error) {
    console.error('HOD profile error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
