// ============================================================
// checkIn - HOD Portal Component
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LogOut,
  Plus,
  Users,
  BookOpen,
  GraduationCap,
  Loader2,
  RefreshCw,
  Building2,
  ShieldCheck,
  Trash2,
  Edit2,
  UserPlus,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart3,
  UserCheck,
  ClipboardList,
  TrendingUp,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuthStore } from '@/hooks/use-auth';
import { ProfilePanel } from '@/components/checkin/profile-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import type { ApiResponse } from '@/lib/types';
import { VALID_LEVELS, SCHOOL } from '@/lib/constants';
import { toast } from 'sonner';

interface HodDepartment {
  id: string;
  name: string;
  code: string;
  schoolId: string;
  schoolName?: string;
  schoolCode?: string;
}

interface HodLecturer {
  id: string;
  name: string;
  email: string;
  departmentId: string;
  isHod: boolean;
  hodDepartmentId?: string;
  courses: { id: string; name: string; code: string; level: number }[];
}

interface HodCourse {
  id: string;
  name: string;
  code: string;
  level: number;
  departmentId: string;
  lecturerId?: string;
  lecturerName?: string;
}

interface HodStudent {
  id: string;
  name: string;
  matricNumber: string;
  email: string | null;
  level: number;
  activated: boolean;
  departmentId: string;
}

interface HodStats {
  lecturerCount: number;
  courseCount: number;
  studentCount: number;
  activatedCount: number;
  activationRate: number;
  studentsByLevel: Record<number, number>;
  coursesByLevel: Record<number, number>;
  activeSessions: number;
}

const CHART_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

export function HodPortal() {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<HodDepartment | null>(null);
  const [lecturers, setLecturers] = useState<HodLecturer[]>([]);
  const [courses, setCourses] = useState<HodCourse[]>([]);
  const [students, setStudents] = useState<HodStudent[]>([]);
  const [stats, setStats] = useState<HodStats | null>(null);
  const [showProfile, setShowProfile] = useState(false);

  // Dialogs
  const [lecturerDialogOpen, setLecturerDialogOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [editLecturerDialogOpen, setEditLecturerDialogOpen] = useState(false);
  const [editCourseDialogOpen, setEditCourseDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'lecturer' | 'course'; id: string; name: string } | null>(null);

  // Form state
  const [lecturerForm, setLecturerForm] = useState({ name: '', email: '' });
  const [courseForm, setCourseForm] = useState({ name: '', code: '', level: '100', lecturerId: '' });
  const [assignForm, setAssignForm] = useState({ courseId: '', lecturerId: '' });
  const [editLecturerForm, setEditLecturerForm] = useState({ id: '', name: '', email: '' });
  const [editCourseForm, setEditCourseForm] = useState({ id: '', name: '', code: '', level: '100', lecturerId: '' });
  const [formLoading, setFormLoading] = useState(false);

  // Filter
  const [studentLevelFilter, setStudentLevelFilter] = useState<string>('all');
  const [courseLevelFilter, setCourseLevelFilter] = useState<string>('all');

  const hodDeptId = user?.hodDepartmentId || user?.departmentId;

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!hodDeptId || !user?.id) return;
    setLoading(true);
    try {
      const [profileRes, lecturersRes, coursesRes, studentsRes, statsRes] = await Promise.all([
        fetch(`/api/hod/profile?lecturerId=${user.id}`),
        fetch(`/api/hod/lecturers?departmentId=${hodDeptId}`),
        fetch(`/api/hod/courses?departmentId=${hodDeptId}`),
        fetch(`/api/hod/students?departmentId=${hodDeptId}`),
        fetch(`/api/hod/stats?departmentId=${hodDeptId}`),
      ]);

      const profileData = await profileRes.json();
      if (profileData.success && profileData.data?.department) {
        setDepartment(profileData.data.department);
      }

      const lecturersData = await lecturersRes.json();
      if (lecturersData.success) setLecturers(lecturersData.data || []);

      const coursesData = await coursesRes.json();
      if (coursesData.success) setCourses(coursesData.data || []);

      const studentsData = await studentsRes.json();
      if (studentsData.success) {
        setStudents(studentsData.data?.students || []);
      }

      const statsData = await statsRes.json();
      if (statsData.success) setStats(statsData.data);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Failed to load department data');
    } finally {
      setLoading(false);
    }
  }, [hodDeptId, user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Create lecturer
  const handleCreateLecturer = async () => {
    if (!lecturerForm.name || !lecturerForm.email) {
      toast.error('Name and email are required');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/hod/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: lecturerForm.name,
          email: lecturerForm.email,
          departmentId: hodDeptId,
          schoolId: user?.schoolId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Lecturer created. Default password: ${data.data.defaultPassword}`);
        setLecturerDialogOpen(false);
        setLecturerForm({ name: '', email: '' });
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create lecturer');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit lecturer
  const handleEditLecturer = async () => {
    if (!editLecturerForm.name || !editLecturerForm.email) {
      toast.error('Name and email are required');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/hod/lecturers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturerId: editLecturerForm.id,
          name: editLecturerForm.name,
          email: editLecturerForm.email,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lecturer updated');
        setEditLecturerDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update lecturer');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  // Create course
  const handleCreateCourse = async () => {
    if (!courseForm.name || !courseForm.code) {
      toast.error('Name and code are required');
      return;
    }
    if (!courseForm.lecturerId) {
      toast.error('A lecturer must be assigned to the course');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/hod/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: courseForm.name,
          code: courseForm.code,
          level: parseInt(courseForm.level, 10),
          departmentId: hodDeptId,
          schoolId: user?.schoolId,
          lecturerId: courseForm.lecturerId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Course created successfully');
        setCourseDialogOpen(false);
        setCourseForm({ name: '', code: '', level: '100', lecturerId: '' });
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create course');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  // Edit course
  const handleEditCourse = async () => {
    if (!editCourseForm.name || !editCourseForm.code) {
      toast.error('Name and code are required');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/hod/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: editCourseForm.id,
          name: editCourseForm.name,
          code: editCourseForm.code,
          level: parseInt(editCourseForm.level, 10),
          lecturerId: editCourseForm.lecturerId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Course updated');
        setEditCourseDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to update course');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  // Assign lecturer to course
  const handleAssign = async () => {
    if (!assignForm.courseId || !assignForm.lecturerId) {
      toast.error('Select both course and lecturer');
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/hod/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`${data.data.lecturerName} assigned to ${data.data.courseName}`);
        setAssignDialogOpen(false);
        setAssignForm({ courseId: '', lecturerId: '' });
        fetchData();
      } else {
        toast.error(data.error || 'Failed to assign');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setFormLoading(true);
    try {
      const endpoint = deleteTarget.type === 'lecturer'
        ? `/api/hod/lecturers?lecturerId=${deleteTarget.id}`
        : `/api/hod/courses?courseId=${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success(`${deleteTarget.type === 'lecturer' ? 'Lecturer' : 'Course'} deleted`);
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setFormLoading(false);
    }
  };

  // Filtered data
  const filteredStudents = studentLevelFilter === 'all'
    ? students
    : students.filter(s => s.level === parseInt(studentLevelFilter, 10));

  const filteredCourses = courseLevelFilter === 'all'
    ? courses
    : courses.filter(c => c.level === parseInt(courseLevelFilter, 10));

  // Chart data
  const levelChartData = Object.entries(stats?.studentsByLevel || {}).map(([level, count], i) => ({
    name: `${level} Level`,
    value: count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-muted-foreground">Loading HOD portal...</p>
        </div>
      </div>
    );
  }

  if (!hodDeptId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-6 text-center">
            <XCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-bold mb-2">No Department Assigned</h2>
            <p className="text-muted-foreground">Your account is not linked to a department. Please contact the admin.</p>
            <Button className="mt-4" onClick={() => logout()}>Sign Out</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-sm">
              <ShieldCheck className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">checkIn <span className="text-violet-600 dark:text-violet-400">HOD</span></h1>
              <p className="text-xs text-muted-foreground">{department?.name || 'Department'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300">
              {SCHOOL}
            </Badge>
            <Button variant="ghost" size="sm" onClick={() => setShowProfile(true)}>
              <Users className="size-4 mr-1" />
              {user?.name}
            </Button>
            <ThemeToggle className="h-9 w-9" />
            <Button variant="ghost" size="icon" onClick={() => logout()}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">
              <BarChart3 className="size-4 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="lecturers" className="text-xs sm:text-sm">
              <Users className="size-4 mr-1" />
              Lecturers
            </TabsTrigger>
            <TabsTrigger value="courses" className="text-xs sm:text-sm">
              <BookOpen className="size-4 mr-1" />
              Courses
            </TabsTrigger>
            <TabsTrigger value="students" className="text-xs sm:text-sm">
              <GraduationCap className="size-4 mr-1" />
              Students
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-950/30">
                      <Users className="size-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.lecturerCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Lecturers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-950/30">
                      <BookOpen className="size-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.courseCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Courses</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/30">
                      <GraduationCap className="size-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.studentCount || 0}</p>
                      <p className="text-xs text-muted-foreground">Students</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/30">
                      <UserCheck className="size-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats?.activationRate || 0}%</p>
                      <p className="text-xs text-muted-foreground">Activated</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Students by Level */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Students by Level</CardTitle>
                </CardHeader>
                <CardContent>
                  {levelChartData.length > 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={levelChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {levelChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-2 mt-2 justify-center">
                        {levelChartData.map((d) => (
                          <div key={d.name} className="flex items-center gap-1.5 text-xs">
                            <div className="size-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                            <span>{d.name}: {d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                      No students yet
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Courses by Level */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Courses by Level</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {VALID_LEVELS.map((level) => {
                      const count = stats?.coursesByLevel[level] || 0;
                      const maxCount = Math.max(...Object.values(stats?.coursesByLevel || { 100: 1 }), 1);
                      return (
                        <div key={level} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{level} Level</span>
                            <span className="text-muted-foreground">{count} course{count !== 1 ? 's' : ''}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-500 transition-all duration-500"
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => { setLecturerDialogOpen(true); }}>
                    <UserPlus className="size-4 mr-2 text-violet-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Add Lecturer</p>
                      <p className="text-xs text-muted-foreground">Create a new lecturer in your department</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => { setCourseDialogOpen(true); }}>
                    <BookOpen className="size-4 mr-2 text-cyan-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Add Course</p>
                      <p className="text-xs text-muted-foreground">Create a course and assign a lecturer</p>
                    </div>
                  </Button>
                  <Button variant="outline" className="justify-start h-auto py-3" onClick={() => { setAssignDialogOpen(true); }}>
                    <ClipboardList className="size-4 mr-2 text-amber-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Assign Lecturer</p>
                      <p className="text-xs text-muted-foreground">Assign a lecturer to a course</p>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lecturers Tab */}
          <TabsContent value="lecturers" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Department Lecturers</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="size-3.5 mr-1" />
                  Refresh
                </Button>
                <Button size="sm" onClick={() => setLecturerDialogOpen(true)}>
                  <Plus className="size-3.5 mr-1" />
                  Add Lecturer
                </Button>
              </div>
            </div>

            {lecturers.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Users className="size-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="font-medium mb-1">No Lecturers Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add your first lecturer to get started</p>
                  <Button onClick={() => setLecturerDialogOpen(true)}>
                    <UserPlus className="size-4 mr-2" />
                    Add Lecturer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Courses</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lecturers.map((lect) => (
                        <TableRow key={lect.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {lect.name}
                              {lect.isHod && (
                                <Badge className="text-[10px] px-1 py-0 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                                  HOD
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{lect.email}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {lect.courses.length === 0 ? (
                                <span className="text-xs text-muted-foreground">No courses</span>
                              ) : (
                                lect.courses.map(c => (
                                  <Badge key={c.id} variant="secondary" className="text-[10px]">
                                    {c.code} ({c.level})
                                  </Badge>
                                ))
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                              Active
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => {
                                  setEditLecturerForm({ id: lect.id, name: lect.name, email: lect.email });
                                  setEditLecturerDialogOpen(true);
                                }}
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              {!lect.isHod && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-red-500 hover:text-red-600"
                                  onClick={() => {
                                    setDeleteTarget({ type: 'lecturer', id: lect.id, name: lect.name });
                                    setDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Department Courses</h2>
              <div className="flex gap-2 items-center">
                <Select value={courseLevelFilter} onValueChange={setCourseLevelFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {VALID_LEVELS.map(l => (
                      <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => setCourseDialogOpen(true)}>
                  <Plus className="size-3.5 mr-1" />
                  Add Course
                </Button>
              </div>
            </div>

            {filteredCourses.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <BookOpen className="size-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="font-medium mb-1">No Courses Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create your first course and assign a lecturer</p>
                  <Button onClick={() => setCourseDialogOpen(true)}>
                    <Plus className="size-4 mr-2" />
                    Add Course
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Level</TableHead>
                        <TableHead>Lecturer</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCourses.map((course) => (
                        <TableRow key={course.id}>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {course.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{course.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{course.level}</Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {course.lecturerName || (
                              <span className="text-muted-foreground italic">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                onClick={() => {
                                  setEditCourseForm({
                                    id: course.id,
                                    name: course.name,
                                    code: course.code,
                                    level: String(course.level),
                                    lecturerId: course.lecturerId || '',
                                  });
                                  setEditCourseDialogOpen(true);
                                }}
                              >
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-red-500 hover:text-red-600"
                                onClick={() => {
                                  setDeleteTarget({ type: 'course', id: course.id, name: course.name });
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Department Students</h2>
              <div className="flex gap-2 items-center">
                <Select value={studentLevelFilter} onValueChange={setStudentLevelFilter}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    {VALID_LEVELS.map(l => (
                      <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="size-3.5 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Student Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">{filteredStudents.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-emerald-500">
                    {filteredStudents.filter(s => s.activated).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Activated</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold text-amber-500">
                    {filteredStudents.filter(s => !s.activated).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-lg font-bold">
                    {filteredStudents.length > 0
                      ? Math.round((filteredStudents.filter(s => s.activated).length / filteredStudents.length) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Rate</p>
                </CardContent>
              </Card>
            </div>

            {filteredStudents.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <GraduationCap className="size-12 mx-auto mb-3 text-muted-foreground/40" />
                  <h3 className="font-medium mb-1">No Students Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {studentLevelFilter !== 'all'
                      ? 'No students in this level. Try a different filter.'
                      : 'Students are added by the admin. They will appear here once assigned to your department.'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Matric No.</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map((student) => (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell className="font-mono text-sm">{student.matricNumber}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">{student.level}</Badge>
                            </TableCell>
                            <TableCell>
                              {student.activated ? (
                                <Badge className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 className="size-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                                  Pending
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>checkIn — {SCHOOL} HOD Portal</span>
          <span>{department?.name} ({department?.code})</span>
        </div>
      </footer>

      {/* Profile Panel */}
      {showProfile && (
        <ProfilePanel onClose={() => setShowProfile(false)} />
      )}

      {/* Create Lecturer Dialog */}
      <Dialog open={lecturerDialogOpen} onOpenChange={setLecturerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Lecturer</DialogTitle>
            <DialogDescription>
              Create a lecturer in {department?.name}. Default password: CheckIn@2024
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                placeholder="Dr. John Smith"
                value={lecturerForm.name}
                onChange={(e) => setLecturerForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="john.smith@futa.edu.ng"
                value={lecturerForm.email}
                onChange={(e) => setLecturerForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLecturerDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLecturer} disabled={formLoading}>
              {formLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Create Lecturer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lecturer Dialog */}
      <Dialog open={editLecturerDialogOpen} onOpenChange={setEditLecturerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lecturer</DialogTitle>
            <DialogDescription>Update lecturer information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={editLecturerForm.name}
                onChange={(e) => setEditLecturerForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                value={editLecturerForm.email}
                onChange={(e) => setEditLecturerForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLecturerDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditLecturer} disabled={formLoading}>
              {formLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Course Dialog */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Course</DialogTitle>
            <DialogDescription>
              Create a course in {department?.name} and assign a lecturer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course Name</Label>
              <Input
                placeholder="Introduction to Programming"
                value={courseForm.name}
                onChange={(e) => setCourseForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Course Code</Label>
              <Input
                placeholder="CSC101"
                value={courseForm.code}
                onChange={(e) => setCourseForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={courseForm.level} onValueChange={(v) => setCourseForm(p => ({ ...p, level: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_LEVELS.map(l => (
                    <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign Lecturer</Label>
              <Select value={courseForm.lecturerId} onValueChange={(v) => setCourseForm(p => ({ ...p, lecturerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lecturer" />
                </SelectTrigger>
                <SelectContent>
                  {lecturers.filter(l => !l.isHod).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCourseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCourse} disabled={formLoading}>
              {formLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
              Create Course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Course Dialog */}
      <Dialog open={editCourseDialogOpen} onOpenChange={setEditCourseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>Update course information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course Name</Label>
              <Input
                value={editCourseForm.name}
                onChange={(e) => setEditCourseForm(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Course Code</Label>
              <Input
                value={editCourseForm.code}
                onChange={(e) => setEditCourseForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Level</Label>
              <Select value={editCourseForm.level} onValueChange={(v) => setEditCourseForm(p => ({ ...p, level: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VALID_LEVELS.map(l => (
                    <SelectItem key={l} value={String(l)}>{l} Level</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assign Lecturer</Label>
              <Select value={editCourseForm.lecturerId} onValueChange={(v) => setEditCourseForm(p => ({ ...p, lecturerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lecturer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Unassigned)</SelectItem>
                  {lecturers.filter(l => !l.isHod).map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCourseDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEditCourse} disabled={formLoading}>
              {formLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Lecturer Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Lecturer to Course</DialogTitle>
            <DialogDescription>Select a course and lecturer to assign</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={assignForm.courseId} onValueChange={(v) => setAssignForm(p => ({ ...p, courseId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.level})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Lecturer</Label>
              <Select value={assignForm.lecturerId} onValueChange={(v) => setAssignForm(p => ({ ...p, lecturerId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a lecturer" />
                </SelectTrigger>
                <SelectContent>
                  {lecturers.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.name} ({l.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={formLoading}>
              {formLoading ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'lecturer' ? 'Lecturer' : 'Course'}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteTarget?.name}? This action cannot be undone.
              {deleteTarget?.type === 'lecturer' && ' They will be unassigned from all courses.'}
              {deleteTarget?.type === 'course' && ' All associated session data will be affected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
