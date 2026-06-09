import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

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

    const { data: lecturers, error } = await db
      .from('lecturers')
      .insert({ name, email })
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
