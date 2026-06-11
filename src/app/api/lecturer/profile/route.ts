import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { verifyPassword, hashPassword } from '@/lib/auth';

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

    const { data: lecturers, error } = await db
      .from('lecturers')
      .select('*')
      .eq('id', lecturerId);

    if (error || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lecturer not found' },
        { status: 404 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    // Fetch lecturer's courses
    const { data: lecturerCourses } = await db
      .from('courses')
      .select('*')
      .eq('lecturer_id', lecturerId);

    // For each course, fetch its departments
    const coursesWithDepts = await Promise.all(
      (lecturerCourses || []).map(async (c: Record<string, unknown>) => {
        const { data: courseDepts } = await db
          .from('course_departments')
          .select('department_id')
          .eq('course_id', c.id as string);

        const deptIds = (courseDepts || []).map(
          (cd: Record<string, unknown>) => cd.department_id as string
        );

        let departments: { id: string; name: string; code: string }[] = [];
        if (deptIds.length > 0) {
          const { data: deptData } = await db
            .from('departments')
            .select('id, name, code')
            .in('id', deptIds);
          departments = (deptData || []).map((d: Record<string, unknown>) => ({
            id: d.id as string,
            name: d.name as string,
            code: d.code as string,
          }));
        }

        return {
          id: c.id as string,
          name: c.name as string,
          code: c.code as string,
          level: (c.level as string) || '',
          lecturerId: c.lecturer_id as string,
          departments,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        id: lecturer.id,
        name: lecturer.name,
        email: lecturer.email,
        createdAt: lecturer.created_at,
        courses: coursesWithDepts,
      },
    });
  } catch (error) {
    console.error('Get lecturer profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, email, currentPassword, newPassword } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Lecturer ID is required' },
        { status: 400 }
      );
    }

    // Fetch current lecturer record
    const { data: lecturers, error: fetchError } = await db
      .from('lecturers')
      .select('*')
      .eq('id', id);

    if (fetchError || !lecturers || lecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lecturer not found' },
        { status: 404 }
      );
    }

    const lecturer = lecturers[0] as Record<string, unknown>;

    // Handle password change if both current and new passwords are provided
    if (currentPassword && newPassword) {
      if (!lecturer.password_hash) {
        return NextResponse.json(
          { success: false, error: 'No password set for this account. Please contact support.' },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(currentPassword, lecturer.password_hash as string);
      if (!isValid) {
        return NextResponse.json(
          { success: false, error: 'Current password is incorrect' },
          { status: 401 }
        );
      }

      const hashedNewPassword = await hashPassword(newPassword);
      const { error: updateError } = await db
        .from('lecturers')
        .update({ name, email, password_hash: hashedNewPassword })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    } else {
      // Update without changing password
      const { error: updateError } = await db
        .from('lecturers')
        .update({ name, email })
        .eq('id', id);

      if (updateError) {
        return NextResponse.json(
          { success: false, error: 'Failed to update profile' },
          { status: 500 }
        );
      }
    }

    // Fetch updated profile to return
    const { data: updatedLecturers, error: refetchError } = await db
      .from('lecturers')
      .select('*')
      .eq('id', id);

    if (refetchError || !updatedLecturers || updatedLecturers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch updated profile' },
        { status: 500 }
      );
    }

    const updatedLecturer = updatedLecturers[0] as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        id: updatedLecturer.id,
        name: updatedLecturer.name,
        email: updatedLecturer.email,
        createdAt: updatedLecturer.created_at,
      },
    });
  } catch (error) {
    console.error('Update lecturer profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
