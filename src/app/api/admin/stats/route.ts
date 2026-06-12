import { NextResponse } from 'next/server';
import { db } from '@/lib/insforge';

export async function GET() {
  try {
    const [
      departmentsResult,
      studentsResult,
      activatedStudentsResult,
      lecturersResult,
      hodResult,
      coursesResult,
      venuesResult,
      sessionsResult,
      activeSessionsResult,
      completedSessionsResult,
      scheduledSessionsResult,
      schoolsResult,
      departmentCountsResult,
      recentSessionsResult,
    ] = await Promise.all([
      db.from('departments').select('id'),
      db.from('students').select('id'),
      db.from('students').select('id').eq('activated', true),
      db.from('lecturers').select('id'),
      db.from('lecturers').select('id').eq('is_hod', true),
      db.from('courses').select('id'),
      db.from('venues').select('id'),
      db.from('sessions').select('id'),
      db.from('sessions').select('id').eq('status', 'active'),
      db.from('sessions').select('id').eq('status', 'completed'),
      db.from('sessions').select('id').eq('status', 'scheduled'),
      db.from('schools').select('id'),
      db.from('departments').select('id, name, code'),
      db.from('sessions')
        .select('*')
        .order('scheduled_at', { ascending: false })
        .limit(5),
    ]);

    const totalStudents = studentsResult.data?.length || 0;
    const activatedStudents = activatedStudentsResult.data?.length || 0;
    const activationRate = totalStudents > 0 ? Math.round((activatedStudents / totalStudents) * 100) : 0;

    // Process department student counts - manual join
    const deptIds = (departmentCountsResult.data || []).map((d: Record<string, unknown>) => d.id as string);
    const studentsByDeptResult = deptIds.length > 0
      ? await db.from('students').select('id, department_id, activated').in('department_id', deptIds)
      : { data: [] };

    const studentsByDept = (studentsByDeptResult.data || []) as Record<string, unknown>[];

    const departmentStudentCounts = (departmentCountsResult.data || []).map((dept: Record<string, unknown>) => {
      const deptStudents = studentsByDept.filter((s: Record<string, unknown>) => s.department_id === dept.id);
      return {
        id: dept.id as string,
        name: dept.name as string,
        code: dept.code as string,
        studentCount: deptStudents.length,
        activatedCount: deptStudents.filter((s: Record<string, unknown>) => s.activated === true).length,
      };
    });

    // Process recent sessions - manual join for courses and venues
    const recentSessionsRaw = (recentSessionsResult.data || []) as Record<string, unknown>[];
    let recentSessions: Array<{ id: string; title: string; courseName: string; courseCode: string; venueName: string; status: string; scheduledAt: string }> = [];

    if (recentSessionsRaw.length > 0) {
      const courseIds = [...new Set(recentSessionsRaw.map((s: Record<string, unknown>) => s.course_id as string).filter(Boolean))];
      const venueIds = [...new Set(recentSessionsRaw.map((s: Record<string, unknown>) => s.venue_id as string).filter(Boolean))];

      const [coursesMap, venuesMap] = await Promise.all([
        courseIds.length > 0 ? db.from('courses').select('id, name, code').in('id', courseIds) : { data: [] },
        venueIds.length > 0 ? db.from('venues').select('id, name').in('id', venueIds) : { data: [] },
      ]);

      const courseLookup = Object.fromEntries(
        ((coursesMap.data || []) as Record<string, unknown>[]).map((c: Record<string, unknown>) => [c.id, c])
      );
      const venueLookup = Object.fromEntries(
        ((venuesMap.data || []) as Record<string, unknown>[]).map((v: Record<string, unknown>) => [v.id, v])
      );

      recentSessions = recentSessionsRaw.map((session: Record<string, unknown>) => {
        const course = (courseLookup[session.course_id as string] || {}) as Record<string, unknown>;
        const venue = (venueLookup[session.venue_id as string] || {}) as Record<string, unknown>;
        return {
          id: session.id as string,
          title: (session.title as string) || 'Untitled Session',
          courseName: (course.name as string) || 'Unknown Course',
          courseCode: (course.code as string) || '',
          venueName: (venue.name as string) || 'Unknown Venue',
          status: (session.status as string) || 'scheduled',
          scheduledAt: (session.scheduled_at as string) || '',
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalSchools: schoolsResult.data?.length || 0,
        totalDepartments: departmentsResult.data?.length || 0,
        totalStudents,
        activatedStudents,
        activationRate,
        totalLecturers: lecturersResult.data?.length || 0,
        totalHods: hodResult.data?.length || 0,
        totalCourses: coursesResult.data?.length || 0,
        totalVenues: venuesResult.data?.length || 0,
        totalSessions: sessionsResult.data?.length || 0,
        activeSessions: activeSessionsResult.data?.length || 0,
        completedSessions: completedSessionsResult.data?.length || 0,
        scheduledSessions: scheduledSessionsResult.data?.length || 0,
        departmentStudentCounts,
        recentSessions,
      },
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
