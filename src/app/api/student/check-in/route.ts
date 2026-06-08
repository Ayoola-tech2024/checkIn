import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { haversineDistance } from '@/lib/geo';
import { calculateSimilarity, getAttendanceStatusFromSimilarity } from '@/lib/face-utils';

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

    if (!studentId || !sessionId || studentLat === undefined || studentLng === undefined || !facialDescriptor) {
      return NextResponse.json(
        { success: false, error: 'Student ID, session ID, coordinates, and facial descriptor are required' },
        { status: 400 }
      );
    }

    // Get the student
    const student = await db.student.findUnique({
      where: { id: studentId },
    });

    if (!student) {
      return NextResponse.json(
        { success: false, error: 'Student not found' },
        { status: 404 }
      );
    }

    if (!student.activated) {
      return NextResponse.json(
        { success: false, error: 'Account not activated. Please activate your account first.' },
        { status: 403 }
      );
    }

    // Get the session
    const session = await db.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Session is not active. Current status: ${session.status}` },
        { status: 400 }
      );
    }

    // Check if already checked in
    const existingAttendance = await db.attendance.findUnique({
      where: {
        studentId_sessionId: { studentId, sessionId },
      },
    });

    if (existingAttendance && (existingAttendance.status === 'present' || existingAttendance.status === 'pending_review')) {
      return NextResponse.json({
        success: false,
        error: 'Already checked in for this session',
        data: {
          status: existingAttendance.status,
          similarityScore: existingAttendance.similarityScore,
        },
      }, { status: 409 });
    }

    // ===== TIER 1: Location Validation =====
    if (session.lecturerLat === null || session.lecturerLng === null) {
      return NextResponse.json(
        { success: false, error: 'Session location not available. Lecturer has not started the session properly.' },
        { status: 400 }
      );
    }

    const distance = haversineDistance(
      studentLat,
      studentLng,
      session.lecturerLat,
      session.lecturerLng
    );

    const isWithinLocation = distance <= session.distanceThreshold;

    if (!isWithinLocation) {
      // Create/update attendance with rejected_location
      const attendance = await db.attendance.upsert({
        where: {
          studentId_sessionId: { studentId, sessionId },
        },
        create: {
          studentId,
          sessionId,
          status: 'rejected_location',
          studentLat,
          studentLng,
          selfieData: selfieData || null,
          checkInTime: new Date(),
        },
        update: {
          status: 'rejected_location',
          studentLat,
          studentLng,
          selfieData: selfieData || null,
          checkInTime: new Date(),
        },
      });

      return NextResponse.json({
        success: false,
        error: `You are too far from the session venue. Distance: ${distance.toFixed(1)}m, required: within ${session.distanceThreshold}m`,
        data: {
          stage: 'location',
          status: 'rejected_location',
          distance: Math.round(distance * 100) / 100,
          threshold: session.distanceThreshold,
          attendanceId: attendance.id,
        },
      }, { status: 403 });
    }

    // ===== TIER 2: Facial Recognition Validation =====
    if (!student.facialData) {
      return NextResponse.json(
        { success: false, error: 'No facial data on file. Please re-activate your account.' },
        { status: 400 }
      );
    }

    let storedDescriptor: number[];
    try {
      const facialObj = JSON.parse(student.facialData);
      storedDescriptor = facialObj.descriptor || facialObj;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid facial data on file. Please re-activate your account.' },
        { status: 400 }
      );
    }

    const similarityScore = calculateSimilarity(storedDescriptor, facialDescriptor);
    const { status: attendanceStatus } = getAttendanceStatusFromSimilarity(similarityScore);

    const attendance = await db.attendance.upsert({
      where: {
        studentId_sessionId: { studentId, sessionId },
      },
      create: {
        studentId,
        sessionId,
        status: attendanceStatus,
        similarityScore,
        studentLat,
        studentLng,
        selfieData: selfieData || null,
        checkInTime: new Date(),
      },
      update: {
        status: attendanceStatus,
        similarityScore,
        studentLat,
        studentLng,
        selfieData: selfieData || null,
        checkInTime: new Date(),
      },
    });

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
