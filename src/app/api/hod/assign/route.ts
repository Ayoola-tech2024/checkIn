// ============================================================
// checkIn - HOD Assign Lecturer to Course
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, lecturerId } = body;

    if (!courseId || !lecturerId) {
      return NextResponse.json(
        { success: false, error: 'Course ID and Lecturer ID are required' },
        { status: 400 }
      );
    }

    // Verify the lecturer exists and belongs to the same department
    const { data: lecturers } = await db.from('lecturers').select('id, name, department_id').eq('id', lecturerId);
    if (!lecturers || lecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'Lecturer not found' }, { status: 404 });
    }

    // Verify the course exists
    const { data: courses } = await db.from('courses').select('id, name, code, department_id').eq('id', courseId);
    if (!courses || courses.length === 0) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    // Assign lecturer to course
    const { error } = await db.from('courses').update({ lecturer_id: lecturerId }).eq('id', courseId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const lecturer = lecturers[0] as Record<string, unknown>;
    const course = courses[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        courseId,
        courseName: course.name,
        lecturerId,
        lecturerName: lecturer.name,
      },
    });
  } catch (error) {
    console.error('HOD assign error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    // Unassign lecturer from course
    const { error } = await db.from('courses').update({ lecturer_id: null }).eq('id', courseId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Lecturer unassigned from course' });
  } catch (error) {
    console.error('HOD unassign error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
