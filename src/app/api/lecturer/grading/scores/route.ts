// ============================================================
// checkIn - Lecturer Grading Scores (per-student CA + exam)
// ============================================================
// GET  /api/lecturer/grading/scores?courseId=X&semesterId=Y
//   Returns every enrolled student for the course (joined via
//   course_departments → students) with their saved CA/exam
//   scores, or zeros if no row exists yet.
// POST /api/lecturer/grading/scores
//   Upserts a single { courseId, semesterId, studentId, caScore,
//   examScore } row into student_scores.
//
// Defense-in-depth: every handler calls getAuthUser(request) and
// verifies course.lecturer_id === auth.userId BEFORE doing any work.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

interface ScoreRow {
  id: string | null;
  studentId: string;
  studentName: string;
  matricNumber: string;
  departmentName: string;
  courseId: string;
  semesterId: string;
  caScore: number;
  examScore: number;
  total: number;
}

const MAX_SCORE = 100;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Verify the course exists and belongs to the authenticated lecturer.
 * Returns either the course row or a NextResponse (error).
 */
async function verifyCourseOwnership(
  courseId: string,
  authUserId: string
): Promise<{ ok: true; course: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  const { data: courses } = await db.from('courses').select('*').eq('id', courseId);
  if (!courses || courses.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      ),
    };
  }
  const course = courses[0] as Record<string, unknown>;
  if (course.lecturer_id !== authUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'You do not have permission to access this course' },
        { status: 403 }
      ),
    };
  }
  return { ok: true, course };
}

/**
 * Fetch every enrolled student for a course via the
 * course_departments → students join (same pattern as export/route.ts).
 * Returns students enriched with their department name.
 */
async function fetchEnrolledStudents(
  courseId: string
): Promise<{ id: string; name: string; matricNumber: string; departmentName: string }[]> {
  const { data: courseDepts } = await db
    .from('course_departments')
    .select('*')
    .eq('course_id', courseId);

  const deptIds = ((courseDepts || []) as Record<string, unknown>[])
    .map((cd) => cd.department_id as string)
    .filter(Boolean);
  const uniqueDeptIds = [...new Set(deptIds)];

  if (uniqueDeptIds.length === 0) return [];

  // Pull department names.
  const deptMap = new Map<string, string>();
  const { data: depts } = await db.from('departments').select('*').in('id', uniqueDeptIds);
  for (const d of depts || []) {
    const dept = d as Record<string, unknown>;
    deptMap.set(dept.id as string, (dept.name as string) || '');
  }

  // Pull students for those departments.
  const { data: studentsData } = await db
    .from('students')
    .select('*')
    .in('department_id', uniqueDeptIds)
    .order('matric_number', { ascending: true });

  return ((studentsData || []) as Record<string, unknown>[]).map((s) => ({
    id: s.id as string,
    name: (s.name as string) || '',
    matricNumber: (s.matric_number as string) || '',
    departmentName: deptMap.get(s.department_id as string) || '',
  }));
}

function isTableMissingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('404') ||
    lower.includes('relation') && lower.includes('missing')
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const semesterId = searchParams.get('semesterId');

    if (!courseId || !semesterId) {
      return NextResponse.json(
        { success: false, error: 'courseId and semesterId are required' },
        { status: 400 }
      );
    }

    // Verify ownership BEFORE doing any other work.
    const ownership = await verifyCourseOwnership(courseId, auth.userId);
    if (!ownership.ok) return ownership.response;

    // Fetch all enrolled students for this course.
    const enrolled = await fetchEnrolledStudents(courseId);

    // Fetch saved scores. If the student_scores table doesn't exist
    // (or any other query error), treat as "no scores yet" so the UI
    // still shows every enrolled student with zero scores.
    const scoreMap = new Map<
      string,
      { id: string; caScore: number; examScore: number }
    >();
    try {
      const { data: scores, error: scoresError } = await db
        .from('student_scores')
        .select('*')
        .eq('course_id', courseId)
        .eq('semester_id', semesterId);

      if (!scoresError && scores) {
        for (const row of scores as Record<string, unknown>[]) {
          scoreMap.set(row.student_id as string, {
            id: row.id as string,
            caScore: Number(row.ca_score) || 0,
            examScore: Number(row.exam_score) || 0,
          });
        }
      }
    } catch {
      // Swallow — fall through with empty scoreMap (resilience).
    }

    // Merge enrolled students with any saved scores.
    const rows: ScoreRow[] = enrolled.map((student) => {
      const saved = scoreMap.get(student.id);
      const caScore = saved?.caScore ?? 0;
      const examScore = saved?.examScore ?? 0;
      return {
        id: saved?.id ?? null,
        studentId: student.id,
        studentName: student.name,
        matricNumber: student.matricNumber,
        departmentName: student.departmentName,
        courseId,
        semesterId,
        caScore,
        examScore,
        total: caScore + examScore,
      };
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get student scores error:', error);
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

    const { courseId, semesterId, studentId, caScore, examScore } =
      await request.json();

    if (!courseId || !semesterId || !studentId) {
      return NextResponse.json(
        { success: false, error: 'courseId, semesterId, and studentId are required' },
        { status: 400 }
      );
    }

    if (!isFiniteNumber(caScore) || !isFiniteNumber(examScore)) {
      return NextResponse.json(
        { success: false, error: 'caScore and examScore must be finite numbers' },
        { status: 400 }
      );
    }

    if (
      caScore < 0 ||
      caScore > MAX_SCORE ||
      examScore < 0 ||
      examScore > MAX_SCORE
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `caScore and examScore must each be between 0 and ${MAX_SCORE}`,
        },
        { status: 400 }
      );
    }

    // Verify course ownership BEFORE doing any other work.
    const ownership = await verifyCourseOwnership(courseId, auth.userId);
    if (!ownership.ok) return ownership.response;

    // Attempt INSERT first. If duplicate-key error, fall back to UPDATE.
    const { data: inserted, error: insertError } = await db
      .from('student_scores')
      .insert({
        course_id: courseId,
        semester_id: semesterId,
        student_id: studentId,
        ca_score: caScore,
        exam_score: examScore,
      })
      .select();

    if (insertError && insertError.message === 'DUPLICATE') {
      const { data: updated, error: updateError } = await db
        .from('student_scores')
        .update({ ca_score: caScore, exam_score: examScore })
        .eq('course_id', courseId)
        .eq('semester_id', semesterId)
        .eq('student_id', studentId);

      if (updateError) {
        if (isTableMissingError(String(updateError.message || ''))) {
          return NextResponse.json(
            {
              success: false,
              error:
                'The student_scores table does not exist in the database. Please contact admin to create it.',
            },
            { status: 500 }
          );
        }
        return NextResponse.json(
          { success: false, error: 'Failed to update student score' },
          { status: 500 }
        );
      }

      const row = (updated?.[0] as Record<string, unknown>) || {
        course_id: courseId,
        semester_id: semesterId,
        student_id: studentId,
        ca_score: caScore,
        exam_score: examScore,
      };
      const ca = Number(row.ca_score) || 0;
      const ex = Number(row.exam_score) || 0;
      return NextResponse.json({
        success: true,
        data: {
          id: row.id ?? null,
          studentId: row.student_id,
          courseId: row.course_id,
          semesterId: row.semester_id,
          caScore: ca,
          examScore: ex,
          total: ca + ex,
        },
      });
    }

    if (insertError) {
      if (isTableMissingError(String(insertError.message || ''))) {
        return NextResponse.json(
          {
            success: false,
            error:
              'The student_scores table does not exist in the database. Please contact admin to create it.',
          },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create student score' },
        { status: 500 }
      );
    }

    const row = (inserted?.[0] as Record<string, unknown>) || {
      course_id: courseId,
      semester_id: semesterId,
      student_id: studentId,
      ca_score: caScore,
      exam_score: examScore,
    };
    const ca = Number(row.ca_score) || 0;
    const ex = Number(row.exam_score) || 0;
    return NextResponse.json({
      success: true,
      data: {
        id: row.id ?? null,
        studentId: row.student_id,
        courseId: row.course_id,
        semesterId: row.semester_id,
        caScore: ca,
        examScore: ex,
        total: ca + ex,
      },
    });
  } catch (error) {
    console.error('Upsert student score error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
