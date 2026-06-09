import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, lecturerLat, lecturerLng } = await request.json();

    if (!sessionId || lecturerLat === undefined || lecturerLng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Session ID, lecturer latitude, and longitude are required' },
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

    const now = new Date();
    const endsAt = new Date(now.getTime() + (session.duration_minutes as number) * 60000);

    const { data: updatedSessions, error: updateError } = await db
      .from('sessions')
      .update({
        status: 'active',
        started_at: now.toISOString(),
        ends_at: endsAt.toISOString(),
        lecturer_lat: parseFloat(lecturerLat),
        lecturer_lng: parseFloat(lecturerLng),
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
      lecturer_lat: parseFloat(lecturerLat),
      lecturer_lng: parseFloat(lecturerLng),
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
        id: updatedSession.id,
        title: updatedSession.title || session.title,
        status: updatedSession.status,
        startedAt: updatedSession.started_at,
        endsAt: updatedSession.ends_at,
        lecturerLat: updatedSession.lecturer_lat,
        lecturerLng: updatedSession.lecturer_lng,
        courseName: course?.name,
        venueName: venue?.name,
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
