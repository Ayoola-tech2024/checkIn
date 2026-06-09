# Task 6: Migrate API Routes from Prisma/SQLite to InsForge (PostgREST)

## Agent: Migration Agent

## Summary

Migrated all 22 API route files from Prisma/SQLite to InsForge (PostgREST-compatible API). The migration replaced `import { db } from '@/lib/db'` with `import { db } from '@/lib/insforge'` and converted all Prisma ORM calls to PostgREST-style queries.

## Files Modified

1. `/src/app/api/auth/login/route.ts` - Auth login for admin/lecturer/student
2. `/src/app/api/admin/init/route.ts` - Create initial admin
3. `/src/app/api/admin/stats/route.ts` - Dashboard stats
4. `/src/app/api/admin/departments/route.ts` - CRUD departments
5. `/src/app/api/admin/lecturers/route.ts` - CRUD lecturers
6. `/src/app/api/admin/courses/route.ts` - CRUD courses with department links
7. `/src/app/api/admin/venues/route.ts` - CRUD venues
8. `/src/app/api/admin/csv-import/route.ts` - CSV student import
9. `/src/app/api/students/route.ts` - List students
10. `/src/app/api/student/sessions/route.ts` - Student sessions
11. `/src/app/api/student/activate/route.ts` - Student activation
12. `/src/app/api/student/check-in/route.ts` - Check-in with GPS+face
13. `/src/app/api/student/profile/route.ts` - Student profile
14. `/src/app/api/lecturer/sessions/route.ts` - Lecturer sessions CRUD
15. `/src/app/api/lecturer/start-session/route.ts` - Start session
16. `/src/app/api/lecturer/end-session/route.ts` - End session
17. `/src/app/api/lecturer/review-queue/route.ts` - Pending review queue
18. `/src/app/api/lecturer/review-action/route.ts` - Approve/reject review
19. `/src/app/api/lecturer/analytics/route.ts` - Session analytics
20. `/src/app/api/lecturer/grading/route.ts` - Course grading
21. `/src/app/api/lecturer/export/route.ts` - CSV export
22. `/src/app/api/semesters/route.ts` - Semesters CRUD

## Migration Patterns Applied

### Import Change
- `import { db } from '@/lib/db'` → `import { db } from '@/lib/insforge'`

### Query Conversions
| Prisma | InsForge |
|--------|----------|
| `db.model.findUnique({ where: { field } })` | `db.from('table').select('*').eq('field', value)` → take first element |
| `db.model.findFirst({ where: {} })` | `db.from('table').select('*').eq(...)` → take first element |
| `db.model.findMany({ where: {} })` | `db.from('table').select('*')` with filters |
| `db.model.create({ data: {} })` | `db.from('table').insert({}).select()` |
| `db.model.update({ where: {}, data: {} })` | `db.from('table').update({}).eq('id', id)` |
| `db.model.delete({ where: {} })` | `db.from('table').delete().eq('id', id)` |
| `db.model.count()` | `db.from('table').select('id')` → count array length |
| `db.model.upsert({})` | Try insert, if DUPLICATE error then update |
| `db.model.createMany({})` | `db.from('table').insert([array])` |
| `db.model.groupBy({})` | Fetch all data, group in JS |

### Column Name Mappings (camelCase → snake_case)
- `passwordHash` → `password_hash`
- `matricNumber` → `matric_number`
- `departmentId` → `department_id`
- `facialData` → `facial_data`
- `selfieData` → `selfie_data`
- `checkInTime` → `check_in_time`
- `similarityScore` → `similarity_score`
- `studentId` → `student_id`
- `sessionId` → `session_id`
- `courseId` → `course_id`
- `lecturerId` → `lecturer_id`
- `venueId` → `venue_id`
- `startDate` → `start_date`
- `endDate` → `end_date`
- `totalMarks` → `total_marks`
- `distanceThreshold` → `distance_threshold`
- `durationMinutes` → `duration_minutes`
- `scheduledAt` → `scheduled_at`
- `startedAt` → `started_at`
- `endsAt` → `ends_at`
- `lecturerLat` → `lecturer_lat`
- `lecturerLng` → `lecturer_lng`
- `createdAt` → `created_at`
- `updatedAt` → `updated_at`

### Table Name Mappings
- Admin → admins
- Department → departments
- Student → students
- Lecturer → lecturers
- Course → courses
- CourseDepartment → course_departments
- Venue → venues
- Session → sessions
- SessionDepartment → session_departments
- Attendance → attendances
- Semester → semesters
- CourseGrading → course_gradings

### Join Handling
- Prisma's `include` is replaced with PostgREST join syntax: `select('*, related_table(*)')`
- For complex multi-level joins (e.g., session → course → department), we fetch data in parallel and join in JS using Maps
- For junction tables (course_departments, session_departments), we query them separately and build lookup maps

### Upsert Pattern
For the check-in route's upsert on attendance (unique constraint on student_id + session_id):
- Check if existing record exists first
- If exists → update it
- If not → insert new record

For the grading route's upsert (unique on course_id + semester_id):
- Try insert first
- If DUPLICATE error → update with filter

### API Response Compatibility
All responses maintain the same camelCase field names for frontend compatibility. The snake_case database columns are mapped back to camelCase in the response objects.

## Verification
- `bun run lint` passed with no errors
- Dev server compiles all routes successfully
- No TypeScript compilation errors
