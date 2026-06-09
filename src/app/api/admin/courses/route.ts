import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
  try {
    const { data: courses, error } = await db
      .from('courses')
      .select('*, lecturers(id, name, email)')
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Internal server error' },
        { status: 500 }
      );
    }

    // Fetch course_departments for all courses
    const courseIds = (courses || []).map((c: Record<string, unknown>) => c.id);
    const { data: courseDepts } = await db
      .from('course_departments')
      .select('*, departments(id, name, code)')
      .in('course_id', courseIds.length > 0 ? courseIds : ['__none__']);

    const courseDeptMap = new Map<string, Record<string, unknown>[]>();
    for (const cd of courseDepts || []) {
      const rec = cd as Record<string, unknown>;
      const cid = rec.course_id as string;
      if (!courseDeptMap.has(cid)) courseDeptMap.set(cid, []);
      courseDeptMap.get(cid)!.push(rec);
    }

    const data = (courses || []).map((c: Record<string, unknown>) => {
      const lecturer = c.lecturers as Record<string, unknown> | null;
      const depts = courseDeptMap.get(c.id as string) || [];
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        level: c.level,
        lecturerId: c.lecturer_id,
        lecturerName: lecturer?.name,
        departments: depts.map((cd: Record<string, unknown>) => {
          const dept = cd.departments as Record<string, unknown>;
          return {
            id: dept?.id,
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
  try {
    const { name, code, level, lecturerId, departmentIds } = await request.json();

    if (!name || !code || !level || !lecturerId || !departmentIds || !Array.isArray(departmentIds)) {
      return NextResponse.json(
        { success: false, error: 'Name, code, level, lecturerId, and departmentIds are required' },
        { status: 400 }
      );
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
    const { data: courses, error: courseError } = await db
      .from('courses')
      .insert({
        name,
        code,
        level,
        lecturer_id: lecturerId,
      })
      .select();

    if (courseError || !courses || courses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to create course' },
        { status: 500 }
      );
    }

    const course = courses[0] as Record<string, unknown>;

    // Create course_department links
    const courseDeptInserts = departmentIds.map((departmentId: string) => ({
      course_id: course.id,
      department_id: departmentId,
    }));

    await db.from('course_departments').insert(courseDeptInserts);

    // Fetch lecturer info
    const { data: lecturerData } = await db
      .from('lecturers')
      .select('id, name, email')
      .eq('id', lecturerId);
    const lecturer = (lecturerData?.[0] as Record<string, unknown>) || null;

    // Fetch department info for linked departments
    const { data: deptData } = await db
      .from('departments')
      .select('id, name, code')
      .in('id', departmentIds);

    return NextResponse.json({
      success: true,
      data: {
        id: course.id,
        name: course.name,
        code: course.code,
        level: course.level,
        lecturerId: course.lecturer_id,
        lecturerName: lecturer?.name,
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
