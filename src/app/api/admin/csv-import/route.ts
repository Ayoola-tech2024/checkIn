import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/insforge';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { students } = (await request.json()) as {
      students: { name: string; matricNumber: string; department: string }[];
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

    for (const row of students) {
      try {
        if (!row.name || !row.matricNumber || !row.department) {
          skipped++;
          errors.push(`Skipped: Missing fields for ${row.matricNumber || 'unknown'}`);
          continue;
        }

        // Find or create department
        const { data: existingDepts } = await db
          .from('departments')
          .select('*')
          .or(`name.eq."${row.department}",code.eq."${row.department}"`);

        let department: Record<string, unknown> | null = null;
        if (existingDepts && existingDepts.length > 0) {
          department = existingDepts[0] as Record<string, unknown>;
        }

        if (!department) {
          const code = row.department.substring(0, 4).toUpperCase().replace(/\s/g, '');
          const { data: newDepts } = await db
            .from('departments')
            .insert({ name: row.department, code })
            .select();
          department = (newDepts?.[0] as Record<string, unknown>) || null;
        }

        if (!department) {
          skipped++;
          errors.push(`Error: Could not create/find department for ${row.matricNumber}`);
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
