import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const { data: attendances } = await db
      .from('attendances')
      .select('*')
      .eq('id', attendanceId);

    if (!attendances || attendances.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Attendance record not found' },
        { status: 404 }
      );
    }

    const attendance = attendances[0] as Record<string, unknown>;

    // Verify ownership: the attendance's session must belong to the authenticated lecturer
    const { data: ownerSessions } = await db
      .from('sessions')
      .select('lecturer_id')
      .eq('id', attendance.session_id as string);
    const sessionOwner = ownerSessions?.[0] as Record<string, unknown> | undefined;
    if (!sessionOwner || sessionOwner.lecturer_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to access this session' },
        { status: 403 }
      );
    }

    if (attendance.status !== 'pending_review') {
      return NextResponse.json(
        { success: false, error: `Attendance record is not pending review. Current status: ${attendance.status}` },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'present' : 'rejected_identity';

    const { data: updatedAttendances, error } = await db
      .from('attendances')
      .update({ status: newStatus })
      .eq('id', attendanceId);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to update attendance' },
        { status: 500 }
      );
    }

    const updatedAttendance = (updatedAttendances?.[0] as Record<string, unknown>) || {
      id: attendanceId,
      student_id: attendance.student_id,
      session_id: attendance.session_id,
      status: newStatus,
    };

    return NextResponse.json({
      success: true,
      data: {
        id: updatedAttendance.id,
        studentId: updatedAttendance.student_id,
        sessionId: updatedAttendance.session_id,
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
