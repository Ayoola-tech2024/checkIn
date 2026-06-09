import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const semesterId = searchParams.get('semesterId');

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: 'Course ID is required' },
        { status: 400 }
      );
    }

    // Get course
    const { data: courses } = await db.from('courses').select('*').eq('id', courseId);
    if (!courses || courses.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Course not found' },
        { status: 404 }
      );
    }

    const course = courses[0] as Record<string, unknown>;

    // Get course_departments
    const { data: courseDepts } = await db
      .from('course_departments')
      .select('*')
      .eq('course_id', courseId);

    // Manually join departments for course_departments
    const cdDeptIds = (courseDepts || []).map((cd: Record<string, unknown>) => cd.department_id as string).filter(Boolean);
    const uniqueCdDeptIds = [...new Set(cdDeptIds)];
    let cdDeptMap = new Map<string, Record<string, unknown>>();
    if (uniqueCdDeptIds.length > 0) {
      const { data: cdDepts } = await db.from('departments').select('*').in('id', uniqueCdDeptIds);
      for (const d of cdDepts || []) {
        cdDeptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
      }
    }

    // Enrich courseDepts with department data
    const courseDeptsEnriched = (courseDepts || []).map((cd: Record<string, unknown>) => ({
      ...cd,
      departments: cdDeptMap.get(cd.department_id as string) || null,
    })) as Record<string, unknown>[];

    // Get department IDs
    const deptIds = (courseDepts || []).map((cd: Record<string, unknown>) => cd.department_id as string);

    // Get students in those departments
    let students: Record<string, unknown>[] = [];
    if (deptIds.length > 0) {
      const { data: studentsData } = await db
        .from('students')
        .select('*')
        .in('department_id', deptIds)
        .order('matric_number', { ascending: true });

      // Manually join departments for students
      const sDeptIds = (studentsData || []).map((s: Record<string, unknown>) => s.department_id as string).filter(Boolean);
      const uniqueSDeptIds = [...new Set(sDeptIds)];
      let sDeptMap = new Map<string, Record<string, unknown>>();
      if (uniqueSDeptIds.length > 0) {
        const { data: sDepts } = await db.from('departments').select('*').in('id', uniqueSDeptIds);
        for (const d of sDepts || []) {
          sDeptMap.set((d as Record<string, unknown>).id as string, d as Record<string, unknown>);
        }
      }

      students = (studentsData || []).map((s: Record<string, unknown>) => ({
        ...s,
        departments: sDeptMap.get(s.department_id as string) || null,
      })) as Record<string, unknown>[];
    }

    // Get sessions for this course, optionally filtered by semester
    let sessionsQuery = db.from('sessions').select('*').eq('course_id', courseId);
    if (semesterId) {
      // Get semester date range
      const { data: semesters } = await db.from('semesters').select('*').eq('id', semesterId);
      const semester = semesters?.[0] as Record<string, unknown> | undefined;
      if (semester) {
        sessionsQuery = sessionsQuery.gte('scheduled_at', semester.start_date as string).lte('scheduled_at', semester.end_date as string);
      }
    }
    const { data: sessionsData } = await sessionsQuery.order('scheduled_at', { ascending: true });
    const sessions = (sessionsData || []) as Record<string, unknown>[];

    // Get grading info
    let gradingQuery = db.from('course_gradings').select('*').eq('course_id', courseId);
    if (semesterId) {
      gradingQuery = gradingQuery.eq('semester_id', semesterId);
    }
    const { data: gradings } = await gradingQuery;
    const totalMarks = (gradings && gradings.length > 0) ? (gradings[0] as Record<string, unknown>).total_marks as number : 0;

    const totalSessions = sessions.length;

    // Get all attendances for these sessions
    const sessionIds = sessions.map((s: Record<string, unknown>) => s.id as string);
    let attendances: Record<string, unknown>[] = [];
    if (sessionIds.length > 0) {
      const { data: attendancesData } = await db
        .from('attendances')
        .select('*')
        .in('session_id', sessionIds);
      attendances = (attendancesData || []) as Record<string, unknown>[];
    }

    // Group students by department
    const departments = courseDeptsEnriched.map((cd: Record<string, unknown>) => {
      const dept = cd.departments as Record<string, unknown>;
      const deptStudents = students.filter(
        (s: Record<string, unknown>) => s.department_id === cd.department_id
      );

      const studentData = deptStudents.map((student: Record<string, unknown>) => {
        // Get attendance for each session
        const sessionStatuses = sessions.map((session: Record<string, unknown>) => {
          const attendance = attendances.find(
            (a: Record<string, unknown>) => a.student_id === student.id && a.session_id === session.id
          );
          return {
            date: new Date(session.scheduled_at as string).toISOString().split('T')[0],
            status: attendance ? (attendance.status as string) : 'absent',
          };
        });

        const presentCount = sessionStatuses.filter(
          (s: { status: string }) => s.status === 'present'
        ).length;
        const attendancePercentage =
          totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;
        const marks =
          totalMarks > 0
            ? Math.round((attendancePercentage / 100) * totalMarks * 100) / 100
            : 0;

        return {
          name: student.name,
          matricNumber: student.matric_number,
          sessions: sessionStatuses,
          attendancePercentage,
          marks,
        };
      });

      return {
        name: dept?.name,
        students: studentData,
      };
    });

    // Get semester name
    let semesterName = 'All Semesters';
    if (semesterId) {
      const { data: semesters } = await db.from('semesters').select('*').eq('id', semesterId);
      const semester = semesters?.[0] as Record<string, unknown> | undefined;
      if (semester) {
        semesterName = semester.name as string;
      }
    }

    const exportData = {
      courseName: course.name,
      courseCode: course.code,
      semesterName,
      departments,
    };

    return NextResponse.json({ success: true, data: exportData });
  } catch (error) {
    console.error('Export attendance error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
