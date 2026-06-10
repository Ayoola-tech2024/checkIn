import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';

export async function GET() {
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

    const data = (lecturers || []).map((l: Record<string, unknown>) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      courses: (coursesByLecturer.get(l.id as string) || []).map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        level: c.level,
      })),
    }));

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
  try {
    const { name, email } = await request.json();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required' },
        { status: 400 }
      );
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

    // Set default password at creation time
    const defaultPassword = generateDefaultPassword();
    const passwordHash = await hashPassword(defaultPassword);

    const { data: lecturers, error } = await db
      .from('lecturers')
      .insert({ name, email, password_hash: passwordHash })
      .select();

    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create lecturer' },
        { status: 500 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        defaultPassword,
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
  try {
    const { id, name, email } = await request.json();

    if (!id || !name || !email) {
      return NextResponse.json(
        { success: false, error: 'ID, name, and email are required' },
        { status: 400 }
      );
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

    const { data: lecturers, error } = await db
      .from('lecturers')
      .update({ name, email })
      .eq('id', id)
      .select();

    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update lecturer' },
        { status: 500 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: { id: lecturer.id, name: lecturer.name, email: lecturer.email },
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
