import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, lecturerLat, lecturerLng } = await request.json();

    if (!sessionId || lecturerLat === undefined || lecturerLng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Session ID, lecturer latitude, and longitude are required' },
        { status: 400 }
      );
    }

    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'scheduled') {
      return NextResponse.json(
        { success: false, error: `Session cannot be started. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + session.durationMinutes * 60000);

    const updatedSession = await db.session.update({
      where: { id: sessionId },
      data: {
        status: 'active',
        startedAt: now,
        endsAt,
        lecturerLat: parseFloat(lecturerLat),
        lecturerLng: parseFloat(lecturerLng),
      },
      include: {
        course: { select: { id: true, name: true, code: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedSession.id,
        title: updatedSession.title,
        status: updatedSession.status,
        startedAt: updatedSession.startedAt,
        endsAt: updatedSession.endsAt,
        lecturerLat: updatedSession.lecturerLat,
        lecturerLng: updatedSession.lecturerLng,
        courseName: updatedSession.course.name,
        venueName: updatedSession.venue.name,
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
