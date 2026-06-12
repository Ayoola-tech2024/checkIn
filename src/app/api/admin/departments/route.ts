import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { SLIT_SCHOOL_ID, SLIT_DEPT_CODES, SLIT_DEPT_NAMES } from '@/lib/constants';

export async function GET() {
  try {
    const { data: departments, error } = await db
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Manually count students per department
    const deptIds = (departments || []).map((d: Record<string, unknown>) => d.id as string);
    let studentCountMap = new Map<string, number>();
    if (deptIds.length > 0) {
      const { data: studentsData } = await db.from('students').select('id, department_id').in('department_id', deptIds);
      for (const s of studentsData || []) {
        const rec = s as Record<string, unknown>;
        const dId = rec.department_id as string;
        studentCountMap.set(dId, (studentCountMap.get(dId) || 0) + 1);
      }
    }

    // Fetch school info for departments
    const schoolIds = [...new Set((departments || []).map((d: Record<string, unknown>) => d.school_id as string).filter(Boolean))];
    const schoolMap = new Map<string, { name: string; code: string }>();
    if (schoolIds.length > 0) {
      const { data: schoolData } = await db
        .from('schools')
        .select('id, name, code')
        .in('id', schoolIds);
      for (const s of schoolData || []) {
        schoolMap.set((s as Record<string, unknown>).id as string, { name: (s as Record<string, unknown>).name as string, code: (s as Record<string, unknown>).code as string });
      }
    }

    // Fetch HOD info: find lecturers with is_hod=true and hod_department_id matching each department
    const hodResult = await db
      .from('lecturers')
      .select('id, name, hod_department_id')
      .eq('is_hod', true);

    const hodMap = new Map<string, string>();
    for (const h of hodResult.data || []) {
      const rec = h as Record<string, unknown>;
      if (rec.hod_department_id) {
        hodMap.set(rec.hod_department_id as string, rec.name as string);
      }
    }

    const data = (departments || []).map((dept: Record<string, unknown>) => {
      const school = schoolMap.get(dept.school_id as string);
      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        schoolId: dept.school_id,
        schoolName: school?.name,
        schoolCode: school?.code,
        studentCount: studentCountMap.get(dept.id as string) || 0,
        hodName: hodMap.get(dept.id as string) || undefined,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get departments error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, code } = await request.json();

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Validate department name and code against SLIT approved lists
    if (!SLIT_DEPT_CODES.includes(code as typeof SLIT_DEPT_CODES[number])) {
      return NextResponse.json(
        { success: false, error: `Department code "${code}" is not an approved SLIT department. Valid codes: ${SLIT_DEPT_CODES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!SLIT_DEPT_NAMES.includes(name as typeof SLIT_DEPT_NAMES[number])) {
      return NextResponse.json(
        { success: false, error: `Department name "${name}" is not an approved SLIT department. Valid names: ${SLIT_DEPT_NAMES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for existing department with same name or code
    const { data: existingByName } = await db
      .from('departments')
      .select('id')
      .eq('name', name);

    const { data: existingByCode } = await db
      .from('departments')
      .select('id')
      .eq('code', code);

    if ((existingByName && existingByName.length > 0) || (existingByCode && existingByCode.length > 0)) {
      return NextResponse.json(
        { success: false, error: 'Department with this name or code already exists' },
        { status: 409 }
      );
    }

    const { data: departments, error } = await db
      .from('departments')
      .insert({ name, code, school_id: SLIT_SCHOOL_ID })
      .select();

    if (error || !departments || departments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create department' },
        { status: 500 }
      );
    }

    const department = departments[0] as Record<string, unknown>;

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', SLIT_SCHOOL_ID);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

    return NextResponse.json({
      success: true,
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
        schoolId: department.school_id,
        schoolName,
        schoolCode,
        studentCount: 0,
        hodName: undefined,
      },
    });
  } catch (error) {
    console.error('Create department error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, code } = await request.json();

    if (!id || !name || !code) {
      return NextResponse.json(
        { success: false, error: 'ID, name, and code are required' },
        { status: 400 }
      );
    }

    // Validate department name and code against SLIT approved lists
    if (!SLIT_DEPT_CODES.includes(code as typeof SLIT_DEPT_CODES[number])) {
      return NextResponse.json(
        { success: false, error: `Department code "${code}" is not an approved SLIT department. Valid codes: ${SLIT_DEPT_CODES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!SLIT_DEPT_NAMES.includes(name as typeof SLIT_DEPT_NAMES[number])) {
      return NextResponse.json(
        { success: false, error: `Department name "${name}" is not an approved SLIT department. Valid names: ${SLIT_DEPT_NAMES.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicate name/code (excluding current)
    const { data: existingByName } = await db
      .from('departments')
      .select('id')
      .eq('name', name);

    const { data: existingByCode } = await db
      .from('departments')
      .select('id')
      .eq('code', code);

    if ((existingByName && existingByName.length > 0 && (existingByName[0] as Record<string, unknown>).id !== id) ||
        (existingByCode && existingByCode.length > 0 && (existingByCode[0] as Record<string, unknown>).id !== id)) {
      return NextResponse.json(
        { success: false, error: 'Department with this name or code already exists' },
        { status: 409 }
      );
    }

    const { data: departments, error } = await db
      .from('departments')
      .update({ name, code, school_id: SLIT_SCHOOL_ID })
      .eq('id', id)
      .select();

    if (error || !departments || departments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update department' },
        { status: 500 }
      );
    }

    const department = departments[0] as Record<string, unknown>;

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', department.school_id as string);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

    // Fetch HOD name for this department
    let hodName: string | undefined;
    const { data: hodResult } = await db.from('lecturers').select('name').eq('is_hod', true).eq('hod_department_id', id);
    if (hodResult && hodResult.length > 0) {
      hodName = (hodResult[0] as Record<string, unknown>).name as string;
    }

    return NextResponse.json({
      success: true,
      data: { id: department.id, name: department.name, code: department.code, schoolId: department.school_id, schoolName, schoolCode, hodName },
    });
  } catch (error) {
    console.error('Update department error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Department ID is required' },
        { status: 400 }
      );
    }

    // Check if department has students
    const { data: students } = await db.from('students').select('id').eq('department_id', id);
    if (students && students.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete department with students. Remove students first.' },
        { status: 409 }
      );
    }

    // Delete course_departments links first
    await db.from('course_departments').delete().eq('department_id', id);
    // Delete session_departments links
    await db.from('session_departments').delete().eq('department_id', id);

    const { error } = await db.from('departments').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete department' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete department error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
