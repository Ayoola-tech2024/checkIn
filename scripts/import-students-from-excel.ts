// ============================================================
// checkIn - Batch Import BIT 100L Students from Class List
// ============================================================

import fs from 'fs';
import { db } from '../src/lib/insforge';
import { hashPassword } from '../src/lib/auth';
import { randomUUID } from 'crypto';

interface RawStudent {
  sn: number;
  name: string;
  matric_number: string;
  surname: string;
  email: string;
}

const BIT_DEPT_ID = '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b';
const SLIT_SCHOOL_ID = '4aeb5578-eedf-40c5-978f-41716224683e';

async function importStudents() {
  console.log('Reading /tmp/bit_students_all.json...');
  const rawData: RawStudent[] = JSON.parse(fs.readFileSync('/tmp/bit_students_all.json', 'utf8'));
  console.log(`Loaded ${rawData.length} students from class list.`);

  // Get all existing students in DB to avoid duplicating or overwriting active sessions
  const { data: existingStudents } = await db.from('students').select('*');
  const existingMap = new Map<string, Record<string, unknown>>();
  for (const s of existingStudents || []) {
    existingMap.set(String(s.matric_number).toUpperCase(), s as Record<string, unknown>);
  }
  console.log(`Found ${existingMap.size} existing students in DB.`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of rawData) {
    const matric = item.matric_number.toUpperCase();
    const existing = existingMap.get(matric);

    // Ayoola Damisile preservation: keep existing activated state & facial vector!
    if (matric === 'BIT/25/9975' && existing) {
      console.log(`Preserving Ayoola Damisile (${matric}) with existing facial data.`);
      await db.from('students').update({
        name: item.name,
        email: existing.email || item.email,
        department_id: BIT_DEPT_ID,
        school_id: SLIT_SCHOOL_ID,
        level: 100,
      }).eq('matric_number', matric);
      skipped++;
      continue;
    }

    const passwordHash = await hashPassword(item.surname);

    if (existing) {
      // Update existing record
      await db.from('students').update({
        name: item.name,
        email: item.email,
        password_hash: passwordHash,
        department_id: BIT_DEPT_ID,
        school_id: SLIT_SCHOOL_ID,
        level: 100,
        activated: false,
        facial_data: null,
      }).eq('matric_number', matric);
      updated++;
    } else {
      // Insert new student record
      const studentId = randomUUID();
      const insertRes = await db.from('students').insert({
        id: studentId,
        name: item.name,
        matric_number: matric,
        email: item.email,
        password_hash: passwordHash,
        department_id: BIT_DEPT_ID,
        school_id: SLIT_SCHOOL_ID,
        level: 100,
        activated: false,
        facial_data: null,
      });

      if (insertRes.error) {
        console.error(`Error inserting ${matric}:`, insertRes.error);
      } else {
        inserted++;
      }
    }

    if ((inserted + updated + skipped) % 15 === 0 || (inserted + updated + skipped) === rawData.length) {
      console.log(`Processed ${inserted + updated + skipped} / ${rawData.length} students...`);
    }
  }

  console.log(`\nImport complete! Inserted: ${inserted}, Updated: ${updated}, Preserved: ${skipped}`);

  const { data: total } = await db.from('students').select('id, matric_number, name');
  console.log(`Total students now in database: ${total?.length || 0}`);
}

importStudents().catch(console.error);
