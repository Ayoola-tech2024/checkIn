import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, lecturerLat, lecturerLng, useVenueLocation } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { data: sessions } = await db.from('sessions').select('*').eq('id', sessionId);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessions[0] as Record<string, unknown>;

    if (session.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: `Session cannot be started. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    let finalLat: number;
    let finalLng: number;

    if (useVenueLocation || lecturerLat === undefined || lecturerLng === undefined) {
      // Fallback: use venue coordinates when GPS is unavailable (sandbox/demo)
      const { data: venues } = await db
        .from('venues')
        .select('latitude, longitude')
        .eq('id', session.venue_id as string);

      if (!venues || venues.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Venue not found for location fallback' },
          { status: 404 }
        );
      }

      const venue = venues[0] as Record<string, unknown>;
      finalLat = venue.latitude as number;
      finalLng = venue.longitude as number;
    } else {
      finalLat = parseFloat(lecturerLat);
      finalLng = parseFloat(lecturerLng);
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + (session.duration_minutes as number) * 60000);

    const { data: updatedSessions, error: updateError } = await db
      .from('sessions')
      .update({
        status: 'active',
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        lecturer_lat: finalLat,
        lecturer_lng: finalLng,
      })
      .eq('id', sessionId);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to start session' },
        { status: 500 }
      );
    }

    const updatedSession = (updatedSessions?.[0] as Record<string, unknown>) || {
      id: sessionId,
      status: 'active',
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      lecturer_lat: finalLat,
      lecturer_lng: finalLng,
    };

    // Fetch course and venue info
    const [courseResult, venueResult] = await Promise.all([
      db.from('courses').select('id, name, code').eq('id', session.course_id as string),
      db.from('venues').select('id, name').eq('id', session.venue_id as string),
    ]);

    const course = courseResult.data?.[0] as Record<string, unknown> | undefined;
    const venue = venueResult.data?.[0] as Record<string, unknown> | undefined;

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSession.id || sessionId,
        title: updatedSession.title || session.title,
        status: 'active',
        startedAt: updatedSession.started_at || now.toISOString(),
        endsAt: updatedSession.ends_at || endsAt.toISOString(),
        lecturerLat: finalLat,
        lecturerLng: finalLng,
        courseName: course?.name,
        venueName: venue?.name,
        usedVenueLocation: useVenueLocation || lecturerLat === undefined,
      },
    });
  } catch (error) {
    console.error('Start session error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
