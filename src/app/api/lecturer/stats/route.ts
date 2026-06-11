import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');

    if (!lecturerId) {
      return NextResponse.json(
        { success: false, error: 'Lecturer ID is required' },
        { status: 400 }
      );
    }

    // Fetch sessions for this lecturer
    const { data: sessions, error: sessionError } = await db
      .from('sessions')
      .select('id, status')
      .eq('lecturer_id', lecturerId);

    if (sessionError) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Fetch courses count
    const { data: courses, error: courseError } = await db
      .from('courses')
      .select('id')
      .eq('lecturer_id', lecturerId);

    if (courseError) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    const totalSessions = sessions?.length || 0;
    const activeSessions = sessions?.filter((s: Record<string, unknown>) => s.status === 'active').length || 0;
    const completedSessions = sessions?.filter((s: Record<string, unknown>) => s.status === 'completed').length || 0;
    const scheduledSessions = sessions?.filter((s: Record<string, unknown>) => s.status === 'scheduled').length || 0;
    const totalCourses = courses?.length || 0;

    // Fetch attendance stats for all sessions of this lecturer
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let totalCheckIns = 0;

    if (sessions && sessions.length > 0) {
      const sessionIds = sessions.map((s: Record<string, unknown>) => s.id as string);
      const { data: attendances } = await db
        .from('attendances')
        .select('status')
        .in('session_id', sessionIds);

      if (attendances && attendances.length > 0) {
        for (const a of attendances) {
          const rec = a as Record<string, unknown>;
          const status = rec.status as string;
          totalCheckIns++;
          if (status === 'present') totalPresent++;
          else if (status === 'absent') totalAbsent++;
          else if (status === 'pending_review' || status === 'pending') totalPending++;
          else if (status === 'rejected_location' || status === 'rejected_identity') totalRejected++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSessions,
        activeSessions,
        completedSessions,
        scheduledSessions,
        totalCourses,
        totalPresent,
        totalAbsent,
        totalPending,
        totalRejected,
        totalCheckIns,
      },
    });
  } catch (error) {
    console.error('Get lecturer stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
