// ============================================================
// checkIn - Shared Type Definitions
// ============================================================

export type UserRole = 'admin' | 'lecturer' | 'student' | 'hod';
export type SessionStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'absent' | 'pending_review' | 'rejected_location' | 'rejected_identity' | 'pending';
export type ValidLevel = 100 | 200 | 300 | 400 | 500;

export interface SchoolInfo {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  schoolName?: string;
  schoolCode?: string;
  // Student-specific
  matricNumber?: string;
  departmentId?: string;
  departmentName?: string;
  level?: ValidLevel;
  activated?: boolean;
  // Lecturer/HOD-specific
  isHod?: boolean;
  hodDepartmentId?: string;
  hodDepartmentName?: string;
  courses?: CourseInfo[];
}

export interface DepartmentInfo {
  id: string;
  name: string;
  code: string;
  schoolId: string;
  schoolName?: string;
  studentCount?: number;
  lecturerCount?: number;
  hodName?: string;
}

export interface StudentInfo {
  id: string;
  name: string;
  matricNumber: string;
  departmentId: string;
  departmentName?: string;
  departmentCode?: string;
  schoolId: string;
  schoolName?: string;
  level: ValidLevel;
  email: string | null;
  activated: boolean;
}

export interface LecturerInfo {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  schoolName?: string;
  departmentId?: string;
  departmentName?: string;
  isHod: boolean;
  hodDepartmentId?: string;
  hodDepartmentName?: string;
  courses: CourseInfo[];
}

export interface CourseInfo {
  id: string;
  name: string;
  code: string;
  level: ValidLevel;
  schoolId: string;
  schoolName?: string;
  departmentId?: string;
  departmentName?: string;
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
  level: ValidLevel;
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
  level?: number;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
