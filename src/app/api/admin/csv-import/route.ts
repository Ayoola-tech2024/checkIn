import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateDefaultPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { students } = await request.json() as {
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
        let department = await db.department.findFirst({
          where: {
            OR: [{ name: row.department }, { code: row.department }],
          },
        });

        if (!department) {
          const code = row.department.substring(0, 4).toUpperCase().replace(/\s/g, '');
          department = await db.department.create({
            data: {
              name: row.department,
              code,
            },
          });
        }

        // Check if student already exists
        const existing = await db.student.findUnique({
          where: { matricNumber: row.matricNumber },
        });

        if (existing) {
          skipped++;
          errors.push(`Skipped: Student ${row.matricNumber} already exists`);
          continue;
        }

        await db.student.create({
          data: {
            name: row.name,
            matricNumber: row.matricNumber,
            departmentId: department.id,
            passwordHash,
            activated: false,
          },
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
