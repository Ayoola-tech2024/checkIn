import { db } from '../src/lib/insforge';

async function main() {
  const { data: admins } = await db.from('admins').select('*');
  const { data: schools } = await db.from('schools').select('*');
  const { data: departments } = await db.from('departments').select('*');
  const { data: lecturers } = await db.from('lecturers').select('*');

  console.log('=== ADMINS ===');
  console.log(JSON.stringify(admins, null, 2));

  console.log('=== SCHOOLS ===');
  console.log(JSON.stringify(schools, null, 2));

  console.log('=== DEPARTMENTS ===');
  console.log(JSON.stringify(departments, null, 2));

  console.log('=== LECTURERS ===');
  console.log(JSON.stringify(lecturers, null, 2));
}

main().catch(console.error);
