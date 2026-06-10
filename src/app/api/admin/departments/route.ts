import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

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

    const data = (departments || []).map((dept: Record<string, unknown>) => ({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      studentCount: studentCountMap.get(dept.id as string) || 0,
    }));

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
      .insert({ name, code })
      .select();

    if (error || !departments || departments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create department' },
        { status: 500 }
      );
    }

    const department = departments[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: department.id,
        name: department.name,
        code: department.code,
        studentCount: 0,
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
      .update({ name, code })
      .eq('id', id)
      .select();

    if (error || !departments || departments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update department' },
        { status: 500 }
      );
    }

    const department = departments[0] as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: { id: department.id, name: department.name, code: department.code },
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
