import { verifyPassword } from '../src/lib/auth';
import { db } from '../src/lib/insforge';

async function testAuth() {
  console.log('Testing Admin Login...');
  const { data: admins } = await db.from('admins').select('*').eq('email', 'stackdev.futa@gmail.com');
  const adminOk = await verifyPassword('STACK', admins?.[0]?.password_hash as string);
  console.log(`Admin (stackdev.futa@gmail.com / STACK): ${adminOk ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('Testing HOD Login...');
  const { data: hods } = await db.from('lecturers').select('*').eq('email', 'a.okonkwo@futa.edu.ng');
  const hodOk = await verifyPassword('OKONKWO', hods?.[0]?.password_hash as string);
  console.log(`HOD (a.okonkwo@futa.edu.ng / OKONKWO): ${hodOk ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('Testing Lecturer Login...');
  const { data: lecs } = await db.from('lecturers').select('*').eq('email', 'c.nwosu@futa.edu.ng');
  const lecOk = await verifyPassword('NWOSU', lecs?.[0]?.password_hash as string);
  console.log(`Lecturer (c.nwosu@futa.edu.ng / NWOSU): ${lecOk ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('Testing ENT Student Login...');
  const { data: entStudents } = await db.from('students').select('*').eq('matric_number', 'ENT/25/0001');
  const entOk = await verifyPassword('OLUWATOBI', entStudents?.[0]?.password_hash as string);
  console.log(`ENT Student (ENT/25/0001 / OLUWATOBI): ${entOk ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('Testing BIT Student Login...');
  const { data: bitStudents } = await db.from('students').select('*').eq('matric_number', 'BIT/25/9975');
  const bitOk = await verifyPassword('DAMISILE', bitStudents?.[0]?.password_hash as string);
  console.log(`BIT Student (BIT/25/9975 / DAMISILE): ${bitOk ? 'PASSED ✅' : 'FAILED ❌'}`);
}

testAuth().catch(console.error);
