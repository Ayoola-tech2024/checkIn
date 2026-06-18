import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';
import { SLIT_SCHOOL_ID, VALID_LEVELS, SLIT_DEPT_NAMES, SLIT_DEPT_CODES } from '@/lib/constants';
import { getAuthUser } from '@/lib/auth-context';

export async function POST(request: NextRequest) {
  try {
    const { students } = (await request.json()) as {
      students: { name: string; matricNumber: string; department: string; level?: number | string }[];
    };

    if (!students || !Array.isArray(students) || students.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Students array is required and must not be empty' },
        { status: 400 }
      );
    }

    const defaultPassword = generateDefaultPassword();
    const passwordHash = await hashPassword(defaultPassword);

    let imported = 0;
    let skipped = 0;
    let errors: string[] = [];

    // Pre-fetch all departments to minimize API calls
    const { data: allDepts } = await db.from('departments').select('*');
    const deptMap = new Map<string, Record<string, unknown>>();
    for (const d of allDepts || []) {
      const dept = d as Record<string, unknown>;
      deptMap.set((dept.name as string).toLowerCase(), dept);
      if (dept.code) {
        deptMap.set((dept.code as string).toLowerCase(), dept);
      }
    }

    for (const row of students) {
      try {
        if (!row.name || !row.matricNumber || !row.department) {
          skipped++;
          errors.push(`Skipped: Missing fields for ${row.matricNumber || 'unknown'}`);
          continue;
        }

        // Parse and validate level
        let studentLevel = 100; // default
        if (row.level !== undefined && row.level !== null) {
          const parsedLevel = typeof row.level === 'number' ? row.level : parseInt(String(row.level), 10);
          if (VALID_LEVELS.includes(parsedLevel as typeof VALID_LEVELS[number])) {
            studentLevel = parsedLevel;
          } else {
            skipped++;
            errors.push(`Skipped: Invalid level "${row.level}" for ${row.matricNumber}. Must be one of: ${VALID_LEVELS.join(', ')}`);
            continue;
          }
        }

        // SECURITY: Only allow SLIT departments — reject non-SLIT names/codes.
        const deptInput = row.department.trim();
        const isSlitDeptName = SLIT_DEPT_NAMES.some(
          (n) => n.toLowerCase() === deptInput.toLowerCase()
        );
        const isSlitDeptCode = SLIT_DEPT_CODES.some(
          (c) => c.toLowerCase() === deptInput.toLowerCase()
        );

        if (!isSlitDeptName && !isSlitDeptCode) {
          skipped++;
          errors.push(
            `Skipped: "${deptInput}" is not a valid SLIT department for ${row.matricNumber}. Valid departments: ${SLIT_DEPT_CODES.join(', ')}`
          );
          continue;
        }

        // Find department in the pre-fetched map (by name or code)
        let department = deptMap.get(deptInput.toLowerCase());

        if (!department) {
          skipped++;
          errors.push(
            `Skipped: Department "${deptInput}" is valid but not yet created in the system. Please create it first via the Departments tab. (Student: ${row.matricNumber})`
          );
          continue;
        }

        // Check if student already exists
        const { data: existingStudents } = await db
          .from('students')
          .select('id')
          .eq('matric_number', row.matricNumber);

        if (existingStudents && existingStudents.length > 0) {
          skipped++;
          errors.push(`Skipped: Student ${row.matricNumber} already exists`);
          continue;
        }

        await db.from('students').insert({
          name: row.name,
          matric_number: row.matricNumber,
          department_id: department.id,
          password_hash: passwordHash,
          activated: false,
          school_id: SLIT_SCHOOL_ID,
          level: studentLevel,
        });

        imported++;
      } catch (err) {
        skipped++;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`Error importing ${row.matricNumber || 'unknown'}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        skipped,
        total: students.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
