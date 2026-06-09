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

    // Get all sessions for this lecturer
    const { data: sessions } = await db
      .from('sessions')
      .select('id')
      .eq('lecturer_id', lecturerId);

    const sessionIds = (sessions || []).map((s: Record<string, unknown>) => s.id as string);

    if (sessionIds.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Find all pending_review attendances for these sessions
    const { data: pendingReviews, error } = await db
      .from('attendances')
      .select('*')
      .in('session_id', sessionIds)
      .eq('status', 'pending_review')
      .order('check_in_time', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!pendingReviews || pendingReviews.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Collect all unique student_ids and session_ids
    const studentIds = [...new Set(pendingReviews.map((a: Record<string, unknown>) => a.student_id as string))];
    const reviewSessionIds = [...new Set(pendingReviews.map((a: Record<string, unknown>) => a.session_id as string))];

    // Fetch related data in parallel
    const [studentsResult, sessionDetailsResult] = await Promise.all([
      db.from('students').select('*, departments(id, name)').in('id', studentIds),
      db.from('sessions').select('*, courses(id, name, code), venues(name)').in('id', reviewSessionIds),
    ]);

    const studentMap = new Map(
      (studentsResult.data || []).map((s: Record<string, unknown>) => [s.id, s])
    );
    const sessionMap = new Map(
      (sessionDetailsResult.data || []).map((s: Record<string, unknown>) => [s.id, s])
    );

    const data = pendingReviews.map((a: Record<string, unknown>) => {
      const student = studentMap.get(a.student_id as string) as Record<string, unknown> | undefined;
      const studentDept = student?.departments as Record<string, unknown> | null;
      const session = sessionMap.get(a.session_id as string) as Record<string, unknown> | undefined;
      const course = session?.courses as Record<string, unknown> | null;
      const venue = session?.venues as Record<string, unknown> | null;

      return {
        id: a.id,
        studentId: a.student_id,
        studentName: student?.name,
        matricNumber: student?.matric_number,
        departmentName: studentDept?.name,
        sessionId: a.session_id,
        sessionTitle: session?.title,
        courseName: course?.name,
        venueName: venue?.name,
        similarityScore: a.similarity_score,
        checkInTime: a.check_in_time,
        studentLat: a.student_lat,
        studentLng: a.student_lng,
        selfieData: a.selfie_data,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get review queue error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
