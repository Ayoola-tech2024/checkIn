import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
  try {
    const { data: lecturers, error } = await db
      .from('lecturers')
      .select('*, courses:courses(id, name, code, level)')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    const data = (lecturers || []).map((l: Record<string, unknown>) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      courses: l.courses || [],
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
