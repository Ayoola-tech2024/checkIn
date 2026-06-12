'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import type {
  DepartmentInfo,
  StudentInfo,
  LecturerInfo,
  CourseInfo,
  VenueInfo,
  ApiResponse,
} from '@/lib/types';
import Papa from 'papaparse';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Users,
  BookOpen,
  Building2,
  GraduationCap,
  MapPin,
  Upload,
  Plus,
  LogOut,
  Shield,
  Loader2,
  Search,
  FileUp,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Layers,
  CalendarDays,
  UserPlus,
  Copy,
  Pencil,
  Trash2,
  MoreVertical,
  UserCircle,
  UserCheck,
  Activity,
  Clock,
  Zap,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ProfilePanel } from './profile-panel';
import { SLIT_DEPARTMENTS, VALID_LEVELS, SCHOOL } from '@/lib/constants';

// ============================================================
// Enhanced Stats Card
// ============================================================
function EnhancedStatCard({
  title,
  value,
  icon,
  description,
  iconBg,
  iconColor,
  progressValue,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description: string;
  iconBg: string;
  iconColor: string;
  progressValue?: number;
}) {
  return (
    <Card className="card-elevated shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          </div>
          <div className={`flex items-center justify-center size-11 rounded-xl ${iconBg} ${iconColor} shrink-0`}>
            {icon}
          </div>
        </div>
        {progressValue !== undefined && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Progress</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{progressValue}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-700 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Admin Dashboard
// ============================================================
export function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [stats, setStats] = useState<{
    totalDepartments: number;
    totalStudents: number;
    activatedStudents: number;
    activationRate: number;
    totalLecturers: number;
    totalCourses: number;
    totalVenues: number;
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    scheduledSessions: number;
    departmentStudentCounts: Array<{ id: string; name: string; code: string; studentCount: number; activatedCount: number }>;
    recentSessions: Array<{ id: string; title: string; courseName: string; courseCode: string; venueName: string; status: string; scheduledAt: string }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Data state
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [lecturers, setLecturers] = useState<LecturerInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [venues, setVenues] = useState<VenueInfo[]>([]);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/admin/stats');
      const data: ApiResponse = await res.json();
      if (data.success && data.data) {
        setStats(data.data as typeof stats);
      }
    } catch {
      toast.error('Failed to load stats');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/departments');
      const data: ApiResponse<DepartmentInfo[]> = await res.json();
      if (data.success && data.data) setDepartments(data.data);
    } catch {
      toast.error('Failed to load departments');
    }
  }, []);

  const fetchStudents = useCallback(async (departmentId?: string) => {
    try {
      const url = departmentId
        ? `/api/students?departmentId=${departmentId}`
        : '/api/students';
      const res = await fetch(url);
      const data: ApiResponse<StudentInfo[]> = await res.json();
      if (data.success && data.data) setStudents(data.data);
    } catch {
      toast.error('Failed to load students');
    }
  }, []);

  const fetchLecturers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/lecturers');
      const data: ApiResponse<LecturerInfo[]> = await res.json();
      if (data.success && data.data) setLecturers(data.data);
    } catch {
      toast.error('Failed to load lecturers');
    }
  }, []);

  const fetchCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/courses');
      const data: ApiResponse<CourseInfo[]> = await res.json();
      if (data.success && data.data) setCourses(data.data);
    } catch {
      toast.error('Failed to load courses');
    }
  }, []);

  const fetchVenues = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/venues');
      const data: ApiResponse<VenueInfo[]> = await res.json();
      if (data.success && data.data) setVenues(data.data);
    } catch {
      toast.error('Failed to load venues');
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchDepartments();
    fetchStudents();
    fetchLecturers();
    fetchCourses();
    fetchVenues();
  }, [fetchStats, fetchDepartments, fetchStudents, fetchLecturers, fetchCourses, fetchVenues]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen flex flex-col bg-page-gradient">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-sm border-b header-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-white/20 text-white">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight text-white flex items-center gap-2">
                checkIn
                <Badge className="bg-white/20 text-white border-white/30 text-[10px] px-1.5 py-0 hover:bg-white/30">{SCHOOL}</Badge>
              </h1>
              <p className="text-xs text-white/70">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className="border-white/20 text-white hover:bg-white/10 hover:text-white transition-colors gap-1.5"
            >
              <UserCircle className="size-4" />
              <span className="hidden sm:inline">{user?.name}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-9 w-9 text-white/80 hover:text-red-200 hover:bg-white/10"
              title="Log out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 w-full">
        {/* Enhanced Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="card-elevated">
                <CardContent className="p-5 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))
          ) : (
            stats && (
              <>
                <EnhancedStatCard
                  title="Departments"
                  value={stats.totalDepartments}
                  icon={<Building2 className="size-5" />}
                  description="Academic departments"
                  iconBg="bg-blue-50 dark:bg-blue-950/50"
                  iconColor="text-blue-600 dark:text-blue-400"
                />
                <EnhancedStatCard
                  title="Students"
                  value={stats.totalStudents}
                  icon={<GraduationCap className="size-5" />}
                  description={`${stats.activatedStudents} of ${stats.totalStudents} activated`}
                  iconBg="bg-emerald-50 dark:bg-emerald-950/50"
                  iconColor="text-emerald-600 dark:text-emerald-400"
                />
                <EnhancedStatCard
                  title="Lecturers"
                  value={stats.totalLecturers}
                  icon={<Users className="size-5" />}
                  description="Registered lecturers"
                  iconBg="bg-violet-50 dark:bg-violet-950/50"
                  iconColor="text-violet-600 dark:text-violet-400"
                />
                <EnhancedStatCard
                  title="Courses"
                  value={stats.totalCourses}
                  icon={<BookOpen className="size-5" />}
                  description="Available courses"
                  iconBg="bg-amber-50 dark:bg-amber-950/50"
                  iconColor="text-amber-600 dark:text-amber-400"
                />
                <EnhancedStatCard
                  title="Venues"
                  value={stats.totalVenues}
                  icon={<MapPin className="size-5" />}
                  description="Check-in locations"
                  iconBg="bg-rose-50 dark:bg-rose-950/50"
                  iconColor="text-rose-600 dark:text-rose-400"
                />
                <EnhancedStatCard
                  title="Sessions"
                  value={stats.totalSessions}
                  icon={<CalendarDays className="size-5" />}
                  description={`${stats.completedSessions} completed, ${stats.scheduledSessions} scheduled`}
                  iconBg="bg-cyan-50 dark:bg-cyan-950/50"
                  iconColor="text-cyan-600 dark:text-cyan-400"
                />
                <EnhancedStatCard
                  title="Active Now"
                  value={stats.activeSessions}
                  icon={<Zap className="size-5" />}
                  description="Currently running sessions"
                  iconBg="bg-orange-50 dark:bg-orange-950/50"
                  iconColor="text-orange-600 dark:text-orange-400"
                />
                <EnhancedStatCard
                  title="Activation Rate"
                  value={`${stats.activationRate}%`}
                  icon={<UserCheck className="size-5" />}
                  description={`${stats.activatedStudents} of ${stats.totalStudents} students`}
                  iconBg="bg-emerald-50 dark:bg-emerald-950/50"
                  iconColor="text-emerald-600 dark:text-emerald-400"
                  progressValue={stats.activationRate}
                />
              </>
            )
          )}
        </div>

        {/* Charts Row */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Student Activation Donut Chart */}
            <Card className="card-elevated shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserCheck className="size-4 text-emerald-500" />
                  Student Activation Rate
                </CardTitle>
                <CardDescription>
                  Activated vs. not activated students
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Activated', value: stats.activatedStudents, color: '#10b981' },
                          { name: 'Not Activated', value: stats.totalStudents - stats.activatedStudents, color: '#f59e0b' },
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} students`, name]}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        iconType="circle"
                        iconSize={8}
                        formatter={(value: string) => (
                          <span className="text-sm text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex items-center justify-center gap-6 mt-2">
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-emerald-500" />
                    <span className="text-sm text-muted-foreground">Activated ({stats.activatedStudents})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="size-3 rounded-full bg-amber-500" />
                    <span className="text-sm text-muted-foreground">Not Activated ({stats.totalStudents - stats.activatedStudents})</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Department Distribution Bar Chart */}
            <Card className="card-elevated shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-blue-500" />
                  Department Distribution
                </CardTitle>
                <CardDescription>
                  Students per department with activation breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  {stats.departmentStudentCounts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.departmentStudentCounts.map((d) => ({
                          name: d.code || d.name,
                          Activated: d.activatedCount,
                          'Not Activated': d.studentCount - d.activatedCount,
                        }))}
                        margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: '#e5e7eb' }}
                        />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickLine={false}
                          axisLine={{ stroke: '#e5e7eb' }}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '13px' }}
                        />
                        <Legend
                          verticalAlign="top"
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: '12px', paddingBottom: '8px' }}
                        />
                        <Bar dataKey="Activated" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Not Activated" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <Building2 className="size-10 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">No departments yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recent Sessions Activity */}
        {!statsLoading && stats && stats.recentSessions.length > 0 && (
          <Card className="card-elevated shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="size-4 text-cyan-500" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest session activity across all courses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.recentSessions.map((session) => {
                  const statusConfig: Record<string, { label: string; className: string }> = {
                    active: {
                      label: 'Active',
                      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
                    },
                    completed: {
                      label: 'Completed',
                      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                    },
                    scheduled: {
                      label: 'Scheduled',
                      className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
                    },
                    ended: {
                      label: 'Ended',
                      className: 'bg-secondary text-secondary-foreground',
                    },
                  };
                  const config = statusConfig[session.status] || statusConfig.scheduled;
                  const scheduledDate = session.scheduledAt
                    ? new Date(session.scheduledAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'No date';

                  return (
                    <div
                      key={session.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-center size-10 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 shrink-0">
                        <Clock className="size-5 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm truncate">{session.title}</p>
                          <Badge className={`text-xs shrink-0 ${config.className}`}>
                            {config.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="truncate">{session.courseCode} — {session.courseName}</span>
                          <span className="shrink-0">📍 {session.venueName}</span>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                        {scheduledDate}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="students" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="students" className="gap-1.5">
              <GraduationCap className="size-4" />
              Students
            </TabsTrigger>
            <TabsTrigger value="departments" className="gap-1.5">
              <Building2 className="size-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="lecturers" className="gap-1.5">
              <Users className="size-4" />
              Lecturers
            </TabsTrigger>
            <TabsTrigger value="courses" className="gap-1.5">
              <BookOpen className="size-4" />
              Courses
            </TabsTrigger>
            <TabsTrigger value="venues" className="gap-1.5">
              <MapPin className="size-4" />
              Venues
            </TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students">
            <StudentsTab
              departments={departments}
              students={students}
              fetchStudents={fetchStudents}
              fetchDepartments={fetchDepartments}
              fetchStats={fetchStats}
            />
          </TabsContent>

          {/* Departments Tab */}
          <TabsContent value="departments">
            <DepartmentsTab
              departments={departments}
              fetchDepartments={fetchDepartments}
              fetchStats={fetchStats}
            />
          </TabsContent>

          {/* Lecturers Tab */}
          <TabsContent value="lecturers">
            <LecturersTab
              lecturers={lecturers}
              fetchLecturers={fetchLecturers}
              fetchStats={fetchStats}
            />
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses">
            <CoursesTab
              courses={courses}
              departments={departments}
              lecturers={lecturers}
              fetchCourses={fetchCourses}
              fetchStats={fetchStats}
            />
          </TabsContent>

          {/* Venues Tab */}
          <TabsContent value="venues">
            <VenuesTab
              venues={venues}
              fetchVenues={fetchVenues}
              fetchStats={fetchStats}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Profile Panel */}
      <ProfilePanel open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Footer */}
      <footer className="border-t bg-secondary/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          checkIn — Student Attendance Platform
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Row Actions Dropdown
// ============================================================
function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreVertical className="size-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit} className="gap-2">
          <Pencil className="size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDelete} variant="destructive" className="gap-2">
          <Trash2 className="size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ============================================================
// Students Tab
// ============================================================
function StudentsTab({
  departments,
  students,
  fetchStudents,
  fetchDepartments,
  fetchStats,
}: {
  departments: DepartmentInfo[];
  students: StudentInfo[];
  fetchStudents: (departmentId?: string) => Promise<void>;
  fetchDepartments: () => Promise<void>;
  fetchStats: () => Promise<void>;
}) {
  const [filterDept, setFilterDept] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ name: string; matricNumber: string; department: string }[]>([]);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number; skipped: number; errors?: string[] } | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);

  // Single student creation state
  const [createStudentOpen, setCreateStudentOpen] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentMatric, setStudentMatric] = useState('');
  const [studentDeptId, setStudentDeptId] = useState('');
  const [studentLevel, setStudentLevel] = useState<string>('100');
  const [creatingStudent, setCreatingStudent] = useState(false);

  // Edit student state
  const [editStudentOpen, setEditStudentOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<StudentInfo | null>(null);
  const [editStudentName, setEditStudentName] = useState('');
  const [editStudentMatric, setEditStudentMatric] = useState('');
  const [editStudentDeptId, setEditStudentDeptId] = useState('');
  const [editStudentLevel, setEditStudentLevel] = useState<string>('100');
  const [savingStudent, setSavingStudent] = useState(false);

  // Delete student state
  const [deleteStudentOpen, setDeleteStudentOpen] = useState(false);
  const [deleteStudent, setDeleteStudent] = useState<StudentInfo | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);
    setCsvResult(null);
    setCsvParsing(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as { name?: string; matricNumber?: string; department?: string }[];
        const valid = rows
          .filter((r) => r.name && r.matricNumber && r.department)
          .map((r) => ({
            name: r.name!,
            matricNumber: r.matricNumber!,
            department: r.department!,
          }));
        setCsvPreview(valid);
        setCsvParsing(false);
        if (valid.length === 0 && rows.length > 0) {
          toast.error('No valid rows found. Ensure CSV has columns: name, matricNumber, department');
        }
      },
      error: () => {
        toast.error('Failed to parse CSV file');
        setCsvParsing(false);
      },
    });
  };

  const handleImport = async () => {
    if (csvPreview.length === 0) return;
    setCsvImporting(true);
    setCsvResult(null);

    try {
      const res = await fetch('/api/admin/csv-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: csvPreview }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCsvResult(data.data);
        toast.success(`Imported ${data.data.imported} students`);
        fetchStudents(filterDept === 'all' ? undefined : filterDept);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch {
      toast.error('Network error during import');
    } finally {
      setCsvImporting(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentMatric.trim() || !studentDeptId) return;
    setCreatingStudent(true);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: studentName.trim(),
          matricNumber: studentMatric.trim(),
          departmentId: studentDeptId,
          level: parseInt(studentLevel, 10),
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        toast.success(
          `Student created! Default password: ${data.data.defaultPassword}`,
          { duration: 10000 }
        );
        setStudentName('');
        setStudentMatric('');
        setStudentDeptId('');
        setStudentLevel('100');
        setCreateStudentOpen(false);
        fetchStudents(filterDept === 'all' ? undefined : filterDept);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to create student');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreatingStudent(false);
    }
  };

  const openEditStudent = (s: StudentInfo) => {
    setEditStudent(s);
    setEditStudentName(s.name);
    setEditStudentMatric(s.matricNumber);
    setEditStudentDeptId(s.departmentId);
    setEditStudentLevel(String(s.level ?? 100));
    setEditStudentOpen(true);
  };

  const handleEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent || !editStudentName.trim() || !editStudentMatric.trim() || !editStudentDeptId) return;
    setSavingStudent(true);

    try {
      const res = await fetch('/api/admin/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editStudent.id,
          name: editStudentName.trim(),
          matricNumber: editStudentMatric.trim(),
          departmentId: editStudentDeptId,
          level: parseInt(editStudentLevel, 10),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Student updated successfully');
        setEditStudentOpen(false);
        fetchStudents(filterDept === 'all' ? undefined : filterDept);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to update student');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingStudent(false);
    }
  };

  const openDeleteStudent = (s: StudentInfo) => {
    setDeleteStudent(s);
    setDeleteStudentOpen(true);
  };

  const handleDeleteStudent = async () => {
    if (!deleteStudent) return;
    setDeletingStudent(true);

    try {
      const res = await fetch(`/api/admin/students?id=${deleteStudent.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Student deleted successfully');
        setDeleteStudentOpen(false);
        fetchStudents(filterDept === 'all' ? undefined : filterDept);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to delete student');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingStudent(false);
    }
  };

  const handleFilterChange = (value: string) => {
    setFilterDept(value);
    fetchStudents(value === 'all' ? undefined : value);
  };

  const filtered = students.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.matricNumber.toLowerCase().includes(q) ||
      (s.departmentName?.toLowerCase()?.includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      {/* CSV Import Section */}
      <Card className="card-elevated border-l-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Upload className="size-5" />
                CSV Import
              </CardTitle>
              <CardDescription>
                Upload a CSV file with columns: name, matricNumber, department
              </CardDescription>
            </div>
            <Dialog open={createStudentOpen} onOpenChange={setCreateStudentOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm hover:shadow-md transition-shadow">
                  <UserPlus className="size-4" />
                  Create Student
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Student</DialogTitle>
                  <DialogDescription>
                    Add a new student to the system. A default password will be generated automatically.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateStudent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="student-name">Full Name</Label>
                    <Input
                      id="student-name"
                      placeholder="e.g. John Doe"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-matric">Matric Number</Label>
                    <Input
                      id="student-matric"
                      placeholder="e.g. CSC/2024/001"
                      value={studentMatric}
                      onChange={(e) => setStudentMatric(e.target.value)}
                      required
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-dept">Department</Label>
                    <Select value={studentDeptId} onValueChange={setStudentDeptId} required>
                      <SelectTrigger id="student-dept" className="w-full">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.length === 0 ? (
                          <SelectItem value="_none" disabled>
                            No departments available
                          </SelectItem>
                        ) : (
                          departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} ({d.code})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="student-level">Level</Label>
                    <Select value={studentLevel} onValueChange={setStudentLevel}>
                      <SelectTrigger id="student-level" className="w-full">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {VALID_LEVELS.map((l) => (
                          <SelectItem key={String(l)} value={String(l)}>
                            {l} Level
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={creatingStudent || !studentName.trim() || !studentMatric.trim() || !studentDeptId}
                      className="shadow-sm hover:shadow-md transition-shadow"
                    >
                      {creatingStudent && <Loader2 className="size-4 animate-spin" />}
                      Create Student
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Label htmlFor="csv-upload" className="mb-2 block">
                Choose CSV file
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {csvParsing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            {csvPreview.length > 0 && (
              <div className="flex items-end">
                <Button
                  onClick={handleImport}
                  disabled={csvImporting}
                  className="gap-2 shadow-sm hover:shadow-md transition-shadow"
                >
                  {csvImporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <FileUp className="size-4" />
                  )}
                  Import {csvPreview.length} students
                </Button>
              </div>
            )}
          </div>

          {/* CSV Preview */}
          {csvPreview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Matric Number</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.slice(0, 50).map((row, i) => (
                      <TableRow key={i} className={i % 2 === 1 ? 'bg-primary/[0.02]' : ''}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell className="font-mono text-sm">{row.matricNumber}</TableCell>
                        <TableCell>{row.department}</TableCell>
                      </TableRow>
                    ))}
                    {csvPreview.length > 50 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                          ... and {csvPreview.length - 50} more rows
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Import Results */}
          {csvResult && (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" />
                {csvResult.imported} imported
              </div>
              {csvResult.skipped > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                  <AlertCircle className="size-4" />
                  {csvResult.skipped} skipped
                </div>
              )}
              {csvResult.errors && csvResult.errors.length > 0 && (
                <details className="w-full">
                  <summary className="text-sm text-destructive cursor-pointer flex items-center gap-1.5">
                    <XCircle className="size-4" />
                    {csvResult.errors.length} error(s) — click to view
                  </summary>
                  <div className="mt-2 rounded-lg border bg-destructive/5 p-3 max-h-32 overflow-y-auto">
                    {csvResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-destructive">{err}</p>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student List */}
      <Card className="card-elevated border-l-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="size-5" />
                Student List
              </CardTitle>
              <CardDescription>
                {filtered.length} student{filtered.length !== 1 ? 's' : ''} total
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-full sm:w-56"
                />
              </div>
              <Select value={filterDept} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="size-10 mx-auto mb-2 opacity-30" />
              <p>No students found</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Matric No.</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s, i) => (
                      <TableRow
                        key={s.id}
                        className={`hover:bg-primary/5 transition-colors ${i % 2 === 1 ? 'bg-primary/[0.02]' : ''}`}
                      >
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="font-mono text-sm">{s.matricNumber}</TableCell>
                        <TableCell>{s.departmentName}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {s.level}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.activated ? (
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100">
                              Activated
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100">
                              Not Activated
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            onEdit={() => openEditStudent(s)}
                            onDelete={() => openDeleteStudent(s)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={editStudentOpen} onOpenChange={setEditStudentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditStudent} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-student-name">Full Name</Label>
              <Input
                id="edit-student-name"
                value={editStudentName}
                onChange={(e) => setEditStudentName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student-matric">Matric Number</Label>
              <Input
                id="edit-student-matric"
                value={editStudentMatric}
                onChange={(e) => setEditStudentMatric(e.target.value)}
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student-dept">Department</Label>
              <Select value={editStudentDeptId} onValueChange={setEditStudentDeptId} required>
                <SelectTrigger id="edit-student-dept" className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-student-level">Level</Label>
              <Select value={editStudentLevel} onValueChange={setEditStudentLevel}>
                <SelectTrigger id="edit-student-level" className="w-full">
                  <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                  {VALID_LEVELS.map((l) => (
                    <SelectItem key={String(l)} value={String(l)}>
                      {l} Level
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={savingStudent || !editStudentName.trim() || !editStudentMatric.trim() || !editStudentDeptId}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {savingStudent && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Student Confirmation */}
      <AlertDialog open={deleteStudentOpen} onOpenChange={setDeleteStudentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteStudent?.name}</strong> ({deleteStudent?.matricNumber})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingStudent}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStudent}
              disabled={deletingStudent}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingStudent && <Loader2 className="size-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Departments Tab
// ============================================================
function DepartmentsTab({
  departments,
  fetchDepartments,
  fetchStats,
}: {
  departments: DepartmentInfo[];
  fetchDepartments: () => Promise<void>;
  fetchStats: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit department state
  const [editDeptOpen, setEditDeptOpen] = useState(false);
  const [editDept, setEditDept] = useState<DepartmentInfo | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptCode, setEditDeptCode] = useState('');
  const [savingDept, setSavingDept] = useState(false);

  // Delete department state
  const [deleteDeptOpen, setDeleteDeptOpen] = useState(false);
  const [deleteDept, setDeleteDept] = useState<DepartmentInfo | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    setCreating(true);

    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code: code.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Department created successfully');
        setName('');
        setCode('');
        setDialogOpen(false);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to create department');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  const openEditDept = (d: DepartmentInfo) => {
    setEditDept(d);
    setEditDeptName(d.name);
    setEditDeptCode(d.code);
    setEditDeptOpen(true);
  };

  const handleEditDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDept || !editDeptName || !editDeptCode) return;
    setSavingDept(true);

    try {
      const res = await fetch('/api/admin/departments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editDept.id, name: editDeptName, code: editDeptCode.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Department updated successfully');
        setEditDeptOpen(false);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to update department');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingDept(false);
    }
  };

  const openDeleteDept = (d: DepartmentInfo) => {
    setDeleteDept(d);
    setDeleteDeptOpen(true);
  };

  const handleDeleteDept = async () => {
    if (!deleteDept) return;
    setDeletingDept(true);

    try {
      const res = await fetch(`/api/admin/departments?id=${deleteDept.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Department deleted successfully');
        setDeleteDeptOpen(false);
        fetchDepartments();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to delete department');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingDept(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-elevated border-l-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-5" />
                Departments
              </CardTitle>
              <CardDescription>
                {departments.length} department{departments.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm hover:shadow-md transition-shadow">
                  <Plus className="size-4" />
                  Add Department
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Department</DialogTitle>
                  <DialogDescription>
                    Add a new department to the system
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="dept-name">Department Name</Label>
                    <Input
                      id="dept-name"
                      placeholder="e.g. Computer Science"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dept-code">Department Code</Label>
                    <Input
                      id="dept-code"
                      placeholder="e.g. CSC"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                      maxLength={10}
                      className="uppercase"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating} className="shadow-sm hover:shadow-md transition-shadow">
                      {creating && <Loader2 className="size-4 animate-spin" />}
                      Create Department
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="size-10 mx-auto mb-2 opacity-30" />
              <p>No departments yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d, i) => (
                    <TableRow
                      key={d.id}
                      className={`hover:bg-primary/5 transition-colors ${i % 2 === 1 ? 'bg-primary/[0.02]' : ''}`}
                    >
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {d.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.studentCount ?? 0}</TableCell>
                      <TableCell>
                        <RowActions
                          onEdit={() => openEditDept(d)}
                          onDelete={() => openDeleteDept(d)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Department Dialog */}
      <Dialog open={editDeptOpen} onOpenChange={setEditDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update department information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditDept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-dept-name">Department Name</Label>
              <Input
                id="edit-dept-name"
                value={editDeptName}
                onChange={(e) => setEditDeptName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dept-code">Department Code</Label>
              <Input
                id="edit-dept-code"
                value={editDeptCode}
                onChange={(e) => setEditDeptCode(e.target.value.toUpperCase())}
                required
                maxLength={10}
                className="uppercase"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={savingDept || !editDeptName || !editDeptCode}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {savingDept && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Department Confirmation */}
      <AlertDialog open={deleteDeptOpen} onOpenChange={setDeleteDeptOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDept?.name}</strong> ({deleteDept?.code})? This will also affect all students in this department. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDept}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDept}
              disabled={deletingDept}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingDept && <Loader2 className="size-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Lecturers Tab
// ============================================================
function LecturersTab({
  lecturers,
  fetchLecturers,
  fetchStats,
}: {
  lecturers: LecturerInfo[];
  fetchLecturers: () => Promise<void>;
  fetchStats: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [lecturerDeptCode, setLecturerDeptCode] = useState<string>('none');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit lecturer state
  const [editLecturerOpen, setEditLecturerOpen] = useState(false);
  const [editLecturer, setEditLecturer] = useState<LecturerInfo | null>(null);
  const [editLecturerName, setEditLecturerName] = useState('');
  const [editLecturerEmail, setEditLecturerEmail] = useState('');
  const [editLecturerDeptCode, setEditLecturerDeptCode] = useState<string>('none');
  const [savingLecturer, setSavingLecturer] = useState(false);

  // Delete lecturer state
  const [deleteLecturerOpen, setDeleteLecturerOpen] = useState(false);
  const [deleteLecturer, setDeleteLecturer] = useState<LecturerInfo | null>(null);
  const [deletingLecturer, setDeletingLecturer] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setCreating(true);

    try {
      const res = await fetch('/api/admin/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          departmentId: lecturerDeptCode === 'none' ? null : lecturerDeptCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lecturer created! Default password: CheckIn@2024', { duration: 10000 });
        setName('');
        setEmail('');
        setLecturerDeptCode('none');
        setDialogOpen(false);
        fetchLecturers();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to create lecturer');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  const openEditLecturer = (l: LecturerInfo) => {
    setEditLecturer(l);
    setEditLecturerName(l.name);
    setEditLecturerEmail(l.email);
    setEditLecturerDeptCode(l.departmentId ?? 'none');
    setEditLecturerOpen(true);
  };

  const handleEditLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLecturer || !editLecturerName || !editLecturerEmail) return;
    setSavingLecturer(true);

    try {
      const res = await fetch('/api/admin/lecturers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editLecturer.id,
          name: editLecturerName,
          email: editLecturerEmail,
          departmentId: editLecturerDeptCode === 'none' ? null : editLecturerDeptCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lecturer updated successfully');
        setEditLecturerOpen(false);
        fetchLecturers();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to update lecturer');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingLecturer(false);
    }
  };

  const openDeleteLecturer = (l: LecturerInfo) => {
    setDeleteLecturer(l);
    setDeleteLecturerOpen(true);
  };

  const handleDeleteLecturer = async () => {
    if (!deleteLecturer) return;
    setDeletingLecturer(true);

    try {
      const res = await fetch(`/api/admin/lecturers?id=${deleteLecturer.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lecturer deleted successfully');
        setDeleteLecturerOpen(false);
        fetchLecturers();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to delete lecturer');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingLecturer(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-elevated border-l-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-5" />
                Lecturers
              </CardTitle>
              <CardDescription>
                {lecturers.length} lecturer{lecturers.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm hover:shadow-md transition-shadow">
                  <Plus className="size-4" />
                  Add Lecturer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Lecturer</DialogTitle>
                  <DialogDescription>
                    Add a new lecturer to the system
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="lect-name">Full Name</Label>
                    <Input
                      id="lect-name"
                      placeholder="e.g. Dr. Jane Smith"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lect-email">Email</Label>
                    <Input
                      id="lect-email"
                      type="email"
                      placeholder="e.g. j.smith@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lect-dept">Department (optional)</Label>
                    <Select value={lecturerDeptCode} onValueChange={setLecturerDeptCode}>
                      <SelectTrigger id="lect-dept" className="w-full">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {SLIT_DEPARTMENTS.map((d) => (
                          <SelectItem key={d.code} value={d.code}>
                            {d.name} ({d.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating} className="shadow-sm hover:shadow-md transition-shadow">
                      {creating && <Loader2 className="size-4 animate-spin" />}
                      Create Lecturer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {lecturers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="size-10 mx-auto mb-2 opacity-30" />
              <p>No lecturers yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Courses</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lecturers.map((l, i) => (
                      <TableRow
                        key={l.id}
                        className={`hover:bg-primary/5 transition-colors ${i % 2 === 1 ? 'bg-primary/[0.02]' : ''}`}
                      >
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="text-muted-foreground">{l.email}</TableCell>
                        <TableCell>
                          {l.departmentName ? (
                            <Badge variant="outline" className="text-xs">
                              {l.departmentName}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {l.courses.length === 0 ? (
                            <span className="text-muted-foreground text-sm">No courses</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {l.courses.map((c) => (
                                <Badge key={c.id} variant="secondary" className="text-xs">
                                  {c.code}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            onEdit={() => openEditLecturer(l)}
                            onDelete={() => openDeleteLecturer(l)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Lecturer Dialog */}
      <Dialog open={editLecturerOpen} onOpenChange={setEditLecturerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lecturer</DialogTitle>
            <DialogDescription>
              Update lecturer information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditLecturer} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-lect-name">Full Name</Label>
              <Input
                id="edit-lect-name"
                value={editLecturerName}
                onChange={(e) => setEditLecturerName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lect-email">Email</Label>
              <Input
                id="edit-lect-email"
                type="email"
                value={editLecturerEmail}
                onChange={(e) => setEditLecturerEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lect-dept">Department (optional)</Label>
              <Select value={editLecturerDeptCode} onValueChange={setEditLecturerDeptCode}>
                <SelectTrigger id="edit-lect-dept" className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {SLIT_DEPARTMENTS.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={savingLecturer || !editLecturerName || !editLecturerEmail}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {savingLecturer && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Lecturer Confirmation */}
      <AlertDialog open={deleteLecturerOpen} onOpenChange={setDeleteLecturerOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lecturer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteLecturer?.name}</strong> ({deleteLecturer?.email})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingLecturer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLecturer}
              disabled={deletingLecturer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingLecturer && <Loader2 className="size-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Courses Tab
// ============================================================
function CoursesTab({
  courses,
  departments,
  lecturers,
  fetchCourses,
  fetchStats,
}: {
  courses: CourseInfo[];
  departments: DepartmentInfo[];
  lecturers: LecturerInfo[];
  fetchCourses: () => Promise<void>;
  fetchStats: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [level, setLevel] = useState<string>('100');
  const [lecturerId, setLecturerId] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit course state
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [editCourse, setEditCourse] = useState<CourseInfo | null>(null);
  const [editCourseName, setEditCourseName] = useState('');
  const [editCourseCode, setEditCourseCode] = useState('');
  const [editCourseLevel, setEditCourseLevel] = useState<string>('100');
  const [editCourseLecturerId, setEditCourseLecturerId] = useState('');
  const [editCourseDeptIds, setEditCourseDeptIds] = useState<string[]>([]);
  const [savingCourse, setSavingCourse] = useState(false);

  // Delete course state
  const [deleteCourseOpen, setDeleteCourseOpen] = useState(false);
  const [deleteCourse, setDeleteCourse] = useState<CourseInfo | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !level || !lecturerId || selectedDeptIds.length === 0) return;
    setCreating(true);

    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code: code.toUpperCase(),
          level: parseInt(level, 10),
          lecturerId,
          departmentIds: selectedDeptIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Course created successfully');
        setName('');
        setCode('');
        setLevel('');
        setLecturerId('');
        setSelectedDeptIds([]);
        setDialogOpen(false);
        fetchCourses();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to create course');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  const toggleDepartment = (deptId: string) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const toggleEditDepartment = (deptId: string) => {
    setEditCourseDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const openEditCourse = (c: CourseInfo) => {
    setEditCourse(c);
    setEditCourseName(c.name);
    setEditCourseCode(c.code);
    setEditCourseLevel(String(c.level ?? 100));
    setEditCourseLecturerId(c.lecturerId);
    setEditCourseDeptIds(c.departments.map((d) => d.id));
    setEditCourseOpen(true);
  };

  const handleEditCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCourse || !editCourseName || !editCourseCode || !editCourseLevel || !editCourseLecturerId || editCourseDeptIds.length === 0) return;
    setSavingCourse(true);

    try {
      const res = await fetch('/api/admin/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editCourse.id,
          name: editCourseName,
          code: editCourseCode.toUpperCase(),
          level: parseInt(editCourseLevel, 10),
          lecturerId: editCourseLecturerId,
          departmentIds: editCourseDeptIds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Course updated successfully');
        setEditCourseOpen(false);
        fetchCourses();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to update course');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingCourse(false);
    }
  };

  const openDeleteCourse = (c: CourseInfo) => {
    setDeleteCourse(c);
    setDeleteCourseOpen(true);
  };

  const handleDeleteCourse = async () => {
    if (!deleteCourse) return;
    setDeletingCourse(true);

    try {
      const res = await fetch(`/api/admin/courses?id=${deleteCourse.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Course deleted successfully');
        setDeleteCourseOpen(false);
        fetchCourses();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to delete course');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingCourse(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-elevated border-l-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="size-5" />
                Courses
              </CardTitle>
              <CardDescription>
                {courses.length} course{courses.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm hover:shadow-md transition-shadow">
                  <Plus className="size-4" />
                  Add Course
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Course</DialogTitle>
                  <DialogDescription>
                    Add a new course and assign it to a lecturer and departments
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-name">Course Name</Label>
                      <Input
                        id="course-name"
                        placeholder="e.g. Data Structures"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-code">Course Code</Label>
                      <Input
                        id="course-code"
                        placeholder="e.g. CSC201"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        required
                        className="uppercase"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="course-level">Level</Label>
                      <Select value={level} onValueChange={setLevel}>
                        <SelectTrigger id="course-level" className="w-full">
                          <SelectValue placeholder="Select level" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALID_LEVELS.map((l) => (
                            <SelectItem key={String(l)} value={String(l)}>
                              {l} Level
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="course-lecturer">Lecturer</Label>
                      <Select value={lecturerId} onValueChange={setLecturerId}>
                        <SelectTrigger id="course-lecturer" className="w-full">
                          <SelectValue placeholder="Select lecturer" />
                        </SelectTrigger>
                        <SelectContent>
                          {lecturers.map((l) => (
                            <SelectItem key={l.id} value={l.id}>
                              {l.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Departments</Label>
                    <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
                      {departments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No departments available. Create one first.</p>
                      ) : (
                        departments.map((d) => (
                          <label
                            key={d.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-primary/5 rounded px-1 py-0.5 transition-colors"
                          >
                            <Checkbox
                              checked={selectedDeptIds.includes(d.id)}
                              onCheckedChange={() => toggleDepartment(d.id)}
                            />
                            <span>{d.name}</span>
                            <span className="text-muted-foreground text-xs">({d.code})</span>
                          </label>
                        ))
                      )}
                    </div>
                    {selectedDeptIds.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {selectedDeptIds.length} department{selectedDeptIds.length !== 1 ? 's' : ''} selected
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={creating || selectedDeptIds.length === 0}
                      className="shadow-sm hover:shadow-md transition-shadow"
                    >
                      {creating && <Loader2 className="size-4 animate-spin" />}
                      Create Course
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {courses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="size-10 mx-auto mb-2 opacity-30" />
              <p>No courses yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Course</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Lecturer</TableHead>
                      <TableHead>Departments</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c, i) => (
                      <TableRow
                        key={c.id}
                        className={`hover:bg-primary/5 transition-colors ${i % 2 === 1 ? 'bg-primary/[0.02]' : ''}`}
                      >
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {c.code}
                          </Badge>
                        </TableCell>
                        <TableCell>{c.level}</TableCell>
                        <TableCell>{c.lecturerName}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {c.departments.map((d) => (
                              <Badge key={d.id} variant="secondary" className="text-xs">
                                {d.code}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RowActions
                            onEdit={() => openEditCourse(c)}
                            onDelete={() => openDeleteCourse(c)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Course Dialog */}
      <Dialog open={editCourseOpen} onOpenChange={setEditCourseOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update course information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCourse} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-course-name">Course Name</Label>
                <Input
                  id="edit-course-name"
                  value={editCourseName}
                  onChange={(e) => setEditCourseName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-course-code">Course Code</Label>
                <Input
                  id="edit-course-code"
                  value={editCourseCode}
                  onChange={(e) => setEditCourseCode(e.target.value.toUpperCase())}
                  required
                  className="uppercase"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-course-level">Level</Label>
                <Select value={editCourseLevel} onValueChange={setEditCourseLevel}>
                  <SelectTrigger id="edit-course-level" className="w-full">
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {VALID_LEVELS.map((l) => (
                      <SelectItem key={String(l)} value={String(l)}>
                        {l} Level
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-course-lecturer">Lecturer</Label>
                <Select value={editCourseLecturerId} onValueChange={setEditCourseLecturerId}>
                  <SelectTrigger id="edit-course-lecturer" className="w-full">
                    <SelectValue placeholder="Select lecturer" />
                  </SelectTrigger>
                  <SelectContent>
                    {lecturers.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Departments</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
                {departments.map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 text-sm cursor-pointer hover:bg-primary/5 rounded px-1 py-0.5 transition-colors"
                  >
                    <Checkbox
                      checked={editCourseDeptIds.includes(d.id)}
                      onCheckedChange={() => toggleEditDepartment(d.id)}
                    />
                    <span>{d.name}</span>
                    <span className="text-muted-foreground text-xs">({d.code})</span>
                  </label>
                ))}
              </div>
              {editCourseDeptIds.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {editCourseDeptIds.length} department{editCourseDeptIds.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={savingCourse || editCourseDeptIds.length === 0}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {savingCourse && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Course Confirmation */}
      <AlertDialog open={deleteCourseOpen} onOpenChange={setDeleteCourseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteCourse?.name}</strong> ({deleteCourse?.code})? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingCourse}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              disabled={deletingCourse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCourse && <Loader2 className="size-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Venues Tab
// ============================================================
function VenuesTab({
  venues,
  fetchVenues,
  fetchStats,
}: {
  venues: VenueInfo[];
  fetchVenues: () => Promise<void>;
  fetchStats: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Edit venue state
  const [editVenueOpen, setEditVenueOpen] = useState(false);
  const [editVenue, setEditVenue] = useState<VenueInfo | null>(null);
  const [editVenueName, setEditVenueName] = useState('');
  const [editVenueLat, setEditVenueLat] = useState('');
  const [editVenueLng, setEditVenueLng] = useState('');
  const [savingVenue, setSavingVenue] = useState(false);

  // Delete venue state
  const [deleteVenueOpen, setDeleteVenueOpen] = useState(false);
  const [deleteVenue, setDeleteVenue] = useState<VenueInfo | null>(null);
  const [deletingVenue, setDeletingVenue] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !latitude || !longitude) return;
    setCreating(true);

    try {
      const res = await fetch('/api/admin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Venue created successfully');
        setName('');
        setLatitude('');
        setLongitude('');
        setDialogOpen(false);
        fetchVenues();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to create venue');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setCreating(false);
    }
  };

  const openEditVenue = (v: VenueInfo) => {
    setEditVenue(v);
    setEditVenueName(v.name);
    setEditVenueLat(String(v.latitude));
    setEditVenueLng(String(v.longitude));
    setEditVenueOpen(true);
  };

  const handleEditVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVenue || !editVenueName || !editVenueLat || !editVenueLng) return;
    setSavingVenue(true);

    try {
      const res = await fetch('/api/admin/venues', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editVenue.id,
          name: editVenueName,
          latitude: parseFloat(editVenueLat),
          longitude: parseFloat(editVenueLng),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Venue updated successfully');
        setEditVenueOpen(false);
        fetchVenues();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to update venue');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingVenue(false);
    }
  };

  const openDeleteVenue = (v: VenueInfo) => {
    setDeleteVenue(v);
    setDeleteVenueOpen(true);
  };

  const handleDeleteVenue = async () => {
    if (!deleteVenue) return;
    setDeletingVenue(true);

    try {
      const res = await fetch(`/api/admin/venues?id=${deleteVenue.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Venue deleted successfully');
        setDeleteVenueOpen(false);
        fetchVenues();
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to delete venue');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingVenue(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="card-elevated border-l-4 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-5" />
                Venues
              </CardTitle>
              <CardDescription>
                {venues.length} venue{venues.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm hover:shadow-md transition-shadow">
                  <Plus className="size-4" />
                  Add Venue
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Venue</DialogTitle>
                  <DialogDescription>
                    Add a new venue with its GPS coordinates
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="venue-name">Venue Name</Label>
                    <Input
                      id="venue-name"
                      placeholder="e.g. Lecture Hall A"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="venue-lat">Latitude</Label>
                      <Input
                        id="venue-lat"
                        type="number"
                        step="any"
                        placeholder="e.g. 6.5244"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="venue-lng">Longitude</Label>
                      <Input
                        id="venue-lng"
                        type="number"
                        step="any"
                        placeholder="e.g. 3.3792"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating} className="shadow-sm hover:shadow-md transition-shadow">
                      {creating && <Loader2 className="size-4 animate-spin" />}
                      Create Venue
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {venues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="size-10 mx-auto mb-2 opacity-30" />
              <p>No venues yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Venue</TableHead>
                    <TableHead>Latitude</TableHead>
                    <TableHead>Longitude</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v, i) => (
                    <TableRow
                      key={v.id}
                      className={`hover:bg-primary/5 transition-colors ${i % 2 === 1 ? 'bg-primary/[0.02]' : ''}`}
                    >
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="font-mono text-sm">{v.latitude}</TableCell>
                      <TableCell className="font-mono text-sm">{v.longitude}</TableCell>
                      <TableCell>
                        <RowActions
                          onEdit={() => openEditVenue(v)}
                          onDelete={() => openDeleteVenue(v)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Venue Dialog */}
      <Dialog open={editVenueOpen} onOpenChange={setEditVenueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Venue</DialogTitle>
            <DialogDescription>
              Update venue information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditVenue} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-venue-name">Venue Name</Label>
              <Input
                id="edit-venue-name"
                value={editVenueName}
                onChange={(e) => setEditVenueName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-venue-lat">Latitude</Label>
                <Input
                  id="edit-venue-lat"
                  type="number"
                  step="any"
                  value={editVenueLat}
                  onChange={(e) => setEditVenueLat(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-venue-lng">Longitude</Label>
                <Input
                  id="edit-venue-lng"
                  type="number"
                  step="any"
                  value={editVenueLng}
                  onChange={(e) => setEditVenueLng(e.target.value)}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                disabled={savingVenue || !editVenueName || !editVenueLat || !editVenueLng}
                className="shadow-sm hover:shadow-md transition-shadow"
              >
                {savingVenue && <Loader2 className="size-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Venue Confirmation */}
      <AlertDialog open={deleteVenueOpen} onOpenChange={setDeleteVenueOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Venue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteVenue?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingVenue}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteVenue}
              disabled={deletingVenue}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingVenue && <Loader2 className="size-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
