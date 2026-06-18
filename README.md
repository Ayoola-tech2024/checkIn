  checkIn — Student Attendance Platform

A production-grade university attendance system with **biometric face verification** (Google MediaPipe FaceMesh) and **GPS geolocation validation**. Built for the School of Logistics and Innovation Technology (SLIT) at the Federal University of Technology, Akure (FUTA).

   Features

     Role-Based Access Control (4 Roles)
- **Admin** — Creates students, faculties (schools), departments, and assigns HODs
- **HOD (Head of Department)** — Creates lecturers and assigns them to courses and levels within their department
- **Lecturer** — Creates sessions, starts attendance with GPS, reviews pending check-ins, exports data
- **Student** — Activates account with face capture, checks in to active sessions

     Biometric Verification
- **Google MediaPipe FaceMesh** (468 3D landmarks) — replaces face-api.js
- Three-way similarity routing:
  - **> 50%** → Present (verified)
  - **40–50%** → Pending Review (lecturer approves/rejects)
  - **< 40%** → Rejected (identity fraud)

     GPS Validation
- **Haversine formula** calculates distance between student and lecturer/venue
- Configurable distance threshold per session (default: 50m)
- Real validation — no demo/sandbox bypasses

     University Hierarchy
```
Faculty (School) → Department → Level (100–500) → Course
                                              → Student
```

**SLIT Departments:**
| Code | Department |
|------|-----------|
| FINT | Financial Technology |
| BIT  | Business Information Technology |
| EMT  | Entrepreneurship Management Technology |
| LTT  | Logistics and Transport Technology |
| PMT  | Project Management Technology |
| PRMT | Procurement Management Technology |
| SIMT | Securities and Investment Management Technology |

   Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript 5
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons
- **State**: Zustand (auth) + TanStack Query patterns
- **Charts**: Recharts
- **Database**: PostgreSQL via InsForge (PostgREST API)
- **Auth**: bcrypt password hashing + Zustand persisted sessions
- **Biometrics**: MediaPipe FaceMesh
- **Theming**: next-themes (light/dark mode)

Email:    stackdev@futa.edu.ng
Password: Stackdev.2026@futa
```

New lecturers and students get the default password: `CheckIn@2024` (changeable after first login).

   Project Structure

```
src/
├── app/
│   ├── api/                       API routes (auth, admin, hod, lecturer, student)
│   ├── layout.tsx                 Root layout with ThemeProvider
│   └── page.tsx                   Role-based portal switcher
├── components/
│   ├── checkin/                   Portal components (admin, hod, lecturer, student)
│   ├── ui/                        shadcn/ui components
│   ├── theme-provider.tsx         next-themes wrapper
│   └── theme-toggle.tsx           Light/dark mode toggle
├── hooks/
│   └── use-auth.ts                Zustand auth store
└── lib/
    ├── insforge.ts                PostgREST DB client
    ├── face-utils.ts              MediaPipe FaceMesh descriptor + similarity
    ├── geo.ts                     Haversine distance validation
    ├── auth.ts                    bcrypt utilities
    ├── constants.ts               SLIT departments, levels, thresholds
    └── types.ts                   TypeScript definitions
```

   API Routes

     Authentication
- `POST /api/auth/login` — Login (admin, hod, lecturer, student)

     Admin
- `GET/POST/PUT/DELETE /api/admin/students` — Student CRUD
- `GET/POST/PUT/DELETE /api/admin/lecturers` — Lecturer CRUD (incl. HOD assignment)
- `GET/POST/PUT/DELETE /api/admin/departments` — Department CRUD
- `GET/POST/PUT/DELETE /api/admin/venues` — Venue CRUD
- `GET /api/admin/stats` — Dashboard statistics
- `POST /api/admin/csv-import` — Bulk student import

     HOD
- `GET /api/hod/profile` — HOD profile + department info
- `GET/POST/PATCH/DELETE /api/hod/lecturers` — Lecturer CRUD (department-scoped)
- `GET/POST/PATCH/DELETE /api/hod/courses` — Course CRUD (department-scoped)
- `POST/DELETE /api/hod/assign` — Assign/unassign lecturer to course
- `GET /api/hod/students` — View department students
- `GET /api/hod/stats` — Department statistics

     Lecturer
- `GET/POST /api/lecturer/sessions` — Session management
- `POST /api/lecturer/start-session` — Start session (captures GPS)
- `POST /api/lecturer/end-session` — End session (marks absentees)
- `GET /api/lecturer/review-queue` — Pending review attendances
- `POST /api/lecturer/review-action` — Approve/reject pending
- `GET /api/lecturer/analytics` — Attendance analytics
- `GET/POST /api/lecturer/grading` — Course grading
- `GET /api/lecturer/export` — Export attendance CSV

     Student
- `POST /api/student/activate` — Activate account (face capture + credentials)
- `POST /api/student/check-in` — Check in to session (GPS + face verification)
- `GET /api/student/sessions` — Available sessions
- `GET /api/student/stats` — Attendance stats

   License

MIT
