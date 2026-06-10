import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
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

    // Fetch department details
    const deptIds = [...new Set((courseDepts || []).map((cd: Record<string, unknown>) => cd.department_id as string).filter(Boolean))];
    const deptMap = new Map<string, Record<string, unknown>>();

    if (deptIds.length > 0) {
      const { data: depts } = await db
        .from('departments')
        .select('id, name, code')
        .in('id', deptIds);
      for (const d of depts || []) {
        deptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
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

      return {
        id: c.id,
        name: c.name,
        code: c.code,
        level: c.level,
        lecturerId: c.lecturer_id,
        lecturerName: lecturer?.name,
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
      console.error('Course creation error:', courseError);
      return NextResponse.json(
        { success: false, error: 'Failed to create course' },
        { status: 500 }
      );
    }

    const course = courses[0] as Record<string, unknown>;

    // Create course_department links
    if (departmentIds.length > 0) {
      const courseDeptInserts = departmentIds.map((departmentId: string) => ({
        course_id: course.id,
        department_id: departmentId,
      }));
      await db.from('course_departments').insert(courseDeptInserts);
    }

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

export async function PUT(request: NextRequest) {
  try {
    const { id, name, code, level, lecturerId, departmentIds } = await request.json();

    if (!id || !name || !code || !level || !lecturerId) {
      return NextResponse.json(
        { success: false, error: 'ID, name, code, level, and lecturerId are required' },
        { status: 400 }
      );
    }

    // Check unique code (excluding current course)
    const { data: existingCourses } = await db.from('courses').select('id').eq('code', code);
    if (existingCourses && existingCourses.length > 0 && (existingCourses[0] as Record<string, unknown>).id !== id) {
      return NextResponse.json(
        { success: false, error: 'Course with this code already exists' },
        { status: 409 }
      );
    }

    const { data: courses, error } = await db
      .from('courses')
      .update({
        name,
        code,
        level,
        lecturer_id: lecturerId,
      })
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
        const courseDeptInserts = departmentIds.map((departmentId: string) => ({
          course_id: id,
          department_id: departmentId,
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

    // Fetch department info
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

    return NextResponse.json({
      success: true,
      data: {
        id: course.id,
        name: course.name,
        code: course.code,
        level: course.level,
        lecturerId: course.lecturer_id,
        lecturerName: lecturer?.name,
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
