// ============================================================
// checkIn - Shared Type Definitions
// ============================================================

export type UserRole = 'admin' | 'lecturer' | 'student';
export type SessionStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'pending_review' | 'rejected_location' | 'rejected_identity' | 'pending';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // Student-specific
  matricNumber?: string;
  departmentId?: string;
  departmentName?: string;
  activated?: boolean;
  // Lecturer-specific
  courses?: CourseInfo[];
}

export interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  studentCount?: number;
}

export interface StudentInfo {
  id: string;
  name: string;
  matricNumber: string;
  departmentId: string;
  departmentName?: string;
  email: string | null;
  activated: boolean;
}

export interface LecturerInfo {
  id: string;
  name: string;
  email: string;
  courses: CourseInfo[];
}

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
  level: string;
  lecturerId: string;
  lecturerName?: string;
  departments: DepartmentInfo[];
}

export interface VenueInfo {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

export interface SessionInfo {
  id: string;
  title: string;
  courseId: string;
  courseName?: string;
  courseCode?: string;
  venueId: string;
  venueName?: string;
  lecturerId: string;
  lecturerName?: string;
  level: string;
  distanceThreshold: number;
  durationMinutes: number;
  scheduledAt: string;
  startedAt: string | null;
  endsAt: string | null;
  status: SessionStatus;
  lecturerLat: number | null;
  lecturerLng: number | null;
  departments: DepartmentInfo[];
  attendanceCount?: number;
  totalTargetStudents?: number;
}

export interface AttendanceInfo {
  id: string;
  studentId: string;
  studentName?: string;
  matricNumber?: string;
  departmentName?: string;
  sessionId: string;
  status: AttendanceStatus;
  similarityScore: number | null;
  checkInTime: string | null;
  studentLat: number | null;
  studentLng: number | null;
}

export interface SemesterInfo {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface CourseGradingInfo {
  id: string;
  courseId: string;
  courseName?: string;
  semesterId: string;
  semesterName?: string;
  totalMarks: number;
}

export interface SessionAnalytics {
  session: SessionInfo;
  totalTargetStudents: number;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  rejectedCount: number;
  lateCount: number;
  attendances: AttendanceInfo[];
  absentStudents: { id: string; name: string; matricNumber: string; departmentName: string }[];
}

export interface ExportData {
  courseName: string;
  courseCode: string;
  semesterName: string;
  departments: {
    name: string;
    students: {
      name: string;
      matricNumber: string;
      sessions: { date: string; status: string }[];
      attendancePercentage: number;
      marks: number;
    }[];
  }[];
}

export interface FacialLandmarkData {
  descriptor: number[];
  landmarks: { x: number; y: number }[];
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface CheckInResult {
  success: boolean;
  stage: 'location' | 'biometric' | 'complete';
  message: string;
  similarityScore?: number;
  status?: AttendanceStatus;
}

// CSV Import types
export interface CSVStudentRow {
  name: string;
  matricNumber: string;
  department: string;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
