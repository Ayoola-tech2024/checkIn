import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';
import { validateLecturerFields } from '@/lib/slit-validation';
import { SLIT_SCHOOL_ID } from '@/lib/constants';
import { getAuthUser } from '@/lib/auth-context';

function requireAdmin(request: NextRequest) {
  // DEFENSE-IN-DEPTH: middleware already enforces admin role, but verify
  // here too in case middleware is ever bypassed.
  const auth = getAuthUser(request);
  if (!auth) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  if (auth.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { ok: true, auth };
}

export async function GET(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { data: lecturers, error } = await db
      .from('lecturers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Manually fetch courses for all lecturers
    const lecturerIds = (lecturers || []).map((l: Record<string, unknown>) => l.id as string);

    let coursesByLecturer = new Map<string, Record<string, unknown>[]>();
    if (lecturerIds.length > 0) {
      const { data: allCourses } = await db
        .from('courses')
        .select('*')
        .in('lecturer_id', lecturerIds);

      for (const c of allCourses || []) {
        const rec = c as Record<string, unknown>;
        const lid = rec.lecturer_id as string;
        if (!coursesByLecturer.has(lid)) coursesByLecturer.set(lid, []);
        coursesByLecturer.get(lid)!.push(rec);
      }
    }

    // Fetch department names for lecturers with department_id
    const deptIds = [...new Set(
      (lecturers || [])
        .map((l: Record<string, unknown>) => l.department_id as string)
        .filter(Boolean)
    )];
    const deptMap = new Map<string, string>();
    if (deptIds.length > 0) {
      const { data: depts } = await db
        .from('departments')
        .select('id, name')
        .in('id', deptIds);
      for (const d of depts || []) {
        deptMap.set((d as Record<string, unknown>).id as string, (d as Record<string, unknown>).name as string);
      }
    }

    // Fetch HOD department names for lecturers with hod_department_id
    const hodDeptIds = [...new Set(
      (lecturers || [])
        .map((l: Record<string, unknown>) => l.hod_department_id as string)
        .filter(Boolean)
    )];
    const hodDeptMap = new Map<string, string>();
    if (hodDeptIds.length > 0) {
      const { data: hodDepts } = await db
        .from('departments')
        .select('id, name')
        .in('id', hodDeptIds);
      for (const d of hodDepts || []) {
        hodDeptMap.set((d as Record<string, unknown>).id as string, (d as Record<string, unknown>).name as string);
      }
    }

    // Fetch school info
    const schoolIds = [...new Set(
      (lecturers || [])
        .map((l: Record<string, unknown>) => l.school_id as string)
        .filter(Boolean)
    )];
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

    const data = (lecturers || []).map((l: Record<string, unknown>) => {
      const school = schoolMap.get(l.school_id as string);
      return {
        id: l.id,
        name: l.name,
        email: l.email,
        schoolId: l.school_id,
        schoolName: school?.name,
        schoolCode: school?.code,
        departmentId: l.department_id,
        departmentName: l.department_id ? deptMap.get(l.department_id as string) : undefined,
        isHod: l.is_hod ?? false,
        hodDepartmentId: l.hod_department_id,
        hodDepartmentName: l.hod_department_id ? hodDeptMap.get(l.hod_department_id as string) : undefined,
        courses: (coursesByLecturer.get(l.id as string) || []).map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          level: typeof c.level === 'number' ? c.level : (typeof c.level === 'string' ? parseInt(c.level as string, 10) || 0 : 0),
        })),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get lecturers error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { name, email, departmentId, isHod, hodDepartmentId } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Validate SLIT fields
    const validation = validateLecturerFields({ departmentId, isHod, hodDepartmentId });
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join('; ') },
        { status: 400 }
      );
    }

    // Validate department_id exists if provided
    if (departmentId) {
      const { data: depts } = await db.from('departments').select('id, name').eq('id', departmentId);
      if (!depts || depts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Validate hod_department_id exists if isHod is true
    if (isHod && hodDepartmentId) {
      const { data: hodDepts } = await db.from('departments').select('id, name').eq('id', hodDepartmentId);
      if (!hodDepts || hodDepts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'HOD department not found' },
          { status: 404 }
        );
      }
    }

    const { data: existing } = await db
      .from('lecturers')
      .select('id')
      .eq('email', email);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Lecturer with this email already exists' },
        { status: 409 }
      );
    }

    // SECURITY: Per-account default password = lecturer's SURNAME in block caps.
    // Username for first login = email.
    const defaultPassword = generateDefaultPassword(name);
    const passwordHash = await hashPassword(defaultPassword);

    const insertData: Record<string, unknown> = {
      name,
      email,
      password_hash: passwordHash,
      school_id: SLIT_SCHOOL_ID,
      is_hod: isHod ?? false,
    };
    if (departmentId) {
      insertData.department_id = departmentId;
    }
    if (isHod && hodDepartmentId) {
      insertData.hod_department_id = hodDepartmentId;
    }

    const { data: lecturers, error } = await db
      .from('lecturers')
      .insert(insertData)
      .select();

    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create lecturer' },
        { status: 500 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    // Fetch department name if department_id exists
    let departmentName: string | undefined;
    if (lecturer.department_id) {
      const { data: depts } = await db.from('departments').select('name').eq('id', lecturer.department_id as string);
      departmentName = (depts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch HOD department name if hod_department_id exists
    let hodDeptName: string | undefined;
    if (lecturer.hod_department_id) {
      const { data: hodDepts } = await db.from('departments').select('name').eq('id', lecturer.hod_department_id as string);
      hodDeptName = (hodDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', SLIT_SCHOOL_ID);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

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
        departmentName,
        isHod: lecturer.is_hod ?? false,
        hodDepartmentId: lecturer.hod_department_id,
        hodDepartmentName: hodDeptName,
        defaultPassword,
        username: email,
        courses: [],
      },
    });
  } catch (error) {
    console.error('Create lecturer error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { id, name, email, departmentId, isHod, hodDepartmentId } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json(
        { success: false, error: 'ID, name, and email are required' },
        { status: 400 }
      );
    }

    // Validate SLIT fields
    const validation = validateLecturerFields({ departmentId, isHod, hodDepartmentId });
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join('; ') },
        { status: 400 }
      );
    }

    // Validate department_id exists if provided
    if (departmentId) {
      const { data: depts } = await db.from('departments').select('id').eq('id', departmentId);
      if (!depts || depts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Validate hod_department_id exists if isHod is true
    if (isHod && hodDepartmentId) {
      const { data: hodDepts } = await db.from('departments').select('id').eq('id', hodDepartmentId);
      if (!hodDepts || hodDepts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'HOD department not found' },
          { status: 404 }
        );
      }
    }

    // Check if email is taken by another lecturer
    const { data: existing } = await db
      .from('lecturers')
      .select('id')
      .eq('email', email);

    if (existing && existing.length > 0 && (existing[0] as Record<string, unknown>).id !== id) {
      return NextResponse.json(
        { success: false, error: 'Email is already in use by another lecturer' },
        { status: 409 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = { name, email };
    if (departmentId !== undefined) {
      updateData.department_id = departmentId || null;
    }
    if (isHod !== undefined) {
      updateData.is_hod = isHod;
    }
    if (isHod && hodDepartmentId) {
      updateData.hod_department_id = hodDepartmentId;
    } else if (isHod === false) {
      updateData.hod_department_id = null;
    }

    const { data: lecturers, error } = await db
      .from('lecturers')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update lecturer' },
        { status: 500 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    // Fetch department name if department_id exists
    let departmentName: string | undefined;
    if (lecturer.department_id) {
      const { data: depts } = await db.from('departments').select('name').eq('id', lecturer.department_id as string);
      departmentName = (depts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch HOD department name if hod_department_id exists
    let hodDeptName: string | undefined;
    if (lecturer.hod_department_id) {
      const { data: hodDepts } = await db.from('departments').select('name').eq('id', lecturer.hod_department_id as string);
      hodDeptName = (hodDepts?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', lecturer.school_id as string);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

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
        departmentName,
        isHod: lecturer.is_hod ?? false,
        hodDepartmentId: lecturer.hod_department_id,
        hodDepartmentName: hodDeptName,
      },
    });
  } catch (error) {
    console.error('Update lecturer error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Lecturer ID is required' },
        { status: 400 }
      );
    }

    // Check if lecturer has courses
    const { data: courses } = await db.from('courses').select('id').eq('lecturer_id', id);
    if (courses && courses.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete lecturer with assigned courses. Remove course assignments first.' },
        { status: 409 }
      );
    }

    const { error } = await db.from('lecturers').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete lecturer' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete lecturer error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
