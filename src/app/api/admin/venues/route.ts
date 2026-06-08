import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const venues = await db.venue.findMany({
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, data: venues });
  } catch (error) {
    console.error('Get venues error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { name, latitude, longitude } = await request.json();

    if (!name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const existing = await db.venue.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Venue with this name already exists' },
        { status: 409 }
      );
    }

    const venue = await db.venue.create({
      data: {
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
    });

    return NextResponse.json({ success: true, data: venue });
  } catch (error) {
    console.error('Create venue error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
