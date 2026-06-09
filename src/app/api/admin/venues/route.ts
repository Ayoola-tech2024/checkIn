import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
  try {
    const { data: venues, error } = await db
      .from('venues')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Map snake_case to camelCase for frontend compatibility
    const data = (venues || []).map((v: Record<string, unknown>) => ({
      id: v.id,
      name: v.name,
      latitude: v.latitude,
      longitude: v.longitude,
      createdAt: v.created_at,
      updatedAt: v.updated_at,
    }));

    return NextResponse.json({ success: true, data });
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

    const { data: existing } = await db.from('venues').select('id').eq('name', name);
    if (existing && existing.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Venue with this name already exists' },
        { status: 409 }
      );
    }

    const { data: venues, error } = await db
      .from('venues')
      .insert({
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      })
      .select();

    if (error || !venues || venues.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create venue' },
        { status: 500 }
      );
    }

    const venue = venues[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: venue.id,
        name: venue.name,
        latitude: venue.latitude,
        longitude: venue.longitude,
        createdAt: venue.created_at,
        updatedAt: venue.updated_at,
      },
    });
  } catch (error) {
    console.error('Create venue error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
