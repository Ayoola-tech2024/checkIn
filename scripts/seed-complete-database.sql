-- ============================================================
-- checkIn: Complete Database Schema & Seed Recovery Script
-- ============================================================
-- Compatible with PostgreSQL, PostgREST, Supabase, Neon, InsForge.
-- Run this in the SQL Editor of your new database project.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Schools Table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Departments Table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Lecturers Table
CREATE TABLE IF NOT EXISTS lecturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_hod BOOLEAN DEFAULT FALSE,
  hod_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Students Table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  matric_number TEXT UNIQUE NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 100,
  activated BOOLEAN DEFAULT FALSE,
  facial_data TEXT,
  selfie_data TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Venues Table
CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Courses Table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  level INT NOT NULL DEFAULT 100,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  lecturer_id UUID REFERENCES lecturers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Course Departments (M:N)
CREATE TABLE IF NOT EXISTS course_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE(course_id, department_id)
);

-- 9. Semesters Table
CREATE TABLE IF NOT EXISTS semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  lecturer_id UUID REFERENCES lecturers(id) ON DELETE CASCADE,
  level INT NOT NULL DEFAULT 100,
  distance_threshold DOUBLE PRECISION DEFAULT 50.0,
  duration_minutes INT DEFAULT 60,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  lecturer_lat DOUBLE PRECISION,
  lecturer_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Session Departments (M:N)
CREATE TABLE IF NOT EXISTS session_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
  UNIQUE(session_id, department_id)
);

-- 12. Attendances Table
CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  similarity_score DOUBLE PRECISION,
  student_lat DOUBLE PRECISION,
  student_lng DOUBLE PRECISION,
  selfie_data TEXT,
  check_in_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, student_id)
);

-- 13. Course Gradings Table
CREATE TABLE IF NOT EXISTS course_gradings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  semester_id UUID REFERENCES semesters(id) ON DELETE CASCADE,
  total_marks DOUBLE PRECISION NOT NULL DEFAULT 100.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, semester_id)
);

-- ============================================================
-- Performance Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_attendances_session_student ON attendances(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON attendances(status);
CREATE INDEX IF NOT EXISTS idx_attendances_student_id ON attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_lecturer_status ON sessions(lecturer_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_level ON sessions(level);
CREATE INDEX IF NOT EXISTS idx_students_matric ON students(matric_number);
CREATE INDEX IF NOT EXISTS idx_students_dept_level ON students(department_id, level);
CREATE INDEX IF NOT EXISTS idx_students_activated ON students(activated);
CREATE INDEX IF NOT EXISTS idx_courses_dept_level ON courses(department_id, level);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON courses(lecturer_id);
CREATE INDEX IF NOT EXISTS idx_venues_school ON venues(school_id);

-- ============================================================
-- Seed Initial Data (SLIT, FUTA)
-- ============================================================

-- School
INSERT INTO schools (id, name, code, description) VALUES 
('4aeb5578-eedf-40c5-978f-41716224683e', 'School of Logistics and Innovation Technology', 'SLIT', 'Federal University of Technology, Akure')
ON CONFLICT (code) DO NOTHING;

-- Departments
INSERT INTO departments (id, name, code, school_id) VALUES
('7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', 'Business Information Technology', 'BIT', '4aeb5578-eedf-40c5-978f-41716224683e'),
('b4b3541c-0629-4948-b994-b0050b743fc0', 'Entrepreneurship Management Technology', 'EMT', '4aeb5578-eedf-40c5-978f-41716224683e'),
('a1a1a1a1-1111-4444-8888-111111111111', 'Financial Technology', 'FINT', '4aeb5578-eedf-40c5-978f-41716224683e'),
('a2a2a2a2-2222-4444-8888-222222222222', 'Logistics and Transport Technology', 'LTT', '4aeb5578-eedf-40c5-978f-41716224683e'),
('a3a3a3a3-3333-4444-8888-333333333333', 'Project Management Technology', 'PMT', '4aeb5578-eedf-40c5-978f-41716224683e'),
('a4a4a4a4-4444-4444-8888-444444444444', 'Procurement Management Technology', 'PRMT', '4aeb5578-eedf-40c5-978f-41716224683e'),
('a5a5a5a5-5555-4444-8888-555555555555', 'Securities and Investment Management Technology', 'SIMT', '4aeb5578-eedf-40c5-978f-41716224683e')
ON CONFLICT (code) DO NOTHING;

-- Venues (Real FUTA Campus Coordinates)
INSERT INTO venues (id, name, latitude, longitude, school_id) VALUES
('b1b1b1b1-1111-4444-8888-111111111111', 'Adekunle Ajasin Auditorium', 7.3076, 5.1395, '4aeb5578-eedf-40c5-978f-41716224683e'),
('b2b2b2b2-2222-4444-8888-222222222222', 'SLT 100 Lecture Theatre', 7.3080, 5.1400, '4aeb5578-eedf-40c5-978f-41716224683e'),
('b3b3b3b3-3333-4444-8888-333333333333', 'Engineering Lecture Hall', 7.3065, 5.1385, '4aeb5578-eedf-40c5-978f-41716224683e'),
('b4b4b4b4-4444-4444-8888-444444444444', 'Library Complex Room 1', 7.3090, 5.1398, '4aeb5578-eedf-40c5-978f-41716224683e')
ON CONFLICT DO NOTHING;

-- Admin (Password: STACK)
INSERT INTO admins (id, name, email, password_hash) VALUES
('c1c1c1c1-1111-4444-8888-111111111111', 'Stack Dev Admin', 'stackdev.futa@gmail.com', '$2b$10$eaqAmfE2P17CQuZquHfzD..faHJyuCx1.A.hkqksmgQwRDgBOEQ.G')
ON CONFLICT (email) DO NOTHING;

-- Lecturers (Passwords: NWOSU, OKONKWO, LAWAL)
INSERT INTO lecturers (id, name, email, password_hash, school_id, department_id, is_hod, hod_department_id) VALUES
('d1d1d1d1-1111-4444-8888-111111111111', 'Dr. C. Nwosu', 'c.nwosu@futa.edu.ng', '$2b$10$gIlTHJ8H2DeAYPIVvZ3JguTxP1O.Wgor2FvmOKeJAZw1T7WV7qLHW', '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', FALSE, NULL),
('d2d2d2d2-2222-4444-8888-222222222222', 'Dr. A. Okonkwo', 'a.okonkwo@futa.edu.ng', '$2b$10$PqDCwcbicGhxcRjBXWyYAuwnqWdjmKkYJfyAtzZ7.fOXcgmCrqwWO', '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', TRUE, '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b'),
('d3d3d3d3-3333-4444-8888-333333333333', 'Dr. Lawal', 'lawal@futa.edu.ng', '$2b$10$.3P4toFunTWlzWS/ykd8j.kU8A596ZcxB3ku0Dw9xTMsC3RFXob3G', '4aeb5578-eedf-40c5-978f-41716224683e', 'b4b3541c-0629-4948-b994-b0050b743fc0', FALSE, NULL)
ON CONFLICT (email) DO NOTHING;

-- Students (Default Initial Passwords: Surname in Block Capitals)
INSERT INTO students (id, name, matric_number, email, password_hash, school_id, department_id, level, activated) VALUES
('e1e1e1e1-1111-4444-8888-111111111111', 'Ayoola Damisile', 'BIT/25/9975', 'damisile.ayoola@futa.edu.ng', '$2b$10$tv57eHZHxr5QL.dxZqsnzOGeACCsDMviAO1UMO70xTsDa6gV3g8Ti', '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', 100, FALSE),
('e2e2e2e2-2222-4444-8888-222222222222', 'Ajudua Nwabunwanne', 'BIT/25/0002', 'nwabunwanne.ajudua@futa.edu.ng', '$2b$10$j8jmo6ebooNMsAiTe7eqUuQCzTAJFHnGECZFX1zOArWqG2Fx7pGhu', '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', 100, FALSE),
('e3e3e3e3-3333-4444-8888-333333333333', 'Njoku George', 'BIT/25/9900', 'george.njoku@futa.edu.ng', '$2b$10$yaKNJ21CfMPyNPUck6CVS.zOc3rSBg27uI1NbNqKtLnDl.Vgxgmym', '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', 100, FALSE),
('e4e4e4e4-4444-4444-8888-444444444444', 'Imisi Samuel', 'BIT/25/9971', 'samuel.imisi@futa.edu.ng', '$2b$10$RO60PUO/n6Q2aKrjXr/mMeAp3zmOOsasqFKNX.GPJcF4J.YiAA636', '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', 100, FALSE),
('e5e5e5e5-5555-4444-8888-555555555555', 'Adebisi Oluwatobi', 'ENT/25/0001', 'oluwatobi.adebisi@futa.edu.ng', '$2b$10$FIZ7U1m5CMeoYNqN4kHQCOPgTPcDZfDoBty7HIMcI1oKfXnYEXs5u', '4aeb5578-eedf-40c5-978f-41716224683e', 'b4b3541c-0629-4948-b994-b0050b743fc0', 100, FALSE)
ON CONFLICT (matric_number) DO NOTHING;

-- Courses
INSERT INTO courses (id, name, code, level, school_id, department_id, lecturer_id) VALUES
('f1f1f1f1-1111-4444-8888-111111111111', 'Introduction to Business Information Technology', 'BIT101', 100, '4aeb5578-eedf-40c5-978f-41716224683e', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b', 'd1d1d1d1-1111-4444-8888-111111111111'),
('f2f2f2f2-2222-4444-8888-222222222222', 'Entrepreneurship Fundamentals', 'EMT101', 100, '4aeb5578-eedf-40c5-978f-41716224683e', 'b4b3541c-0629-4948-b994-b0050b743fc0', 'd3d3d3d3-3333-4444-8888-333333333333')
ON CONFLICT (code) DO NOTHING;

-- Link Courses to Departments
INSERT INTO course_departments (course_id, department_id) VALUES
('f1f1f1f1-1111-4444-8888-111111111111', '7ceb6b1a-3a62-4d67-b7c3-f9b2aa5e321b'),
('f2f2f2f2-2222-4444-8888-222222222222', 'b4b3541c-0629-4948-b994-b0050b743fc0')
ON CONFLICT DO NOTHING;

-- Semester
INSERT INTO semesters (id, name, start_date, end_date) VALUES
('s1s1s1s1-1111-4444-8888-111111111111', '2025/2026 First Semester', '2025-10-01T00:00:00Z', '2026-03-31T23:59:59Z')
ON CONFLICT (name) DO NOTHING;
