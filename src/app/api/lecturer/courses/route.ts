import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lecturerId = searchParams.get('lecturerId');

    if (!lecturerId) {
      return NextResponse.json(
        { success: false, error: 'Lecturer ID is required' },
        { status: 400 }
      );
    }

    // Fetch courses for this lecturer
    const { data: courses, error } = await db
      .from('courses')
      .select('*')
      .eq('lecturer_id', lecturerId)
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

    // Fetch course_departments for all courses
    const courseIds = courses.map((c: Record<string, unknown>) => c.id as string);
    const { data: courseDepts } = await db
      .from('course_departments')
      .select('*')
      .in('course_id', courseIds);

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

    const data = courses.map((c: Record<string, unknown>) => {
      const deptIdsForCourse = courseDeptMap.get(c.id as string) || [];
      const school = schoolMap.get(c.school_id as string);
      const directDept = c.department_id ? deptMap.get(c.department_id as string) : undefined;
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        level: typeof c.level === 'number' ? c.level : (typeof c.level === 'string' ? parseInt(c.level as string, 10) || 0 : 0),
        lecturerId: c.lecturer_id,
        schoolId: c.school_id,
        schoolName: school?.name,
        schoolCode: school?.code,
        departmentId: c.department_id,
        departmentName: directDept?.name,
        departments: deptIdsForCourse.map((did) => {
          const dept = deptMap.get(did);
          return {
            id: did,
            name: dept?.name || '',
            code: dept?.code || '',
          };
        }),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get lecturer courses error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
