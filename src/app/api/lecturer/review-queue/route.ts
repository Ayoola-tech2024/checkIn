import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // Get all sessions for this lecturer
    const sessions = await db.session.findMany({
      where: { lecturerId },
      select: { id: true },
    });

    const sessionIds = sessions.map((s) => s.id);

    if (sessionIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Find all pending_review attendances for these sessions
    const pendingReviews = await db.attendance.findMany({
      where: {
        sessionId: { in: sessionIds },
        status: 'pending_review',
      },
      include: {
        student: {
          include: {
            department: { select: { id: true, name: true } },
          },
        },
        session: {
          include: {
            course: { select: { id: true, name: true, code: true } },
            venue: { select: { name: true } },
          },
        },
      },
      orderBy: { checkInTime: 'desc' },
    });

    const data = pendingReviews.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: a.student.name,
      matricNumber: a.student.matricNumber,
      departmentName: a.student.department.name,
      sessionId: a.sessionId,
      sessionTitle: a.session.title,
      courseName: a.session.course.name,
      venueName: a.session.venue.name,
      similarityScore: a.similarityScore,
      checkInTime: a.checkInTime,
      studentLat: a.studentLat,
      studentLng: a.studentLng,
      selfieData: a.selfieData,
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get review queue error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
