import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }
    const lecturerId = auth.userId;

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

    // Fetch related data in parallel (no nested embedding)
    const [studentsResult, sessionDetailsResult] = await Promise.all([
      db.from('students').select('*').in('id', studentIds),
      db.from('sessions').select('*').in('id', reviewSessionIds),
    ]);

    // Manually join departments for students
    const studentDeptIds = (studentsResult.data || []).map((s: Record<string, unknown>) => s.department_id as string).filter(Boolean);
    const uniqueStudentDeptIds = [...new Set(studentDeptIds)];
    let studentDeptMap = new Map<string, Record<string, unknown>>();
    if (uniqueStudentDeptIds.length > 0) {
      const { data: studentDepts } = await db.from('departments').select('id, name').in('id', uniqueStudentDeptIds);
      for (const d of studentDepts || []) {
        studentDeptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Manually join courses and venues for sessions
    const sessionCourseIds = (sessionDetailsResult.data || []).map((s: Record<string, unknown>) => s.course_id as string).filter(Boolean);
    const sessionVenueIds = (sessionDetailsResult.data || []).map((s: Record<string, unknown>) => s.venue_id as string).filter(Boolean);
    const uniqueCourseIds = [...new Set(sessionCourseIds)];
    const uniqueVenueIds = [...new Set(sessionVenueIds)];
    let courseMap = new Map<string, Record<string, unknown>>();
    let venueMap = new Map<string, Record<string, unknown>>();
    const [courseResult, venueResult] = await Promise.all([
      uniqueCourseIds.length > 0 ? db.from('courses').select('id, name, code').in('id', uniqueCourseIds) : Promise.resolve({ data: [] }),
      uniqueVenueIds.length > 0 ? db.from('venues').select('id, name').in('id', uniqueVenueIds) : Promise.resolve({ data: [] }),
    ]);
    for (const c of courseResult.data || []) {
      courseMap.set((c as Record<string, unknown>).id as string, c as Record<string, unknown>);
    }
    for (const v of venueResult.data || []) {
      venueMap.set((v as Record<string, unknown>).id as string, v as Record<string, unknown>);
    }

    const studentMap = new Map(
      (studentsResult.data || []).map((s: Record<string, unknown>) => [s.id, { ...s, departments: studentDeptMap.get(s.department_id as string) || null }])
    );
    const sessionMap = new Map(
      (sessionDetailsResult.data || []).map((s: Record<string, unknown>) => [s.id, { ...s, courses: courseMap.get(s.course_id as string) || null, venues: venueMap.get(s.venue_id as string) || null }])
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
