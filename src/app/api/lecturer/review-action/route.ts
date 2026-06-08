import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { attendanceId, action } = await request.json();

    if (!attendanceId || !action) {
      return NextResponse.json(
        { success: false, error: 'Attendance ID and action are required' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be "approve" or "reject"' },
        { status: 400 }
      );
    }

    const attendance = await db.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      return NextResponse.json(
        { success: false, error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    if (attendance.status !== 'pending_review') {
      return NextResponse.json(
        { success: false, error: `Attendance record is not pending review. Current status: ${attendance.status}` },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'present' : 'rejected_identity';

    const updatedAttendance = await db.attendance.update({
      where: { id: attendanceId },
      data: { status: newStatus },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updatedAttendance.id,
        studentId: updatedAttendance.studentId,
        sessionId: updatedAttendance.sessionId,
        previousStatus: 'pending_review',
        status: updatedAttendance.status,
      },
    });
  } catch (error) {
    console.error('Review action error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
