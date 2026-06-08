import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Seed admin account
  const existingAdmin = await prisma.admin.findFirst();
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('Stackdev', 12);
    const admin = await prisma.admin.create({
      data: {
        name: 'Stack_dev',
        email: 'stackdev@futa.edu.ng',
        passwordHash,
      },
    });
    console.log('Admin created:', admin.email);
  } else {
    console.log('Admin already exists:', existingAdmin.email);
  }

  // Seed a demo semester
  const existingSemester = await prisma.semester.findFirst();
  if (!existingSemester) {
    const semester = await prisma.semester.create({
      data: {
        name: 'Harmattan 2024/2025',
        startDate: new Date('2024-10-01'),
        endDate: new Date('2025-03-31'),
      },
    });
    console.log('Semester created:', semester.name);
  } else {
    console.log('Semester already exists:', existingSemester.name);
  }

  // Seed demo departments
  const deptCount = await prisma.department.count();
  if (deptCount === 0) {
    const departments = [
      { name: 'Computer Science', code: 'CSC' },
      { name: 'Information Technology', code: 'IT' },
      { name: 'Cyber Security', code: 'CYS' },
      { name: 'Software Engineering', code: 'SEN' },
    ];
    for (const dept of departments) {
      await prisma.department.create({ data: dept });
    }
    console.log('Demo departments created');
  }

  // Seed demo venues
  const venueCount = await prisma.venue.count();
  if (venueCount === 0) {
    // FUTA coordinates: ~7.3070, 5.1360
    const venues = [
      { name: 'Obakekere Main Hall', latitude: 7.3070, longitude: 5.1360 },
      { name: 'SEET Lecture Theatre', latitude: 7.3080, longitude: 5.1370 },
      { name: 'SAAT Hall A', latitude: 7.3065, longitude: 5.1355 },
      { name: 'Digital Lab 201', latitude: 7.3075, longitude: 5.1365 },
    ];
    for (const venue of venues) {
      await prisma.venue.create({ data: venue });
    }
    console.log('Demo venues created');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
