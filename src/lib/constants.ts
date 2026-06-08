// ============================================================
// checkIn - App Constants
// ============================================================

export const APP_NAME = 'checkIn';
export const APP_TAGLINE = 'Student Attendance Platform';

// Face API Model URLs (we'll use a CDN for the models)
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
