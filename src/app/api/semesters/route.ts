import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const semesters = await db.semester.findMany({
      orderBy: { startDate: 'desc' },
    });

    return NextResponse.json({ success: true, data: semesters });
  } catch (error) {
    console.error('Get semesters error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, startDate, endDate } = await request.json();

    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: 'Name, start date, and end date are required' },
        { status: 400 }
      );
    }

    const existing = await db.semester.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Semester with this name already exists' },
        { status: 409 }
      );
    }

    const semester = await db.semester.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });

    return NextResponse.json({ success: true, data: semester });
  } catch (error) {
    console.error('Create semester error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
