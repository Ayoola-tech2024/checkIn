import { db } from '../src/lib/insforge';

async function main() {
  const { data: students } = await db.from('students').select('id, name, matric_number, email, password_hash');
  console.log('Total students count:', students?.length);
  console.log(students);
}

main().catch(console.error);
