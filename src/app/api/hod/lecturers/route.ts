// ============================================================
// checkIn - HOD Lecturers API (CRUD for lecturers in HOD's dept)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';
import { validateLecturerFields } from '@/lib/slit-validation';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the HOD's department from the database using auth.userId.
    // Never trust a client-supplied departmentId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const departmentId = hodLecturer.hod_department_id || hodLecturer.department_id;
    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }

    const { data: lecturers, error } = await db
      .from('lecturers')
      .select('*')
      .eq('department_id', departmentId)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // For each lecturer, fetch their courses
    const lecturersWithCourses = await Promise.all(
      ((lecturers || []) as Record<string, unknown>[]).map(async (lect) => {
        const { data: courses } = await db.from('courses').select('id, name, code, level').eq('lecturer_id', lect.id as string);
        return {
          id: lect.id,
          name: lect.name,
          email: lect.email,
          departmentId: lect.department_id,
          isHod: lect.is_hod ?? false,
          hodDepartmentId: lect.hod_department_id,
          courses: courses || [],
        };
      })
    );

    return NextResponse.json({ success: true, data: lecturersWithCourses });
  } catch (error) {
    console.error('HOD lecturers GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
    }

    // Look up the HOD's department and school from the database using auth.userId.
    // The new lecturer is created in the HOD's own department — never trust
    // client-supplied departmentId/schoolId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id, school_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const departmentId = hodLecturer.hod_department_id || hodLecturer.department_id;
    const schoolId = hodLecturer.school_id;
    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'No school assigned to this HOD' }, { status: 403 });
    }

    // Validate
    const validation = validateLecturerFields({ schoolId: schoolId as string, departmentId: departmentId as string });
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.errors.join(', ') }, { status: 400 });
    }

    // SECURITY: Per-account default password = lecturer's SURNAME in block caps.
    // Username for first login = email.
    const defaultPassword = generateDefaultPassword(name);
    const passwordHash = await hashPassword(defaultPassword);

    // Create lecturer
    const { data: newLecturer, error } = await db.from('lecturers').insert({
      name,
      email,
      department_id: departmentId,
      school_id: schoolId,
      is_hod: false,
      password_hash: passwordHash,
    }).select();

    if (error) {
      if (error.message === 'DUPLICATE' || error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ success: false, error: 'A lecturer with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: (newLecturer?.[0] as Record<string, unknown>)?.id,
        name,
        email,
        departmentId,
        isHod: false,
        defaultPassword,
        username: email,
      },
    });
  } catch (error) {
    console.error('HOD lecturer create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { lecturerId, name, email } = body;

    if (!lecturerId) {
      return NextResponse.json({ success: false, error: 'Lecturer ID is required' }, { status: 400 });
    }

    // SECURITY: Verify the target lecturer belongs to the HOD's department
    // BEFORE mutating. Prevents a malicious HOD from editing lecturers in
    // other departments by supplying an arbitrary lecturerId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const hodDeptId = hodLecturer.hod_department_id || hodLecturer.department_id;
    if (!hodDeptId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }

    const { data: targetLecturers } = await db.from('lecturers').select('id, department_id').eq('id', lecturerId);
    if (!targetLecturers || targetLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecturer not found' }, { status: 404 });
    }
    const targetLecturer = targetLecturers[0] as Record<string, unknown>;
    if (targetLecturer.department_id !== hodDeptId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to modify lecturers outside your department' },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await db.from('lecturers').update(updates).eq('id', lecturerId);

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ success: false, error: 'A lecturer with this email already exists' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: lecturerId, ...updates } });
  } catch (error) {
    console.error('HOD lecturer update error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');

    if (!lecturerId) {
      return NextResponse.json({ success: false, error: 'Lecturer ID is required' }, { status: 400 });
    }

    // SECURITY: Verify the target lecturer belongs to the HOD's department
    // BEFORE deleting. Prevents a malicious HOD from deleting lecturers in
    // other departments by supplying an arbitrary lecturerId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const hodDeptId = hodLecturer.hod_department_id || hodLecturer.department_id;
    if (!hodDeptId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }

    const { data: targetLecturers } = await db.from('lecturers').select('id, department_id, is_hod').eq('id', lecturerId);
    if (!targetLecturers || targetLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecturer not found' }, { status: 404 });
    }
    const targetLecturer = targetLecturers[0] as Record<string, unknown>;
    if (targetLecturer.department_id !== hodDeptId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to delete lecturers outside your department' },
        { status: 403 }
      );
    }

    // Check not HOD
    if (targetLecturer.is_hod) {
      return NextResponse.json({ success: false, error: 'Cannot delete a Head of Department. Remove HOD status first.' }, { status: 403 });
    }

    // Unassign from courses first
    await db.from('courses').update({ lecturer_id: null }).eq('lecturer_id', lecturerId);

    const { error } = await db.from('lecturers').delete().eq('id', lecturerId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Lecturer deleted' });
  } catch (error) {
    console.error('HOD lecturer delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
