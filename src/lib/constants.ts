// ============================================================
// checkIn - App Constants
// ============================================================

export const APP_NAME = 'checkIn';
export const APP_TAGLINE = 'Student Attendance Platform';

// Face API Model URLs
export const FACE_API_MODEL_URL = '/models';

// Attendance thresholds
export const SIMILARITY_ACCEPT = 50;
export const SIMILARITY_REVIEW = 40;

// Image compression
export const MAX_SELFIE_SIZE_KB = 150;

// Default distance threshold in meters
export const DEFAULT_DISTANCE_THRESHOLD = 50;

// GPS accuracy threshold in meters
export const GPS_ACCURACY_THRESHOLD = 50;

// Session defaults
export const DEFAULT_SESSION_DURATION = 15; // minutes

// Polling intervals
export const SESSION_POLL_INTERVAL = 5000; // 5 seconds
export const ATTENDANCE_POLL_INTERVAL = 3000; // 3 seconds

// Roles
export const ROLES = ['admin', 'lecturer', 'student'] as const;
export type UserRole = typeof ROLES[number];

// ============================================================
// SLIT School Hierarchy
// ============================================================

export const SCHOOL = 'SLIT' as const;
export const SCHOOL_FULL_NAME = 'School of Logistics and Innovation Technology';

// Valid academic levels
export const VALID_LEVELS = [100, 200, 300, 400, 500] as const;
export type ValidLevel = typeof VALID_LEVELS[number];

// SLIT departments with correct codes
export const SLIT_DEPARTMENTS = [
  { name: 'Financial Technology', code: 'FINT' },
  { name: 'Business Information Technology', code: 'BIT' },
  { name: 'Entrepreneurship Management Technology', code: 'EMT' },
  { name: 'Logistics and Transport Technology', code: 'LTT' },
  { name: 'Project Management Technology', code: 'PMT' },
  { name: 'Procurement Management Technology', code: 'PRMT' },
  { name: 'Securities and Investment Management Technology', code: 'SIMT' },
] as const;

export const SLIT_DEPT_CODES = SLIT_DEPARTMENTS.map(d => d.code);
export const SLIT_DEPT_NAMES = SLIT_DEPARTMENTS.map(d => d.name);

// Schools list (for multi-school support in the future)
export const SCHOOLS = [
  { name: 'School of Logistics and Innovation Technology', code: 'SLIT' },
] as const;

// SLIT School UUID (primary key in schools table)
export const SLIT_SCHOOL_ID = '4aeb5578-eedf-40c5-978f-41716224683e';
