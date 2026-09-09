import { db } from '../src/lib/insforge';
import { hashPassword } from '../src/lib/auth';

async function runCredentialUpdates() {
  console.log('====================================================');
  console.log('    checkIn Database Credentials & User Provisioning');
  console.log('====================================================\n');

  // 1. Clear admins table and create single main admin
  console.log('[1/4] Updating Admins table...');
  const { data: existingAdmins, error: getAdminsErr } = await db.from('admins').select('id');
  if (getAdminsErr) {
    console.error('Failed to fetch existing admins:', getAdminsErr);
  } else if (existingAdmins && existingAdmins.length > 0) {
    for (const adm of existingAdmins) {
      await db.from('admins').delete().eq('id', adm.id as string);
    }
  }

  const adminPasswordHash = await hashPassword('STACK');
  const { data: newAdmin, error: createAdminErr } = await db.from('admins').insert({
    name: 'Stack Dev Admin',
    email: 'stackdev.futa@gmail.com',
    password_hash: adminPasswordHash,
  });

  if (createAdminErr) {
    console.error('Error creating admin stackdev.futa@gmail.com:', createAdminErr);
  } else {
    console.log('✅ Single Admin created: stackdev.futa@gmail.com / STACK');
  }

  // Fetch school and departments
  const { data: schools } = await db.from('schools').select('id').eq('code', 'SLIT');
  const schoolId = (schools?.[0]?.id as string) || '4aeb5578-eedf-40c5-978f-41716224683e';

  const { data: bitDept } = await db.from('departments').select('id').eq('code', 'BIT');
  const bitDeptId = (bitDept?.[0]?.id as string) || '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b';

  const { data: entDept } = await db.from('departments').select('id').eq('code', 'EMT');
  const entDeptId = (entDept?.[0]?.id as string) || 'b4b3541c-0629-4948-b994-b0050b743fc0';

  // 2. Update Lecturers & HODs
  console.log('\n[2/4] Updating Lecturers & HODs passwords...');
  const { data: lecturers } = await db.from('lecturers').select('*');

  if (lecturers && lecturers.length > 0) {
    for (const lec of lecturers) {
      const name = lec.name as string;
      let surname = '';
      let email = lec.email as string;

      if (name.includes('Lawal')) {
        surname = 'LAWAL';
        email = 'lawal@futa.edu.ng'; // Avoid conflict with admin email
      } else if (name.includes('Nwosu')) {
        surname = 'NWOSU';
      } else if (name.includes('Okonkwo')) {
        surname = 'OKONKWO';
      } else {
        surname = name.split(' ').pop()?.toUpperCase() || 'PASSWORD';
      }

      const passHash = await hashPassword(surname);
      const { error: updateErr } = await db.from('lecturers').update({
        email,
        password_hash: passHash,
      }).eq('id', lec.id as string);

      if (updateErr) {
        console.error(`Failed to update lecturer ${name}:`, updateErr);
      } else {
        console.log(`✅ Updated Lecturer/HOD: ${name} (${email}) -> Password: ${surname}`);
      }
    }
  }

  // 3. Update & provision Students for BIT and ENT
  console.log('\n[3/4] Provisioning & Updating Students (BIT & ENT)...');
  
  const studentList = [
    {
      name: 'Ayoola Damisile',
      matric_number: 'BIT/25/9975',
      department_id: bitDeptId,
      surname: 'DAMISILE',
      email: 'damisile.ayoola@futa.edu.ng',
    },
    {
      name: 'Ajudua Nwabunwanne',
      matric_number: 'BIT/25/0002',
      department_id: bitDeptId,
      surname: 'NWABUNWANNE',
      email: 'nwabunwanne.ajudua@futa.edu.ng',
    },
    {
      name: 'Njoku George',
      matric_number: 'BIT/25/9900',
      department_id: bitDeptId,
      surname: 'GEORGE',
      email: 'george.njoku@futa.edu.ng',
    },
    {
      name: 'Imisi Samuel',
      matric_number: 'BIT/25/9971',
      department_id: bitDeptId,
      surname: 'SAMUEL',
      email: 'samuel.imisi@futa.edu.ng',
    },
    {
      name: 'Adebisi Oluwatobi',
      matric_number: 'ENT/25/0001', // ENT prefix as requested
      department_id: entDeptId,
      surname: 'OLUWATOBI',
      email: 'oluwatobi.adebisi@futa.edu.ng',
    },
  ];

  for (const st of studentList) {
    const passHash = await hashPassword(st.surname);

    // Check if student exists by name or matric
    const { data: existingByName } = await db.from('students').select('*').eq('name', st.name);

    if (existingByName && existingByName.length > 0) {
      const existingId = existingByName[0].id as string;
      const { error: updErr } = await db.from('students').update({
        matric_number: st.matric_number,
        department_id: st.department_id,
        school_id: schoolId,
        password_hash: passHash,
      }).eq('id', existingId);

      if (updErr) {
        console.error(`Failed to update student ${st.name}:`, updErr);
      } else {
        console.log(`✅ Updated Student: ${st.name} (${st.matric_number}) -> Password: ${st.surname}`);
      }
    } else {
      // Create new student
      const { error: insErr } = await db.from('students').insert({
        name: st.name,
        matric_number: st.matric_number,
        email: st.email,
        department_id: st.department_id,
        school_id: schoolId,
        level: 100,
        activated: false,
        password_hash: passHash,
      });

      if (insErr) {
        console.error(`Failed to insert student ${st.name}:`, insErr);
      } else {
        console.log(`✅ Created Student: ${st.name} (${st.matric_number}) -> Password: ${st.surname}`);
      }
    }
  }

  // 4. Verification
  console.log('\n[4/4] Verifying Final DB Credentials...');
  const { data: finalAdmins } = await db.from('admins').select('name, email');
  const { data: finalLecturers } = await db.from('lecturers').select('name, email, is_hod');
  const { data: finalStudents } = await db.from('students').select('name, matric_number, level');

  console.log('\n--- Final Admin ---');
  console.table(finalAdmins);

  console.log('\n--- Final Lecturers/HODs ---');
  console.table(finalLecturers);

  console.log('\n--- Final Students ---');
  console.table(finalStudents);

  console.log('\n====================================================');
  console.log('          All Credentials Successfully Updated!      ');
  console.log('====================================================');
}

runCredentialUpdates().catch(console.error);
