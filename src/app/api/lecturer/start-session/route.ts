import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

// Nigeria geographic bounding box (approximate, generous bounds).
// Latitude: 4°N (Gulf of Guinea) to 14°N (Niger border)
// Longitude: 2°E (Benin border) to 15°E (Cameroon border)
// Rejects (0,0) null island and clearly invalid coordinates.
const NIGERIA_LAT_MIN = 4;
const NIGERIA_LAT_MAX = 14;
const NIGERIA_LNG_MIN = 2;
const NIGERIA_LNG_MAX = 15;

function isWithinNigeria(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= NIGERIA_LAT_MIN &&
    lat <= NIGERIA_LAT_MAX &&
    lng >= NIGERIA_LNG_MIN &&
    lng <= NIGERIA_LNG_MAX
  );
}

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

    const finalLat = parseFloat(lecturerLat);
    const finalLng = parseFloat(lecturerLng);

    // SECURITY: Sanity-check the GPS coords against Nigeria's bounding box.
    // Rejects (0, 0) null island and obviously fake coordinates.
    if (!isWithinNigeria(finalLat, finalLng)) {
      return NextResponse.json(
        {
          success: false,
          error: `GPS coordinates (${finalLat}, ${finalLng}) are outside Nigeria's geographic bounds. Please ensure location services are enabled and retry.`,
        },
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

    // =====================================================================
    // COLLISION CHECK AT START TIME
    // The session-creation route already enforces venue/department overlap
    // guards, but a session created without conflict can become conflicting
    // by the time it's started (another session started in the same venue or
    // targeting the same department in the meantime). Re-validate here.
    // =====================================================================
    const now = new Date();
    const sessionDurationMinutes = session.duration_minutes as number;
    const sessionEnd = new Date(now.getTime() + sessionDurationMinutes * 60000);

    // (a) Venue collision: any OTHER active session using the same venue right now.
    if (session.venue_id) {
      const { data: sameVenueSessions } = await db
        .from('sessions')
        .select('id, title, status, started_at, ends_at, scheduled_at, duration_minutes')
        .eq('venue_id', session.venue_id as string)
        .neq('id', sessionId);

      const conflictingVenue = ((sameVenueSessions || []) as Record<string, unknown>[]).find((s) => {
        if (s.status !== 'active' && s.status !== 'scheduled') return false;
        // For an active session: does its [started_at, ends_at] window overlap [now, sessionEnd]?
        if (s.status === 'active') {
          const existingStart = s.started_at ? new Date(s.started_at as string) : null;
          const existingEnd = s.ends_at ? new Date(s.ends_at as string) : null;
          if (!existingStart || !existingEnd) return false;
          return existingEnd > now && existingStart < sessionEnd;
        }
        // For a scheduled session: does its [scheduled_at, scheduled_at+duration] window overlap?
        const existingStart = new Date(s.scheduled_at as string);
        const existingEnd = new Date(existingStart.getTime() + (s.duration_minutes as number) * 60000);
        return existingEnd > now && existingStart < sessionEnd;
      });

      if (conflictingVenue) {
        return NextResponse.json(
          {
            success: false,
            error: `Venue conflict: another session "${conflictingVenue.title}" is active or scheduled in the same venue at this time.`,
          },
          { status: 409 }
        );
      }
    }

    // (b) Department collision: any OTHER active session targeting the same
    //     department(s) right now.
    const { data: sessionDepts } = await db
      .from('session_departments')
      .select('department_id')
      .eq('session_id', sessionId);
    const deptIds = ((sessionDepts || []) as Record<string, unknown>[]).map(
      (sd) => sd.department_id as string
    );

    if (deptIds.length > 0) {
      // Find session_departments rows pointing at OTHER sessions in the same depts.
      const { data: conflictingLinks } = await db
        .from('session_departments')
        .select('session_id, department_id')
        .in('department_id', deptIds);

      const otherSessionIds = ((conflictingLinks || []) as Record<string, unknown>[])
        .map((l) => l.session_id as string)
        .filter((id) => id !== sessionId);

      if (otherSessionIds.length > 0) {
        const { data: otherSessions } = await db
          .from('sessions')
          .select('id, title, status, started_at, ends_at, scheduled_at, duration_minutes')
          .in('id', otherSessionIds);

        const conflictingDept = ((otherSessions || []) as Record<string, unknown>[]).find((s) => {
          if (s.status !== 'active' && s.status !== 'scheduled') return false;
          if (s.status === 'active') {
            const existingStart = s.started_at ? new Date(s.started_at as string) : null;
            const existingEnd = s.ends_at ? new Date(s.ends_at as string) : null;
            if (!existingStart || !existingEnd) return false;
            return existingEnd > now && existingStart < sessionEnd;
          }
          const existingStart = new Date(s.scheduled_at as string);
          const existingEnd = new Date(existingStart.getTime() + (s.duration_minutes as number) * 60000);
          return existingEnd > now && existingStart < sessionEnd;
        });

        if (conflictingDept) {
          return NextResponse.json(
            {
              success: false,
              error: `Department conflict: another session "${conflictingDept.title}" is active or scheduled for the same department(s) at this time.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const endsAt = new Date(now.getTime() + sessionDurationMinutes * 60000);

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
