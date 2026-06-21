// ============================================================
// checkIn - Lecturer Grading Scores — BATCH upsert
// ============================================================
// POST /api/lecturer/grading/scores/batch
//   Body: { courseId, semesterId, scores: [{ studentId, caScore,
//          examScore }] }
//   Upserts each score row individually (InsForge has no real
//   transaction support). Returns { imported: N, errors: [...] }.
//
// The backing table is `student_grades` (NOT `student_scores`).
// `graded_by` is set to auth.userId on every write; `total` is
// computed by the API from ca_score + exam_score (no DB trigger).
//
// Defense-in-depth: handler calls getAuthUser(request) and verifies
// course.lecturer_id === auth.userId BEFORE doing any work.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { getAuthUser } from '@/lib/auth-context';

const MAX_SCORE = 100;

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isTableMissingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes('does not exist') ||
    lower.includes('could not find the table') ||
    lower.includes('404') ||
    (lower.includes('relation') && lower.includes('missing'))
  );
}

interface BatchScoreInput {
  studentId: string;
  caScore: number;
  examScore: number;
}

/**
 * Upsert a single score row. Returns the row (on success) or throws
 * an Error with a descriptive message (on failure).
 */
async function upsertScore(
  courseId: string,
  semesterId: string,
  gradedBy: string,
  input: BatchScoreInput
): Promise<{ id: string | null; studentId: string; caScore: number; examScore: number; total: number }> {
  const total = input.caScore + input.examScore;
  const { data: inserted, error: insertError } = await db
    .from('student_grades')
    .insert({
      course_id: courseId,
      semester_id: semesterId,
      student_id: input.studentId,
      ca_score: input.caScore,
      exam_score: input.examScore,
      total,
      graded_by: gradedBy,
    })
    .select();

  if (insertError && insertError.message === 'DUPLICATE') {
    const { data: updated, error: updateError } = await db
      .from('student_grades')
      .update({ ca_score: input.caScore, exam_score: input.examScore, total, graded_by: gradedBy })
      .eq('course_id', courseId)
      .eq('semester_id', semesterId)
      .eq('student_id', input.studentId);

    if (updateError) {
      if (isTableMissingError(String(updateError.message || ''))) {
        throw new Error(
          'The student_grades table does not exist in the database. Please contact admin to create it.'
        );
      }
      throw new Error(`Failed to update score for student ${input.studentId}`);
    }

    const row = (updated?.[0] as Record<string, unknown>) || {
      course_id: courseId,
      semester_id: semesterId,
      student_id: input.studentId,
      ca_score: input.caScore,
      exam_score: input.examScore,
      total,
    };
    const ca = Number(row.ca_score) || 0;
    const ex = Number(row.exam_score) || 0;
    return {
      id: (row.id as string) ?? null,
      studentId: input.studentId,
      caScore: ca,
      examScore: ex,
      total: ca + ex,
    };
  }

  if (insertError) {
    if (isTableMissingError(String(insertError.message || ''))) {
      throw new Error(
        'The student_grades table does not exist in the database. Please contact admin to create it.'
      );
    }
    throw new Error(`Failed to create score for student ${input.studentId}`);
  }

  const row = (inserted?.[0] as Record<string, unknown>) || {
    course_id: courseId,
    semester_id: semesterId,
    student_id: input.studentId,
    ca_score: input.caScore,
    exam_score: input.examScore,
    total,
  };
  const ca = Number(row.ca_score) || 0;
  const ex = Number(row.exam_score) || 0;
  return {
    id: (row.id as string) ?? null,
    studentId: input.studentId,
    caScore: ca,
    examScore: ex,
    total: ca + ex,
  };
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

    const body = await request.json();
    const { courseId, semesterId, scores } = body as {
      courseId?: string;
      semesterId?: string;
      scores?: BatchScoreInput[];
    };

    if (!courseId || !semesterId) {
      return NextResponse.json(
        { success: false, error: 'courseId and semesterId are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(scores)) {
      return NextResponse.json(
        { success: false, error: 'scores must be an array' },
        { status: 400 }
      );
    }

    // Verify course ownership BEFORE doing any other work.
    const { data: courses } = await db.from('courses').select('*').eq('id', courseId);
    if (!courses || courses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }
    const course = courses[0] as Record<string, unknown>;
    if (course.lecturer_id !== auth.userId) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to access this course' },
        { status: 403 }
      );
    }

    // Validate every row BEFORE writing so we don't half-import.
    const clean: BatchScoreInput[] = [];
    const validationErrors: string[] = [];
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      if (!s || typeof s !== 'object') {
        validationErrors.push(`Row ${i}: invalid shape`);
        continue;
      }
      if (!s.studentId || typeof s.studentId !== 'string') {
        validationErrors.push(`Row ${i}: studentId is required`);
        continue;
      }
      if (!isFiniteNumber(s.caScore) || !isFiniteNumber(s.examScore)) {
        validationErrors.push(`Row ${i}: caScore and examScore must be finite numbers`);
        continue;
      }
      if (
        s.caScore < 0 ||
        s.caScore > MAX_SCORE ||
        s.examScore < 0 ||
        s.examScore > MAX_SCORE
      ) {
        validationErrors.push(
          `Row ${i}: caScore and examScore must each be between 0 and ${MAX_SCORE}`
        );
        continue;
      }
      clean.push({ studentId: s.studentId, caScore: s.caScore, examScore: s.examScore });
    }

    if (validationErrors.length > 0 && clean.length === 0) {
      return NextResponse.json(
        { success: false, error: validationErrors[0] },
        { status: 400 }
      );
    }

    // Loop-upsert each score. Collect per-row errors so partial success
    // is still reported back to the UI.
    let imported = 0;
    const errors: { studentId: string; error: string }[] = [];
    let tableMissing = false;

    for (const input of clean) {
      try {
        await upsertScore(courseId, semesterId, auth.userId, input);
        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('student_grades table does not exist')) {
          tableMissing = true;
          errors.push({ studentId: input.studentId, error: msg });
          // Stop looping — every subsequent call will fail the same way.
          break;
        }
        errors.push({ studentId: input.studentId, error: msg });
      }
    }

    if (tableMissing && imported === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'The student_grades table does not exist in the database. Please contact admin to create it.',
          imported: 0,
          errors,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      imported,
      errors,
    });
  } catch (error) {
    console.error('Batch upsert student scores error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
