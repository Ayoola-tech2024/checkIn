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
    const { searchParams } = new URL(request.url);
    const semesterId = searchParams.get('semesterId');

    // Get lecturer's courses
    const { data: courses, error } = await db
      .from('courses')
      .select('*')
      .eq('lecturer_id', lecturerId);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!courses || courses.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const courseIds = courses.map((c: Record<string, unknown>) => c.id as string);

    // Fetch gradings for these courses
    let gradingQuery = db.from('course_gradings').select('*').in('course_id', courseIds);
    if (semesterId) {
      gradingQuery = gradingQuery.eq('semester_id', semesterId);
    }
    const { data: gradings } = await gradingQuery;

    // Manually join semesters for gradings
    const gradingSemesterIds = (gradings || []).map((g: Record<string, unknown>) => g.semester_id as string).filter(Boolean);
    const uniqueGradingSemesterIds = [...new Set(gradingSemesterIds)];
    let semesterMap = new Map<string, Record<string, unknown>>();
    if (uniqueGradingSemesterIds.length > 0) {
      const { data: semestersData } = await db.from('semesters').select('id, name').in('id', uniqueGradingSemesterIds);
      for (const s of semestersData || []) {
        semesterMap.set((s as Record<string, unknown>).id as string, s as Record<string, unknown>);
      }
    }

    // Build grading map by course_id
    const gradingMap = new Map<string, Record<string, unknown>[]>();
    for (const g of gradings || []) {
      const rec = g as Record<string, unknown>;
      const cid = rec.course_id as string;
      if (!gradingMap.has(cid)) gradingMap.set(cid, []);
      gradingMap.get(cid)!.push(rec);
    }

    const data = courses.map((course: Record<string, unknown>) => ({
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      level: course.level,
      grading: (gradingMap.get(course.id as string) || []).map((g: Record<string, unknown>) => {
        const semester = semesterMap.get(g.semester_id as string) || null;
        return {
          id: g.id,
          courseId: g.course_id,
          semesterId: g.semester_id,
          semesterName: semester?.name,
          totalMarks: g.total_marks,
        };
      }),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get grading error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { courseId, semesterId, totalMarks } = await request.json();

    if (!courseId || !semesterId || totalMarks === undefined) {
      return NextResponse.json(
        { success: false, error: 'Course ID, semester ID, and total marks are required' },
        { status: 400 }
      );
    }

    // Verify course exists
    const { data: courses } = await db.from('courses').select('id, lecturer_id').eq('id', courseId);
    if (!courses || courses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    // Verify ownership: the course must belong to the authenticated lecturer
    const course = courses[0] as Record<string, unknown>;
    if (course.lecturer_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to access this course' },
        { status: 403 }
      );
    }

    // Verify semester exists
    const { data: semesters } = await db.from('semesters').select('id').eq('id', semesterId);
    if (!semesters || semesters.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Semester not found' },
        { status: 404 }
      );
    }

    // Try upsert: first try insert, if duplicate key then update
    const { data: inserted, error: insertError } = await db
      .from('course_gradings')
      .insert({
        course_id: courseId,
        semester_id: semesterId,
        total_marks: parseFloat(totalMarks),
      })
      .select();

    if (insertError && insertError.message === 'DUPLICATE') {
      // Update existing
      const { data: updated, error: updateError } = await db
        .from('course_gradings')
        .update({ total_marks: parseFloat(totalMarks) })
        .eq('course_id', courseId)
        .eq('semester_id', semesterId);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update grading' },
          { status: 500 }
        );
      }

      const grading = (updated?.[0] as Record<string, unknown>) || {
        course_id: courseId,
        semester_id: semesterId,
        total_marks: parseFloat(totalMarks),
      };

      return NextResponse.json({
        success: true,
        data: {
          id: grading.id,
          courseId: grading.course_id,
          semesterId: grading.semester_id,
          totalMarks: grading.total_marks,
        },
      });
    }

    if (insertError) {
      return NextResponse.json(
        { success: false, error: 'Failed to create grading' },
        { status: 500 }
      );
    }

    const grading = (inserted?.[0] as Record<string, unknown>) || {
      course_id: courseId,
      semester_id: semesterId,
      total_marks: parseFloat(totalMarks),
    };

    return NextResponse.json({
      success: true,
      data: {
        id: grading.id,
        courseId: grading.course_id,
        semesterId: grading.semester_id,
        totalMarks: grading.total_marks,
      },
    });
  } catch (error) {
    console.error('Set grading error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
