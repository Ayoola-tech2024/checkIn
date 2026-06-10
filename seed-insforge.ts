// ============================================================
// checkIn - Database Seed Script (InsForge)
// ============================================================

const INSFORGE_URL = 'https://9djdhppd.us-east.insforge.app';
const INSFORGE_API_KEY = 'ik_39c8cf61aaa8029228324329603f0f49';

async function insforgeRequest(table: string, method: string, data?: unknown) {
  const url = `${INSFORGE_URL}/api/database/records/${table}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'apikey': INSFORGE_API_KEY,
    'Authorization': `Bearer ${INSFORGE_API_KEY}`,
  };

  if (method === 'GET') {
    const res = await fetch(url, { method, headers });
    return res.json();
  }

  const res = await fetch(url, {
    method,
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`  ❌ ${method} ${table} failed: ${res.status} ${text}`);
    return null;
  }

  const contentType = res.headers.get('content-type');
  if (contentType?.includes('json')) {
    return res.json();
  }
  return [];
}

async function getRecords(table: string) {
  const data = await insforgeRequest(table, 'GET');
  return Array.isArray(data) ? data : [];
}

async function seed() {
  console.log('🌱 Seeding checkIn database via InsForge...\n');

  // 1. Seed Admin
  const admins = await getRecords('admins');
  if (admins.length === 0) {
    console.log('Creating admin account...');
    // We need to hash the password first
    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash('Stackdev', 10);
    await insforgeRequest('admins', 'POST', {
      name: 'Stack_dev',
      email: 'stackdev@futa.edu.ng',
      password_hash: passwordHash,
    });
    console.log('  ✅ Admin created: Stack_dev / stackdev@futa.edu.ng / Stackdev');
  } else {
    console.log('  ⏭️  Admin already exists, skipping');
  }

  // 2. Seed Departments
  const departments = [
    { name: 'Computer Science', code: 'CSC' },
    { name: 'Information Technology', code: 'IT' },
    { name: 'Cyber Security', code: 'CYS' },
    { name: 'Software Engineering', code: 'SEN' },
  ];

  const existingDepts = await getRecords('departments');
  const existingDeptCodes = new Set(existingDepts.map((d: Record<string, unknown>) => d.code));

  const deptRecords: Record<string, unknown>[] = [];
  for (const dept of departments) {
    if (existingDeptCodes.has(dept.code)) {
      console.log(`  ⏭️  Department ${dept.code} already exists, skipping`);
      const existing = existingDepts.find((d: Record<string, unknown>) => d.code === dept.code);
      if (existing) deptRecords.push(existing);
      continue;
    }
    const result = await insforgeRequest('departments', 'POST', dept);
    if (result) {
      const record = Array.isArray(result) ? result[0] : result;
      deptRecords.push(record);
      console.log(`  ✅ Department created: ${dept.name} (${dept.code})`);
    }
  }

  // 3. Seed Venues
  const venues = [
    { name: 'Obakekere Main Hall', latitude: 7.3070, longitude: 5.1360 },
    { name: 'SEET Lecture Theatre', latitude: 7.3080, longitude: 5.1370 },
    { name: 'SAAT Hall A', latitude: 7.3065, longitude: 5.1355 },
    { name: 'Digital Lab 201', latitude: 7.3075, longitude: 5.1365 },
  ];

  const existingVenues = await getRecords('venues');
  const existingVenueNames = new Set(existingVenues.map((v: Record<string, unknown>) => v.name));

  for (const venue of venues) {
    if (existingVenueNames.has(venue.name)) {
      console.log(`  ⏭️  Venue "${venue.name}" already exists, skipping`);
      continue;
    }
    await insforgeRequest('venues', 'POST', venue);
    console.log(`  ✅ Venue created: ${venue.name}`);
  }

  // 4. Seed Semester
  const existingSemesters = await getRecords('semesters');
  if (existingSemesters.length === 0) {
    await insforgeRequest('semesters', 'POST', {
      name: 'Harmattan 2024/2025',
      start_date: '2024-10-01',
      end_date: '2025-03-31',
    });
    console.log('  ✅ Semester created: Harmattan 2024/2025');
  } else {
    console.log('  ⏭️  Semester already exists, skipping');
  }

  console.log('\n✅ Seeding complete!');
  console.log('\n📋 Login Credentials:');
  console.log('  Admin: stackdev@futa.edu.ng / Stackdev');
  console.log('  Lecturers: <email> / CheckIn@2024');
  console.log('  Students: <matric_number> / CheckIn@2024');
}

seed().catch(console.error);
