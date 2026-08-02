## Diagnosis (root causes verified)

**1. Face capture dead on production** — `https://checkinfuta.vercel.app/wasm/face_mesh.js` → HTTP 404. The WASM assets exist in git HEAD and aren't in `.vercelignore`, but the Vercel↔GitHub integration broke when the repo was deleted/restored, so production is a stale deploy from before the restore. On localhost the files exist, so capture should work here — I'll verify in-browser.

**2. GPS "coordinates not working"** — cascading failure from `useGeoLocation` (`src/hooks/use-geo-location.ts:82-86`): `enableHighAccuracy: true` + `timeout: 8000`. Laptops (used to *start* sessions) often can't lock high-accuracy GPS in 8s → start-session fails → session has no lecturer coords → every student check-in then fails with "Session location not available."

**3. Missing role enforcement on two routes** — `/api/students` and `/api/semesters` require auth (confirmed) but no role check. A student can read the whole student list or create semesters. Lower severity than I first claimed.

**4. Blinks** — staying optional per your call. No code change needed; current behavior is correct.

## Plan

### Fix 1 — Robust GPS acquisition (`src/hooks/use-geo-location.ts`)
- Raise `timeout` from 8s → **15s** and add a **two-phase fallback**: try high-accuracy first; on timeout/error, retry with `enableHighAccuracy: false` so laptops on Wi-Fi geolocation still get coordinates instead of hard-failing. Keep `maximumAge: 60000`.
- Surface a clearer error when both phases fail.
- This is the single highest-impact fix — it unblocks session start AND student check-in.

### Fix 2 — Harden the two unprotected-by-role routes
- `src/app/api/students/route.ts`: add `getAuthUser` + restrict to `admin`/`hod`/`lecturer` (HOD already has its own scoped student list, but this top-level one is used by admin/lecturer UI). Return 403 for students.
- `src/app/api/semesters/route.ts`: GET available to any authenticated user (it's reference data), POST (create) restricted to `admin`.
- This closes the authorization gap from the audit.

### Fix 3 — Verify face capture end-to-end on localhost
- After the code fixes, drive the browser to http://localhost:3000, walk through student activation (camera + blink + capture), and confirm the descriptor is produced and stored.
- Confirm the WASM files serve locally (HTTP 200 on `/wasm/face_mesh.js`).

### Fix 4 — Leave the door open for the real production fix
- The code is correct; production is just stale. The actual fix is re-linking the restored GitHub repo to the Vercel project and triggering a redeploy. I'll do this as a final step only if you want — it needs either the Vercel CLI (authenticated on your laptop) or a fresh token. I won't push anything externally without your explicit go-ahead.

## Out of scope
- No changes to the biometric math, thresholds, or blink logic.
- No changes to the check-in/start-session route logic (it's already correct — the failure is upstream in the GPS hook).
- No refactors; minimal targeted fixes.

## Verification
- `bun run dev` still boots clean
- `/wasm/face_mesh.js` serves 200 locally
- GPS hook resolves (with fallback) on a machine without precise GPS
- The two routes return 403 for a student session, 200 for admin
- Activation + check-in flow completes in the browser end-to-end