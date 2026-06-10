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

export async function PUT(request: NextRequest) {
  try {
    const { id, name, latitude, longitude } = await request.json();

    if (!id || !name || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { success: false, error: 'ID, name, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const { data: existing } = await db.from('venues').select('id').eq('name', name);
    if (existing && existing.length > 0 && (existing[0] as Record<string, unknown>).id !== id) {
      return NextResponse.json(
        { success: false, error: 'Venue with this name already exists' },
        { status: 409 }
      );
    }

    const { data: venues, error } = await db
      .from('venues')
      .update({
        name,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      })
      .eq('id', id)
      .select();

    if (error || !venues || venues.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update venue' },
        { status: 500 }
      );
    }

    const venue = venues[0] as Record<string, unknown>;
    return NextResponse.json({
      success: true,
      data: { id: venue.id, name: venue.name, latitude: venue.latitude, longitude: venue.longitude },
    });
  } catch (error) {
    console.error('Update venue error:', error);
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
        { success: false, error: 'Venue ID is required' },
        { status: 400 }
      );
    }

    // Check if venue has sessions
    const { data: sessions } = await db.from('sessions').select('id').eq('venue_id', id);
    if (sessions && sessions.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete venue with scheduled sessions. Remove sessions first.' },
        { status: 409 }
      );
    }

    const { error } = await db.from('venues').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete venue' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete venue error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
