// ============================================================
// checkIn - HOD Courses API (CRUD for courses in HOD's dept)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { validateCourseFields } from '@/lib/slit-validation';
import { VALID_LEVELS } from '@/lib/constants';
import { getAuthUser } from '@/lib/auth-context';

export async function GET(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the HOD's department from the database using auth.userId.
    // Never trust a client-supplied departmentId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const departmentId = hodLecturer.hod_department_id || hodLecturer.department_id;
    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }

    const { data: courses, error } = await db
      .from('courses')
      .select('*')
      .eq('department_id', departmentId)
      .order('level', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Enrich with lecturer info
    const coursesWithLecturer = await Promise.all(
      ((courses || []) as Record<string, unknown>[]).map(async (course) => {
        let lecturerName: string | undefined;
        if (course.lecturer_id) {
          const { data: lecs } = await db.from('lecturers').select('name').eq('id', course.lecturer_id as string);
          lecturerName = (lecs?.[0] as Record<string, unknown>)?.name as string | undefined;
        }
        return {
          id: course.id,
          name: course.name,
          code: course.code,
          level: typeof course.level === 'number' ? course.level : parseInt(course.level as string, 10) || 100,
          departmentId: course.department_id,
          lecturerId: course.lecturer_id,
          lecturerName,
        };
      })
    );

    return NextResponse.json({ success: true, data: coursesWithLecturer });
  } catch (error) {
    console.error('HOD courses GET error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = getAuthUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, code, level, lecturerId } = body;

    if (!name || !code) {
      return NextResponse.json(
        { success: false, error: 'Name and code are required' },
        { status: 400 }
      );
    }

    // Look up the HOD's department and school from the database using auth.userId.
    // The new course is created in the HOD's own department — never trust
    // client-supplied departmentId/schoolId.
    const { data: hodLecturers } = await db
      .from('lecturers')
      .select('hod_department_id, department_id, school_id')
      .eq('id', auth.userId);
    if (!hodLecturers || hodLecturers.length === 0) {
      return NextResponse.json({ success: false, error: 'HOD record not found' }, { status: 404 });
    }
    const hodLecturer = hodLecturers[0] as Record<string, unknown>;
    const departmentId = hodLecturer.hod_department_id || hodLecturer.department_id;
    const schoolId = hodLecturer.school_id;
    if (!departmentId) {
      return NextResponse.json({ success: false, error: 'No department assigned to this HOD' }, { status: 403 });
    }
    if (!schoolId) {
      return NextResponse.json({ success: false, error: 'No school assigned to this HOD' }, { status: 403 });
    }

    const courseLevel = level || 100;

    // Validate level
    const levelValidation = validateCourseFields({ level: courseLevel, schoolId: schoolId as string, departmentId: departmentId as string });
    if (!levelValidation.valid) {
      return NextResponse.json({ success: false, error: levelValidation.errors.join(', ') }, { status: 400 });
    }

    if (!VALID_LEVELS.includes(courseLevel as typeof VALID_LEVELS[number])) {
      return NextResponse.json({ success: false, error: `Level must be one of: ${VALID_LEVELS.join(', ')}` }, { status: 400 });
    }

    // Create course
    const courseData: Record<string, unknown> = {
      name,
      code,
      level: courseLevel,
      department_id: departmentId,
      school_id: schoolId,
    };

    // Assign lecturer if provided
    if (lecturerId) {
      courseData.lecturer_id = lecturerId;
    } else {
      // Need a placeholder lecturer_id since it's required
      // Find the HOD's own ID to assign as default
      return NextResponse.json(
        { success: false, error: 'A lecturer must be assigned to the course' },
        { status: 400 }
      );
    }

    const { data: newCourse, error } = await db.from('courses').insert(courseData).select();

    if (error) {
      if (error.message === 'DUPLICATE' || error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ success: false, error: 'A course with this code already exists' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Also create course_department link
    if (newCourse && newCourse.length > 0) {
      const courseId = (newCourse[0] as Record<string, unknown>).id as string;
      await db.from('course_departments').insert({
        course_id: courseId,
        department_id: departmentId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: (newCourse?.[0] as Record<string, unknown>)?.id,
        name,
        code,
        level: courseLevel,
        departmentId,
        lecturerId,
      },
    });
  } catch (error) {
    console.error('HOD course create error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { courseId, name, code, level, lecturerId } = body;

    if (!courseId) {
      return NextResponse.json({ success: false, error: 'Course ID is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (name) updates.name = name;
    if (code) updates.code = code;
    if (level !== undefined) {
      if (!VALID_LEVELS.includes(level as typeof VALID_LEVELS[number])) {
        return NextResponse.json({ success: false, error: `Level must be one of: ${VALID_LEVELS.join(', ')}` }, { status: 400 });
      }
      updates.level = level;
    }
    if (lecturerId !== undefined) updates.lecturer_id = lecturerId;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 });
    }

    const { error } = await db.from('courses').update(updates).eq('id', courseId);

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ success: false, error: 'A course with this code already exists' }, { status: 409 });
      }
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { id: courseId, ...updates } });
  } catch (error) {
    console.error('HOD course update error:', error);
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

    // Delete course_departments links first
    await db.from('course_departments').delete().eq('course_id', courseId);

    const { error } = await db.from('courses').delete().eq('id', courseId);
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Course deleted' });
  } catch (error) {
    console.error('HOD course delete error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
