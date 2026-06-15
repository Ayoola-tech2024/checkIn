// ============================================================
// checkIn - HOD Lecturers API (CRUD for lecturers in HOD's dept)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';
import { validateLecturerFields } from '@/lib/slit-validation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');

    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'Department ID is required' }, { status: 400 });
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
      (lecturers || []).map(async (lect: Record<string, unknown>) => {
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
    const body = await request.json();
    const { name, email, departmentId, schoolId } = body;

    if (!name || !email || !departmentId || !schoolId) {
      return NextResponse.json(
        { success: false, error: 'Name, email, department, and school are required' },
        { status: 400 }
      );
    }

    // Validate
    const validation = validateLecturerFields({ schoolId, departmentId });
    if (!validation.valid) {
      return NextResponse.json({ success: false, error: validation.errors.join(', ') }, { status: 400 });
    }

    // Hash default password
    const defaultPassword = generateDefaultPassword();
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
      },
    });
  } catch (error) {
    console.error('HOD lecturer create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { lecturerId, name, email } = body;

    if (!lecturerId) {
      return NextResponse.json({ success: false, error: 'Lecturer ID is required' }, { status: 400 });
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
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');

    if (!lecturerId) {
      return NextResponse.json({ success: false, error: 'Lecturer ID is required' }, { status: 400 });
    }

    // Check not HOD
    const { data: lecturers } = await db.from('lecturers').select('is_hod').eq('id', lecturerId);
    if (lecturers && lecturers.length > 0 && (lecturers[0] as Record<string, unknown>).is_hod) {
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
