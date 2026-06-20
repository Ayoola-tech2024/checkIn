# checkIn — Full Remediation Plan

**Generated:** 2026-06-20  
**Source:** Forensic audit of `stackdevfuta-cpu/checkIn` via 5 parallel deep-dive agents  
**Status:** Plan/blueprint — no edits applied yet

---

## Phase 1 — Critical Security (estimate: 2–3 hours)

### 1.1 Guard `SESSION_SECRET` — add startup throw
- **File:** `src/lib/session.ts:7`
- **Change:** Replace `process.env.SESSION_SECRET || 'checkin-dev-secret-change-in-production-32chars!'` with a guard that throws at module scope if `SESSION_SECRET` is missing.
- **Why:** Silent fallback to a public string = any attacker can forge a valid `checkin_session` JWT for any user/role on a misconfigured deploy.

### 1.2 Replace `CheckIn@2024` with FUTA-style login
- **Files:**
  - `src/app/api/admin/students/route.ts:57-101`
  - `src/app/api/admin/lecturers/route.ts:177-242`
  - `src/app/api/admin/csv-import/route.ts:20-21`
  - `src/app/api/hod/lecturers/route.ts:109-138`
  - `src/lib/auth.ts:17-19`
  - `src/app/api/auth/login/route.ts`
- **Design:**
  - **Login identifier:** Matric number for students (e.g. `BIT/2026/001`), email for lecturers/HOD/Admin
  - **Default password:** Surname in block letters (e.g. `DAMISILE`)
  - **Password change policy:** Self-service, no forced redirect at first login
- **Changes:**
  1. **`src/lib/auth.ts`**: Update `generateDefaultPassword()` to accept a `surname` parameter and return `surname.toUpperCase()`. Rename to `generateDefaultPassword(surname: string): string`.
  2. **Student creation routes**: Extract `surname` from request body (already present), pass to `generateDefaultPassword(surname)`. Return `{ defaultPassword: surname.toUpperCase(), username: matric_number }` in response.
  3. **Lecturer/Admin creation routes**: Extract `surname` from request body, pass to `generateDefaultPassword(surname)`. Return `{ defaultPassword: surname.toUpperCase(), username: email }` in response.
  4. **`src/app/api/auth/login/route.ts`**: Accept `identifier` (matric number for students, email for others) instead of a single `email` field. Look up user by the appropriate column based on role.
- **Why:** Emulates FUTA portal convention — matric number + surname in block caps. Each user's default is unique, no globally fixed string, no forced password change. Lecturers/admins keep email-based login.

### 1.3 Add defense-in-depth to `/api/admin/*` routes
- **Files:** 7 admin route files that lack `getAuthUser` calls:
  - `src/app/api/admin/stats/route.ts`
  - `src/app/api/admin/venues/route.ts`
  - `src/app/api/admin/lecturers/route.ts`
  - `src/app/api/admin/students/route.ts`
  - `src/app/api/admin/courses/route.ts`
  - `src/app/api/admin/departments/route.ts`
  - `src/app/api/admin/profile/route.ts`
- **Change:** Import and call `getAuthUser()` with role check at the top of each handler. Return 403 on mismatch.
- **Why:** Currently RBAC is 100% centralized in middleware. A single middleware bypass (matcher misconfig, future refactor) leaks the entire org dashboard.

---

## Phase 2 — Correctness Bugs (estimate: 3–4 hours)

### 2.1 Fix auto-absentee sweep — add `level` filter
- **File:** `src/app/api/student/end-session/route.ts:72`
- **Change:** Add `.eq('level', session.level)` to the student fetch query.
- **Why:** Currently fetches all department students regardless of level. A 100-level session marks 200/300/400/500-level students absent.

### 2.2 Fix `rejected_*` fall-through in absent sweep
- **File:** `src/app/api/student/end-session/route.ts:76`
- **Change:** Filter out students with `status IN ('present', 'late')` instead of excluding anyone with any attendance row. `rejected_location`, `rejected_identity`, and `pending_review` students should get an absent record.
- **Why:** Currently, students who attempted check-in but were rejected vanish from analytics entirely.

### 2.3 Add collision check at session START
- **File:** `src/app/api/lecturer/start-session/route.ts` (before the insert)
- **Change:** Query overlapping active sessions for the same venue or same department. Return 409 if found.
- **Why:** Collision is only checked at session creation, not at start-time. TOCTOU race — a session created without conflict can be started later even if another overlapping session was started in the meantime.

### 2.4 Wrap end-session in a transaction
- **File:** `src/app/api/student/end-session/route.ts:51-89`
- **Change:** Wrap `update status='completed'` and the absent-insert in a single transaction. If InsForge doesn't support transactions, add a partial-completion check and a rollback mechanism.
- **Why:** Two separate calls — if the absent insert fails, the session is permanently marked `completed` with no absentees recorded.

### 2.5 Add server-side descriptor validation (length + shape)
- **Files:**
  - `src/app/api/student/check-in/route.ts:153-156`
  - `src/app/api/student/activate/route.ts:113-119`
- **Change:** Validate `descriptor` is an array of exactly 4185 floats. Return 400 with a diagnostic message on mismatch.
- **Why:** Currently accepts any JSON-parseable string. A length mismatch silently produces similarity=0, routing the student to `rejected_identity` with zero feedback.

### 2.6 Add type/shape validation on activation `facialData`
- **File:** `src/app/api/student/activate/route.ts`
- **Change:** Beyond length, validate that every element is a finite number within the expected range for normalized landmark deltas (~ -1 to 1).
- **Why:** Prevents a malicious client from storing `{ descriptor: [] }` which permanently bricks that student's check-in.

---

## Phase 3 — HOD Authorization Gaps (estimate: 1–2 hours)

### 3.1 HOD PATCH/DELETE — add department ownership check
- **Files:**
  - `src/app/api/hod/lecturers/route.ts:147-208`
  - `src/app/api/hod/courses/route.ts:175-237`
  - `src/app/api/hod/assign/route.ts:90-111`
- **Change:** Before PATCH/DELETE, verify the resource belongs to the HOD's department via a `db.from(...).eq('department_id', hodDeptId).eq('id', targetId).single()` check. Return 403 if not found.
- **Why:** Currently accepts arbitrary client-supplied IDs with no membership check. A malicious HOD can modify resources in another department.

---

## Phase 4 — Code Quality & Constants (estimate: 1–2 hours)

### 4.1 Wire `SIMILARITY_ACCEPT` / `SIMILARITY_REVIEW` constants
- **File:** `src/lib/face-utils.ts:55,57`
- **Change:** Replace hardcoded `50` and `40` with `SIMILARITY_ACCEPT` and `SIMILARITY_REVIEW` from `src/lib/constants.ts`.
- **Why:** The constants are declared but never imported — changing them has zero effect.

### 4.2 Add RFC 4180 CSV escaping
- **File:** `src/components/export-panel.tsx:175`
- **Change:** Create `escapeCsv(value: string): string` that doubles internal quotes: `value.replace(/"/g, '""')`. Apply before wrapping in `"..."`.
- **Why:** Names containing `"` (e.g. `John "Mike" Doe`) produce malformed CSV.

### 4.3 Remove dead face-api.js model files
- **Action:** Delete `public/models/` directory (14 files, ~13 MB).
- **Why:** Zero code in `src/` references any path under `/public/models/`. The migration to MediaPipe is complete — these are dead weight.

### 4.4 Add HTTP status to `rejected_location` response
- **File:** `src/app/api/student/check-in/route.ts:133-142`
- **Change:** `NextResponse.json({...}, { status: 400 })`.
- **Why:** Currently returns 200 OK despite `success: false`.

### 4.5 Fix frontend duplicate Haversine with `passed = true` fallback
- **File:** `src/components/check-in-flow.tsx:61-80`
- **Change:** Remove the client-side Haversine reimplementation. Import and use the shared `lib/geo.ts` function, or remove entirely and trust server-side validation.
- **Why:** UX slop — student advances to face-capture only to be rejected server-side. The `passed = true` fallback when lecturer coords are missing is misleading.

### 4.6 Add GPS sanity check at session start
- **File:** `src/app/api/lecturer/start-session/route.ts`
- **Change:** Validate `lecturerLat` is within 4–14 and `lecturerLng` within 2–15 (Nigeria bounds). Reject (0,0), null island.
- **Why:** Currently only validates `parseFloat` succeeds. A lecturer can submit (0, 0) or coordinates in Antarctica.

---

## Phase 5 — Future / Major Features (estimate: 2–3 weeks)

### 5.1 Offline cache layer
- **New files:**
  - `src/lib/offline.ts` — IndexedDB wrapper via `idb` library
  - `src/components/offline-banner.tsx` — connectivity status indicator
- **Pattern:** On check-in attempt when `!navigator.onLine`, store the captured biometric + GPS evidence in IndexedDB. Register an `online` event listener. On reconnect, replay the queue.
- **Dependencies:** Add `idb` to `package.json`.
- **Why:** Currently, network failure = permanent silent data loss. The architecture is purely online-synchronous.

### 5.2 Server-side session revocation (jti denylist)
- **New table / column:** Add a `invalidated_tokens` table or a `valid` boolean column on a sessions table.
- **File:** `src/lib/session.ts:36-55`
- **Change:** Include a `jti` (JWT ID) claim on sign. On logout or admin force-logout, add `jti` to the denylist. Middleware checks denylist before accepting token.
- **Why:** Currently, logout only deletes the client cookie. A stolen JWT remains valid for 7 days with no revocation mechanism.

### 5.3 Anti-spoofing / liveness detection
- **Extend:** `src/components/face-capture.tsx`
- **Change:** Implement Eye Aspect Ratio (EAR) from MediaPipe 468-point landmarks. Require N natural blinks before enabling capture button.
- **Why:** Current "live camera only" check is trivially defeated by a photo held to the webcam. No liveness = no anti-spoofing.

### 5.4 Per-student grading with CA/exam components
- **New table:** `student_scores(student_id, course_id, ca_score, exam_score, total, semester_id)`
- **New routes:**
  - `POST /api/lecturer/grading/scores` — upsert per-student scores
  - `GET /api/lecturer/grading/scores?course_id=X&semester_id=Y` — read scores
- **Modify:** `src/components/grading-panel.tsx` to render editable per-student rows for CA and exam scores.
- **Why:** Currently, grading is purely attendance-derived at view time. No CA, no exam, no continuous assessment.

### 5.5 Self-host MediaPipe WASM
- **Action:** Copy WASM files from `node_modules/@mediapipe/face_mesh/` to `public/wasm/`.
- **File:** `src/components/face-capture.tsx:55-57`
- **Change:** Update `locateFile` to point to `'/wasm/'` instead of `'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}'`.
- **Why:** Eliminates CDN dependency on jsdelivr — biometric capture fails entirely if jsdelivr is blocked.

---

## Execution Order

| Phase | Effort | Risk Reduction | Do First? |
|---|---|---|---|
| 1 — Critical Security | 2–3h | 🔴🔴🔴 (immediate breach risk) | **Yes** |
| 2 — Correctness Bugs | 3–4h | 🟡🟡 (silent data corruption) | **Yes** |
| 3 — HOD Auth Gaps | 1–2h | 🟡 (cross-department data tampering) | Next |
| 4 — Code Quality | 1–2h | 🟢 (DX, deployment hygiene) | Next |
| 5 — Major Features | 2–3w | 🟢🟢🟢 (capability gaps) | After Phases 1–4 |

## Prerequisites

```bash
git clone https://github.com/stackdevfuta-cpu/checkIn.git
cd checkIn
npm install
```

All file paths above are relative to the repo root after cloning.
