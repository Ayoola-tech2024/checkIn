---
Task ID: 1
Agent: Main
Task: Seed InsForge database, improve UI, add features, fix bugs

Work Log:
- Seeded InsForge database (admin, departments, venues, semesters already existed)
- Created missing `attendances` table in InsForge via CLI (`npx @insforge/cli db query`)
- Created `/api/admin/students` POST endpoint for single student creation
- Rewrote `globals.css` with improved theme (subtle blue/white shades, gradient backgrounds, card shadows, accent lines)
- Rewrote `login-screen.tsx` with blue gradient background, prominent logo, glassmorphism cards, gradient buttons
- Rewrote `admin-dashboard.tsx` with gradient header, elevated cards, stat-card accents, single student creation dialog
- Rewrote `lecturer-portal.tsx` with gradient header, elevated cards, session card hover effects, blue-tinted backgrounds
- Rewrote `student-portal.tsx` with gradient header, elevated cards, session card accents, blue-tinted backgrounds
- Fixed review-queue 500 error (missing attendances table)
- Verified all API endpoints work correctly
- Verified lecturer session creation shows courses properly
- Verified admin can create students one by one
- Verified student activation flow works

Stage Summary:
- All UI components now have subtle blue/white gradient backgrounds with depth and polish
- Admin can create students individually via new "Create Student" dialog
- Courses now show properly in lecturer session creation dialog
- Attendances table created in InsForge, fixing review-queue 500 error
- All API endpoints verified working
- Lint passes clean
