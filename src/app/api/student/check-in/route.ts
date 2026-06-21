import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { haversineDistance } from '@/lib/geo';
import { calculateSimilarity, getAttendanceStatusFromSimilarity, validateDescriptor } from '@/lib/face-utils';
import { getAuthUser } from '@/lib/auth-context';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY: Use the authenticated student's ID, not a client-supplied one.
    const studentId = auth.userId;
    const {
      sessionId,
      studentLat,
      studentLng,
      facialDescriptor,
      selfieData,
    } = await request.json();

    if (!sessionId || studentLat === undefined || studentLng === undefined || !facialDescriptor) {
      return NextResponse.json(
        { success: false, error: 'Session ID, coordinates, and facial descriptor are required' },
        { status: 400 }
      );
    }

    // SECURITY: Validate the incoming facial descriptor shape & length before
    // doing any DB work. A malformed descriptor would otherwise silently
    // produce similarity=0 (per calculateSimilarity's length-mismatch guard)
    // and route the student to `rejected_identity` with no diagnostic.
    const descriptorError = validateDescriptor(facialDescriptor);
    if (descriptorError) {
      return NextResponse.json(
        { success: false, error: descriptorError },
        { status: 400 }
      );
    }

    // SECURITY: Sanity-check student GPS coords. Reject null-island (0,0),
    // non-numeric, and out-of-Nigeria coords up front with a 400, rather
    // than silently creating a rejected_location row (which would spam the
    // attendance table and obscure real attempts). Mirrors start-session's
    // isWithinNigeria guard.
    const parsedStudentLat = typeof studentLat === 'number'
      ? studentLat
      : parseFloat(String(studentLat));
    const parsedStudentLng = typeof studentLng === 'number'
      ? studentLng
      : parseFloat(String(studentLng));
    if (!Number.isFinite(parsedStudentLat) || !Number.isFinite(parsedStudentLng)) {
      return NextResponse.json(
        { success: false, error: 'Invalid GPS coordinates. Please enable location services and retry.' },
        { status: 400 }
      );
    }
    if (parsedStudentLat === 0 && parsedStudentLng === 0) {
      return NextResponse.json(
        { success: false, error: 'GPS coordinates unavailable (0,0). Please enable location services and retry.' },
        { status: 400 }
      );
    }
    if (
      parsedStudentLat < 4 || parsedStudentLat > 14 ||
      parsedStudentLng < 2 || parsedStudentLng > 15
    ) {
      return NextResponse.json(
        { success: false, error: 'GPS coordinates are outside Nigeria. Check-in is only available within Nigeria.' },
        { status: 400 }
      );
    }

    // Get the student
    const { data: students } = await db.from('students').select('*').eq('id', studentId);

    if (!students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    if (!student.activated) {
      return NextResponse.json(
        { success: false, error: 'Account not activated. Please activate your account first.' },
        { status: 403 }
      );
    }

    // Get the session
    const { data: sessions } = await db.from('sessions').select('*').eq('id', sessionId);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    const session = sessions[0] as Record<string, unknown>;

    if (session.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Session is not active. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // LEVEL GUARD: a session is targeted at a specific academic level
    // (e.g. 100, 200, 300). A student must NOT check in to a session whose
    // level does not match their own — otherwise a 100-level student could
    // mark attendance for a 300-level class in their department. This check
    // is the server-side backstop for the level filter in the student
    // sessions feed; the student's feed should never have shown them this
    // session, but a determined client could still POST a check-in directly.
    const sessionLevel = typeof session.level === 'number'
      ? session.level
      : parseInt(String(session.level ?? '0'), 10);
    const studentLevel = typeof student.level === 'number'
      ? student.level
      : parseInt(String(student.level ?? '0'), 10);
    if (sessionLevel && studentLevel && sessionLevel !== studentLevel) {
      return NextResponse.json(
        {
          success: false,
          error: `This session is for ${sessionLevel}-level students. Your level (${studentLevel}) does not match.`,
        },
        { status: 403 }
      );
    }

    // Check if already checked in
    const { data: existingAttendances } = await db
      .from('attendances')
      .select('*')
      .eq('student_id', studentId)
      .eq('session_id', sessionId);

    const existingAttendance = existingAttendances?.[0] as Record<string, unknown> | undefined;

    if (existingAttendance && (existingAttendance.status === 'present' || existingAttendance.status === 'pending_review')) {
      return NextResponse.json({
        success: false,
        error: 'Already checked in for this session',
        data: {
          status: existingAttendance.status,
          similarityScore: existingAttendance.similarity_score,
        },
      }, { status: 409 });
    }

    // ===== TIER 1: Location Validation =====
    // SECURITY: No venue fallback. The lecturer MUST have provided real GPS
    // when starting the session. If lecturer_lat is null, the session
    // was not properly started — reject the check-in.
    const lecturerLat = session.lecturer_lat as number | null;
    const lecturerLng = session.lecturer_lng as number | null;

    if (lecturerLat === null || lecturerLng === null) {
      return NextResponse.json(
        { success: false, error: 'Session location not available. The lecturer must start the session with GPS enabled.' },
        { status: 400 }
      );
    }

    const distance = haversineDistance(
      parsedStudentLat,
      parsedStudentLng,
      lecturerLat,
      lecturerLng
    );
    const isWithinLocation = distance <= (session.distance_threshold as number);

    if (!isWithinLocation) {
      // Location check failed - record as rejected_location
      const now = new Date().toISOString();
      const attendanceData = {
        status: 'rejected_location',
        similarity_score: 0,
        student_lat: parsedStudentLat,
        student_lng: parsedStudentLng,
        selfie_data: selfieData || null,
        check_in_time: now,
      };

      if (existingAttendance) {
        await db.from('attendances').update(attendanceData).eq('id', existingAttendance.id as string);
      } else {
        await db.from('attendances').insert({
          student_id: studentId,
          session_id: sessionId,
          ...attendanceData,
        });
      }

      return NextResponse.json({
        success: false,
        error: `You are ${Math.round(distance)}m away from the venue. Must be within ${session.distance_threshold}m.`,
        data: {
          status: 'rejected_location',
          distance: Math.round(distance * 100) / 100,
          threshold: session.distance_threshold,
          message: `Too far from venue (${Math.round(distance)}m vs ${session.distance_threshold}m required)`,
        },
      }, { status: 400 });
    }

    // ===== TIER 2: Facial Recognition Validation =====
    if (!student.facial_data) {
      return NextResponse.json(
        { success: false, error: 'No facial data on file. Please re-activate your account with face verification.' },
        { status: 400 }
      );
    }

    let storedDescriptor: number[];
    try {
      const facialObj = JSON.parse(student.facial_data as string);
      storedDescriptor = facialObj.descriptor || facialObj;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid facial data on file. Please re-activate your account.' },
        { status: 400 }
      );
    }

    // Validate the STORED descriptor too — a corrupted/empty activation could
    // otherwise brick this student's check-in forever with no diagnostic.
    const storedDescriptorError = validateDescriptor(storedDescriptor);
    if (storedDescriptorError) {
      return NextResponse.json(
        { success: false, error: 'Corrupted facial data on file. Please contact admin to re-activate your account.' },
        { status: 500 }
      );
    }

    const similarityScore = calculateSimilarity(storedDescriptor, facialDescriptor);
    const result = getAttendanceStatusFromSimilarity(similarityScore);
    const attendanceStatus = result.status;

    const now = new Date().toISOString();
    const attendanceData = {
      status: attendanceStatus,
      similarity_score: similarityScore,
      student_lat: parsedStudentLat,
      student_lng: parsedStudentLng,
      selfie_data: selfieData || null,
      check_in_time: now,
    };

    let attendance: Record<string, unknown>;
    if (existingAttendance) {
      const { data: updated } = await db
        .from('attendances')
        .update(attendanceData)
        .eq('id', existingAttendance.id as string);
      attendance = (updated?.[0] as Record<string, unknown>) || { id: existingAttendance.id };
    } else {
      const { data: inserted } = await db
        .from('attendances')
        .insert({
          student_id: studentId,
          session_id: sessionId,
          ...attendanceData,
        })
        .select();
      attendance = (inserted?.[0] as Record<string, unknown>) || { id: 'unknown' };
    }

    const stage = attendanceStatus === 'present' ? 'complete' : 'biometric';

    let message: string;
    if (attendanceStatus === 'present') {
      message = 'Check-in successful! Identity verified.';
    } else if (attendanceStatus === 'pending_review') {
      message = `Check-in submitted. Facial similarity score: ${similarityScore}%. Your attendance is pending lecturer review.`;
    } else {
      message = `Check-in rejected. Facial similarity score: ${similarityScore}%. Identity could not be verified.`;
    }

    return NextResponse.json({
      success: attendanceStatus === 'present' || attendanceStatus === 'pending_review',
      data: {
        stage,
        status: attendanceStatus,
        similarityScore,
        distance: Math.round(distance * 100) / 100,
        attendanceId: attendance.id,
        message,
      },
    });
  } catch (error) {
    console.error('Student check-in error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
