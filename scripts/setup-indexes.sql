-- ============================================================
-- checkIn - Database Performance Indexes for Faculty Scaling
-- ============================================================
-- Run this script in the InsForge Postgres SQL Query Editor or via CLI
-- to ensure sub-5ms query performance during high-concurrency 
-- faculty-wide check-ins (hundreds of students checking in simultaneously).

-- 1. Attendances table indexes (Instant check-in verification & duplicate prevention)
CREATE INDEX IF NOT EXISTS idx_attendances_session_student ON attendances(session_id, student_id);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON attendances(status);
CREATE INDEX IF NOT EXISTS idx_attendances_student_id ON attendances(student_id);

-- 2. Sessions table indexes (Fast session listing & live polling)
CREATE INDEX IF NOT EXISTS idx_sessions_lecturer_status ON sessions(lecturer_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_level ON sessions(level);

-- 3. Students table indexes (Sub-millisecond authentication & activation lookups)
CREATE INDEX IF NOT EXISTS idx_students_matric ON students(matric_number);
CREATE INDEX IF NOT EXISTS idx_students_dept_level ON students(department_id, level);
CREATE INDEX IF NOT EXISTS idx_students_activated ON students(activated);

-- 4. Courses table indexes (Fast course assignment & filtering)
CREATE INDEX IF NOT EXISTS idx_courses_dept_level ON courses(department_id, level);
CREATE INDEX IF NOT EXISTS idx_courses_lecturer ON courses(lecturer_id);

-- 5. Venues table indexes
CREATE INDEX IF NOT EXISTS idx_venues_school ON venues(school_id);
