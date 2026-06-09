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
} from 'lucide-react';

// ============================================================
// Stats Card
// ============================================================
function StatCard({
  title,
  value,
  icon,
  description,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex items-center justify-center size-10 rounded-lg bg-muted text-muted-foreground">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Admin Dashboard
// ============================================================
export function AdminDashboard() {
  const { user, logout } = useAuthStore();
  const [stats, setStats] = useState<{
    totalDepartments: number;
    totalStudents: number;
    activatedStudents: number;
    totalLecturers: number;
    totalCourses: number;
    totalVenues: number;
    totalSessions: number;
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-9 rounded-lg bg-primary text-primary-foreground">
              <Shield className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">checkIn</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Welcome, <span className="font-medium text-foreground">{user?.name}</span>
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-12" />
                </CardContent>
              </Card>
            ))
          ) : (
            stats && (
              <>
                <StatCard
                  title="Departments"
                  value={stats.totalDepartments}
                  icon={<Building2 className="size-5" />}
                />
                <StatCard
                  title="Students"
                  value={stats.totalStudents}
                  icon={<GraduationCap className="size-5" />}
                  description={`${stats.activatedStudents} activated`}
                />
                <StatCard
                  title="Lecturers"
                  value={stats.totalLecturers}
                  icon={<Users className="size-5" />}
                />
                <StatCard
                  title="Courses"
                  value={stats.totalCourses}
                  icon={<BookOpen className="size-5" />}
                />
                <StatCard
                  title="Venues"
                  value={stats.totalVenues}
                  icon={<MapPin className="size-5" />}
                />
                <StatCard
                  title="Sessions"
                  value={stats.totalSessions}
                  icon={<CalendarDays className="size-5" />}
                />
              </>
            )
          )}
        </div>

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

      {/* Footer */}
      <footer className="border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          checkIn — Student Attendance Platform
        </div>
      </footer>
    </div>
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
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-5" />
            CSV Import
          </CardTitle>
          <CardDescription>
            Upload a CSV file with columns: name, matricNumber, department
          </CardDescription>
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
                  className="gap-2"
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
              <div className="max-h-64 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Matric Number</TableHead>
                      <TableHead>Department</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvPreview.slice(0, 50).map((row, i) => (
                      <TableRow key={i}>
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
      <Card>
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
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matric No.</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="font-mono text-sm">{s.matricNumber}</TableCell>
                        <TableCell>{s.departmentName}</TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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

  return (
    <div className="space-y-6">
      <Card>
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
                <Button size="sm" className="gap-1.5">
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
                    <Button type="submit" disabled={creating}>
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
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Students</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departments.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {d.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{d.studentCount ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    setCreating(true);

    try {
      const res = await fetch('/api/admin/lecturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Lecturer created successfully');
        setName('');
        setEmail('');
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

  return (
    <div className="space-y-6">
      <Card>
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
                <Button size="sm" className="gap-1.5">
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
                  <DialogFooter>
                    <Button type="submit" disabled={creating}>
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
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Courses</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lecturers.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="text-muted-foreground">{l.email}</TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
  const [level, setLevel] = useState('');
  const [lecturerId, setLecturerId] = useState('');
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

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
          level,
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

  return (
    <div className="space-y-6">
      <Card>
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
                <Button size="sm" className="gap-1.5">
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
                          {['100', '200', '300', '400', '500', '600'].map((l) => (
                            <SelectItem key={l} value={l}>
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
                    <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                      {departments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No departments available. Create one first.</p>
                      ) : (
                        departments.map((d) => (
                          <label
                            key={d.id}
                            className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5"
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
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Course</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Lecturer</TableHead>
                      <TableHead>Departments</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {courses.map((c) => (
                      <TableRow key={c.id}>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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

  return (
    <div className="space-y-6">
      <Card>
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
                <Button size="sm" className="gap-1.5">
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
                    <Button type="submit" disabled={creating}>
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
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Latitude</TableHead>
                    <TableHead>Longitude</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {venues.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell className="font-mono text-sm">{v.latitude}</TableCell>
                      <TableCell className="font-mono text-sm">{v.longitude}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
