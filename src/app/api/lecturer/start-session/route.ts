import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, lecturerLat, lecturerLng } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // SECURITY: Require real GPS coordinates — no venue fallback.
    if (lecturerLat === undefined || lecturerLng === undefined || isNaN(parseFloat(lecturerLat)) || isNaN(parseFloat(lecturerLng))) {
      return NextResponse.json(
        { success: false, error: 'GPS coordinates are required to start a session. Please enable location services.' },
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

    // SECURITY: Verify the authenticated lecturer owns this session.
    if (session.lecturer_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to start this session' },
        { status: 403 }
      );
    }

    if (session.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: `Session cannot be started. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    const finalLat = parseFloat(lecturerLat);
    const finalLng = parseFloat(lecturerLng);

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
