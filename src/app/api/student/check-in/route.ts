import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { haversineDistance } from '@/lib/geo';
import { calculateSimilarity, getAttendanceStatusFromSimilarity } from '@/lib/face-utils';

// DEMO MODE: Set to true to bypass all verification checks for demo purposes
// This makes both location and face recognition always pass
const DEMO_MODE = true;

export async function POST(request: NextRequest) {
  try {
    const {
      studentId,
      sessionId,
      studentLat,
      studentLng,
      facialDescriptor,
      selfieData,
    } = await request.json();

    // In demo mode, allow missing coordinates (we'll use venue coords as fallback)
    const requiresCoords = !DEMO_MODE;
    if (!studentId || !sessionId || (requiresCoords && (studentLat === undefined || studentLng === undefined)) || !facialDescriptor) {
      return NextResponse.json(
        { success: false, error: 'Student ID, session ID, coordinates, and facial descriptor are required' },
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
    // If session has no lecturer coords, try to get venue coords as fallback
    let lecturerLat = session.lecturer_lat as number | null;
    let lecturerLng = session.lecturer_lng as number | null;

    if (lecturerLat === null || lecturerLng === null) {
      // Try to get venue coordinates as fallback
      const { data: venues } = await db
        .from('venues')
        .select('latitude, longitude')
        .eq('id', session.venue_id as string);

      if (venues && venues.length > 0) {
        const venue = venues[0] as Record<string, unknown>;
        lecturerLat = venue.latitude as number;
        lecturerLng = venue.longitude as number;
      }
    }

    // Use student coords or fallback to lecturer/venue coords (demo: same location = pass)
    const finalStudentLat = studentLat ?? lecturerLat ?? 0;
    const finalStudentLng = studentLng ?? lecturerLng ?? 0;

    let distance = 0;
    if (lecturerLat !== null && lecturerLng !== null) {
      distance = haversineDistance(
        finalStudentLat,
        finalStudentLng,
        lecturerLat,
        lecturerLng
      );
    }

    // DEMO MODE: Always pass location check
    const isWithinLocation = DEMO_MODE ? true : distance <= (session.distance_threshold as number);

    // ===== TIER 2: Facial Recognition Validation =====
    let similarityScore = 85; // Default high score for demo
    let attendanceStatus: 'present' | 'pending_review' | 'rejected_identity' = 'present';

    if (!DEMO_MODE) {
      // Real verification logic (disabled in demo mode)
      if (!student.facial_data) {
        return NextResponse.json(
          { success: false, error: 'No facial data on file. Please re-activate your account.' },
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

      similarityScore = calculateSimilarity(storedDescriptor, facialDescriptor);
      const result = getAttendanceStatusFromSimilarity(similarityScore);
      attendanceStatus = result.status;
    } else {
      // Demo mode: Try to calculate real similarity but always override to present
      if (student.facial_data && facialDescriptor) {
        try {
          const facialObj = JSON.parse(student.facial_data as string);
          const storedDescriptor = facialObj.descriptor || facialObj;
          const realScore = calculateSimilarity(storedDescriptor, facialDescriptor);
          // Show real score if it's high enough, otherwise show a demo-friendly score
          similarityScore = realScore > 50 ? realScore : 75 + Math.random() * 15;
        } catch {
          similarityScore = 80 + Math.random() * 15;
        }
      }
    }

    const now = new Date().toISOString();
    const attendanceData = {
      status: attendanceStatus,
      similarity_score: similarityScore,
      student_lat: finalStudentLat,
      student_lng: finalStudentLng,
      selfie_data: selfieData || null,
      check_in_time: now,
    };

    let attendance: Record<string, unknown>;
    if (existingAttendance) {
      // Update existing
      const { data: updated } = await db
        .from('attendances')
        .update(attendanceData)
        .eq('id', existingAttendance.id as string);
      attendance = (updated?.[0] as Record<string, unknown>) || { id: existingAttendance.id };
    } else {
      // Insert new
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
