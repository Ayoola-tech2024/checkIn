import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';
import { validateStudentFields } from '@/lib/slit-validation';
import { SLIT_SCHOOL_ID, VALID_LEVELS } from '@/lib/constants';

export async function POST(request: NextRequest) {
  try {
    const { name, matricNumber, departmentId, level } = await request.json();

    if (!name || !matricNumber || !departmentId) {
      return NextResponse.json(
        { success: false, error: 'Name, matric number, and department are required' },
        { status: 400 }
      );
    }

    // Validate SLIT fields
    const parsedLevel = level !== undefined && level !== null
      ? (typeof level === 'number' ? level : parseInt(String(level), 10))
      : 100;

    const validation = validateStudentFields({ level: parsedLevel, departmentId });
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join('; ') },
        { status: 400 }
      );
    }

    // Ensure level is valid, default to 100
    const studentLevel = VALID_LEVELS.includes(parsedLevel as typeof VALID_LEVELS[number]) ? parsedLevel : 100;

    // Verify department exists
    const { data: depts } = await db.from('departments').select('id, name').eq('id', departmentId);
    if (!depts || depts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Department not found' },
        { status: 404 }
      );
    }

    // Check if matric number already exists
    const { data: existingStudents } = await db
      .from('students')
      .select('id')
      .eq('matric_number', matricNumber);

    if (existingStudents && existingStudents.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Student with this matric number already exists' },
        { status: 409 }
      );
    }

    const department = depts[0] as Record<string, unknown>;
    const defaultPassword = generateDefaultPassword();
    const passwordHash = await hashPassword(defaultPassword);

    const { data: students, error } = await db
      .from('students')
      .insert({
        name,
        matric_number: matricNumber,
        department_id: departmentId,
        password_hash: passwordHash,
        activated: false,
        school_id: SLIT_SCHOOL_ID,
        level: studentLevel,
      })
      .select();

    if (error || !students || students.length === 0) {
      console.error('Student creation error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to create student' },
        { status: 500 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', SLIT_SCHOOL_ID);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName: department.name,
        schoolId: student.school_id,
        schoolName,
        schoolCode,
        level: typeof student.level === 'number' ? student.level : parsedLevel,
        activated: false,
        defaultPassword,
      },
    });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, matricNumber, departmentId, level } = await request.json();

    if (!id || !name || !matricNumber || !departmentId) {
      return NextResponse.json(
        { success: false, error: 'ID, name, matric number, and department are required' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      name,
      matric_number: matricNumber,
      department_id: departmentId,
    };

    // Validate and add level if provided
    if (level !== undefined && level !== null) {
      const parsedLevel = typeof level === 'number' ? level : parseInt(String(level), 10);
      const validation = validateStudentFields({ level: parsedLevel, departmentId });
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.errors.join('; ') },
          { status: 400 }
        );
      }
      if (VALID_LEVELS.includes(parsedLevel as typeof VALID_LEVELS[number])) {
        updateData.level = parsedLevel;
      }
    }

    // Check if matric number is taken by another student
    const { data: existingStudents } = await db
      .from('students')
      .select('id')
      .eq('matric_number', matricNumber);

    if (existingStudents && existingStudents.length > 0 && (existingStudents[0] as Record<string, unknown>).id !== id) {
      return NextResponse.json(
        { success: false, error: 'Matric number is already in use by another student' },
        { status: 409 }
      );
    }

    const { data: students, error } = await db
      .from('students')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error || !students || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to update student' },
        { status: 500 }
      );
    }

    const student = students[0] as Record<string, unknown>;

    // Get department name
    let departmentName: string | undefined;
    const { data: dept } = await db.from('departments').select('name').eq('id', departmentId);
    if (dept && dept.length > 0) {
      departmentName = (dept[0] as Record<string, unknown>).name as string;
    }

    // Fetch school info
    const { data: schoolData } = await db.from('schools').select('name, code').eq('id', SLIT_SCHOOL_ID);
    const schoolName = (schoolData?.[0] as Record<string, unknown>)?.name as string | undefined;
    const schoolCode = (schoolData?.[0] as Record<string, unknown>)?.code as string | undefined;

    return NextResponse.json({
      success: true,
      data: {
        id: student.id,
        name: student.name,
        matricNumber: student.matric_number,
        departmentId: student.department_id,
        departmentName,
        schoolId: student.school_id,
        schoolName,
        schoolCode,
        level: typeof student.level === 'number' ? student.level : 100,
      },
    });
  } catch (error) {
    console.error('Update student error:', error);
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
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Delete attendance records first
    await db.from('attendances').delete().eq('student_id', id);

    const { error } = await db.from('students').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete student' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error('Delete student error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
