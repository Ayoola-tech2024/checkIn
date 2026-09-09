import { db } from '../src/lib/insforge';

async function main() {
  console.log('INSFORGE_URL:', process.env.INSFORGE_URL);
  console.log('INSFORGE_API_KEY:', process.env.INSFORGE_API_KEY ? 'Present' : 'Missing');

  const { data: admins, error: errAdmins } = await db.from('admins').select('*');
  console.log('Admins:', admins, 'Error:', errAdmins?.message || errAdmins);

  const { data: schools, error: errSchools } = await db.from('schools').select('*');
  console.log('Schools:', schools, 'Error:', errSchools?.message || errSchools);

  const { data: departments, error: errDepts } = await db.from('departments').select('*');
  console.log('Departments:', departments, 'Error:', errDepts?.message || errDepts);

  const { data: lecturers, error: errLecturers } = await db.from('lecturers').select('*');
  console.log('Lecturers:', lecturers, 'Error:', errLecturers?.message || errLecturers);

  const { data: students, error: errStudents } = await db.from('students').select('*');
  console.log('Students:', students, 'Error:', errStudents?.message || errStudents);
}

main().catch(console.error);
