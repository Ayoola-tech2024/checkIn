import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { validateCourseFields } from '@/lib/slit-validation';
import { SLIT_SCHOOL_ID, VALID_LEVELS } from '@/lib/constants';
import { getAuthUser } from '@/lib/auth-context';

function requireAdmin(request: NextRequest) {
  // DEFENSE-IN-DEPTH: middleware already enforces admin role, but verify
  // here too in case middleware is ever bypassed.
  const auth = getAuthUser(request);
  if (!auth) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) };
  }
  if (auth.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 }) };
  }
  return { ok: true, auth };
}

export async function GET(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { data: courses, error } = await db
      .from('courses')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (!courses || courses.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Manually fetch lecturers for all courses
    const lecturerIds = [...new Set(courses.map((c: Record<string, unknown>) => c.lecturer_id as string).filter(Boolean))];
    const lecturerMap = new Map<string, Record<string, unknown>>();

    if (lecturerIds.length > 0) {
      const { data: lecturers } = await db
        .from('lecturers')
        .select('id, name, email')
        .in('id', lecturerIds);
      for (const l of lecturers || []) {
        lecturerMap.set((l as Record<string, unknown>).id as string, l as Record<string, unknown>);
      }
    }

    // Manually fetch course_departments
    const courseIds = courses.map((c: Record<string, unknown>) => c.id as string);
    const { data: courseDepts } = await db
      .from('course_departments')
      .select('*')
      .in('course_id', courseIds.length > 0 ? courseIds : ['__none__']);

    // Fetch department details for course_departments + direct department_id on courses
    const deptIdsFromLinks = [...new Set((courseDepts || []).map((cd: Record<string, unknown>) => cd.department_id as string).filter(Boolean))];
    const deptIdsFromCourses = [...new Set(courses.map((c: Record<string, unknown>) => c.department_id as string).filter(Boolean))];
    const allDeptIds = [...new Set([...deptIdsFromLinks, ...deptIdsFromCourses])];
    const deptMap = new Map<string, Record<string, unknown>>();

    if (allDeptIds.length > 0) {
      const { data: depts } = await db
        .from('departments')
        .select('id, name, code')
        .in('id', allDeptIds);
      for (const d of depts || []) {
        deptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Fetch school info for courses
    const schoolIds = [...new Set(courses.map((c: Record<string, unknown>) => c.school_id as string).filter(Boolean))];
    const schoolMap = new Map<string, { name: string; code: string }>();
    if (schoolIds.length > 0) {
      const { data: schoolData } = await db
        .from('schools')
        .select('id, name, code')
        .in('id', schoolIds);
      for (const s of schoolData || []) {
        schoolMap.set((s as Record<string, unknown>).id as string, { name: (s as Record<string, unknown>).name as string, code: (s as Record<string, unknown>).code as string });
      }
    }

    // Group departments by course
    const courseDeptMap = new Map<string, string[]>();
    for (const cd of courseDepts || []) {
      const rec = cd as Record<string, unknown>;
      const cid = rec.course_id as string;
      const did = rec.department_id as string;
      if (!courseDeptMap.has(cid)) courseDeptMap.set(cid, []);
      courseDeptMap.get(cid)!.push(did);
    }

    const data = courses.map((c: Record<string, unknown>) => {
      const lecturer = lecturerMap.get(c.lecturer_id as string);
      const deptIdsForCourse = courseDeptMap.get(c.id as string) || [];
      const directDept = c.department_id ? deptMap.get(c.department_id as string) : undefined;
      const school = schoolMap.get(c.school_id as string);

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        level: typeof c.level === 'number' ? c.level : (typeof c.level === 'string' ? parseInt(c.level as string, 10) || 0 : 0),
        lecturerId: c.lecturer_id,
        lecturerName: lecturer?.name,
        schoolId: c.school_id,
        schoolName: school?.name,
        schoolCode: school?.code,
        departmentId: c.department_id,
        departmentName: directDept?.name,
        departments: deptIdsForCourse.map((did) => {
          const dept = deptMap.get(did);
          return {
            id: did,
            name: dept?.name,
            code: dept?.code,
          };
        }),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get courses error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { name, code, level, lecturerId, departmentIds, departmentId } = await request.json();

    if (!name || !code || !level || !lecturerId || !departmentIds || !Array.isArray(departmentIds)) {
      return NextResponse.json(
        { success: false, error: 'Name, code, level, lecturerId, and departmentIds are required' },
        { status: 400 }
      );
    }

    // Validate level as integer
    const parsedLevel = typeof level === 'number' ? level : parseInt(String(level), 10);
    const validation = validateCourseFields({ level: parsedLevel, departmentId });
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join('; ') },
        { status: 400 }
      );
    }

    if (!VALID_LEVELS.includes(parsedLevel as typeof VALID_LEVELS[number])) {
      return NextResponse.json(
        { success: false, error: `Level must be one of: ${VALID_LEVELS.join(', ')}. Received: ${level}` },
        { status: 400 }
      );
    }

    // Validate department_id exists if provided
    if (departmentId) {
      const { data: depts } = await db.from('departments').select('id, name').eq('id', departmentId);
      if (!depts || depts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Verify lecturer exists
    const { data: lecturers } = await db.from('lecturers').select('id').eq('id', lecturerId);
    if (!lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lecturer not found' },
        { status: 404 }
      );
    }

    // Check unique code
    const { data: existingCourses } = await db.from('courses').select('id').eq('code', code);
    if (existingCourses && existingCourses.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Course with this code already exists' },
        { status: 409 }
      );
    }

    // Create the course
    const insertData: Record<string, unknown> = {
      name,
      code,
      level: parsedLevel,
      lecturer_id: lecturerId,
      school_id: SLIT_SCHOOL_ID,
    };
    if (departmentId) {
      insertData.department_id = departmentId;
    }

    const { data: courses, error: courseError } = await db
      .from('courses')
      .insert(insertData)
      .select();

    if (courseError || !courses || courses.length === 0) {
      console.error('Course creation error:', courseError);
      return NextResponse.json(
        { success: false, error: 'Failed to create course' },
        { status: 500 }
      );
    }

    const course = courses[0] as Record<string, unknown>;

    // Create course_department links
    if (departmentIds.length > 0) {
      const courseDeptInserts = departmentIds.map((departmentIdEntry: string) => ({
        course_id: course.id,
        department_id: departmentIdEntry,
      }));
      await db.from('course_departments').insert(courseDeptInserts);
    }

    // Fetch lecturer info
    const { data: lecturerData } = await db
      .from('lecturers')
      .select('id, name, email')
      .eq('id', lecturerId);
    const lecturer = (lecturerData?.[0] as Record<string, unknown>) || null;

    // Fetch department info for direct department_id
    let directDepartmentName: string | undefined;
    if (course.department_id) {
      const { data: directDept } = await db.from('departments').select('id, name, code').eq('id', course.department_id as string);
      directDepartmentName = (directDept?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch department info for linked departments
    const { data: deptData } = await db
      .from('departments')
      .select('id, name, code')
      .in('id', departmentIds);

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', SLIT_SCHOOL_ID);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

    return NextResponse.json({
      success: true,
      data: {
        id: course.id,
        name: course.name,
        code: course.code,
        level: typeof course.level === 'number' ? course.level : parsedLevel,
        lecturerId: course.lecturer_id,
        lecturerName: lecturer?.name,
        schoolId: course.school_id,
        schoolName,
        schoolCode,
        departmentId: course.department_id,
        departmentName: directDepartmentName,
        departments: (deptData || []).map((d: Record<string, unknown>) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        })),
      },
    });
  } catch (error) {
    console.error('Create course error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { id, name, code, level, lecturerId, departmentIds, departmentId } = await request.json();

    if (!id || !name || !code || !level || !lecturerId) {
      return NextResponse.json(
        { success: false, error: 'ID, name, code, level, and lecturerId are required' },
        { status: 400 }
      );
    }

    // Validate level as integer
    const parsedLevel = typeof level === 'number' ? level : parseInt(String(level), 10);
    const validation = validateCourseFields({ level: parsedLevel, departmentId });
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join('; ') },
        { status: 400 }
      );
    }

    if (!VALID_LEVELS.includes(parsedLevel as typeof VALID_LEVELS[number])) {
      return NextResponse.json(
        { success: false, error: `Level must be one of: ${VALID_LEVELS.join(', ')}. Received: ${level}` },
        { status: 400 }
      );
    }

    // Validate department_id exists if provided
    if (departmentId) {
      const { data: depts } = await db.from('departments').select('id').eq('id', departmentId);
      if (!depts || depts.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Department not found' },
          { status: 404 }
        );
      }
    }

    // Check unique code (excluding current course)
    const { data: existingCourses } = await db.from('courses').select('id').eq('code', code);
    if (existingCourses && existingCourses.length > 0 && (existingCourses[0] as Record<string, unknown>).id !== id) {
      return NextResponse.json(
        { success: false, error: 'Course with this code already exists' },
        { status: 409 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {
      name,
      code,
      level: parsedLevel,
      lecturer_id: lecturerId,
    };
    if (departmentId !== undefined) {
      updateData.department_id = departmentId || null;
    }

    const { data: courses, error } = await db
      .from('courses')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error || !courses || courses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update course' },
        { status: 500 }
      );
    }

    // Update course_department links if provided
    if (departmentIds && Array.isArray(departmentIds)) {
      // Delete existing links
      await db.from('course_departments').delete().eq('course_id', id);

      // Insert new links
      if (departmentIds.length > 0) {
        const courseDeptInserts = departmentIds.map((departmentIdEntry: string) => ({
          course_id: id,
          department_id: departmentIdEntry,
        }));
        await db.from('course_departments').insert(courseDeptInserts);
      }
    }

    const course = courses[0] as Record<string, unknown>;

    // Fetch lecturer info
    const { data: lecturerData } = await db
      .from('lecturers')
      .select('id, name')
      .eq('id', lecturerId);
    const lecturer = (lecturerData?.[0] as Record<string, unknown>) || null;

    // Fetch department info for direct department_id
    let directDepartmentName: string | undefined;
    if (course.department_id) {
      const { data: directDept } = await db.from('departments').select('id, name').eq('id', course.department_id as string);
      directDepartmentName = (directDept?.[0] as Record<string, unknown>)?.name as string | undefined;
    }

    // Fetch department info for linked departments
    let departments: { id: string; name: string; code: string }[] = [];
    if (departmentIds && departmentIds.length > 0) {
      const { data: deptData } = await db
        .from('departments')
        .select('id, name, code')
        .in('id', departmentIds);
      departments = (deptData || []).map((d: Record<string, unknown>) => ({
        id: d.id as string,
        name: d.name as string,
        code: d.code as string,
      }));
    }

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', course.school_id as string);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

    return NextResponse.json({
      success: true,
      data: {
        id: course.id,
        name: course.name,
        code: course.code,
        level: typeof course.level === 'number' ? course.level : parsedLevel,
        lecturerId: course.lecturer_id,
        lecturerName: lecturer?.name,
        schoolId: course.school_id,
        schoolName,
        schoolCode,
        departmentId: course.department_id,
        departmentName: directDepartmentName,
        departments,
      },
    });
  } catch (error) {
    console.error('Update course error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const guard = requireAdmin(request);
  if (!guard.ok) return guard.response!;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Check if course has sessions
    const { data: sessions } = await db.from('sessions').select('id').eq('course_id', id);
    if (sessions && sessions.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete course with scheduled sessions. Remove sessions first.' },
        { status: 409 }
      );
    }

    // Delete course_departments links first
    await db.from('course_departments').delete().eq('course_id', id);
    // Delete course_grading links
    await db.from('course_grading').delete().eq('course_id', id);

    const { error } = await db.from('courses').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete course' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete course error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
