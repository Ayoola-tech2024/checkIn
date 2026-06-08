// ============================================================
// checkIn - Export Panel Component
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, FileSpreadsheet, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { SemesterInfo, ExportData, ApiResponse } from '@/lib/types';

interface ExportPanelProps {
  lecturerId: string;
}

function formatExportStatus(status: string): string {
  const map: Record<string, string> = {
    present: 'P',
    absent: 'A',
    pending_review: 'PR',
    pending: 'Pn',
    rejected_location: 'RL',
    rejected_identity: 'RI',
  };
  return map[status] || status;
}

function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'present') return 'default';
  if (status === 'absent') return 'destructive';
  return 'secondary';
}

export function ExportPanel({ lecturerId }: ExportPanelProps) {
  const [semesters, setSemesters] = useState<SemesterInfo[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [exportData, setExportData] = useState<ExportData | null>(null);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  // Fetch semesters
  useEffect(() => {
    async function fetchSemesters() {
      try {
        const res = await fetch('/api/semesters');
        const json: ApiResponse<SemesterInfo[]> = await res.json();
        if (json.success && json.data) {
          setSemesters(json.data);
        }
      } catch {
        toast.error('Failed to load semesters');
      } finally {
        setLoadingSemesters(false);
      }
    }
    fetchSemesters();
  }, []);

  // Fetch courses for this lecturer
  const fetchCourses = useCallback(async () => {
    if (!lecturerId) return;
    setLoadingCourses(true);
    try {
      const res = await fetch(`/api/lecturer/grading?lecturerId=${lecturerId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const courseList = json.data.map((g: { courseId: string; courseName: string; courseCode: string }) => ({
          id: g.courseId,
          name: g.courseName,
          code: g.courseCode,
        }));
        setCourses(courseList);
      }
    } catch {
      toast.error('Failed to load courses');
    } finally {
      setLoadingCourses(false);
    }
  }, [lecturerId]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  // Fetch export data
  const fetchExportData = useCallback(async () => {
    if (!selectedCourse) return;
    setLoadingExport(true);
    try {
      const params = new URLSearchParams({ courseId: selectedCourse });
      if (selectedSemester) params.set('semesterId', selectedSemester);
      const res = await fetch(`/api/lecturer/export?${params}`);
      const json: ApiResponse<ExportData> = await res.json();
      if (json.success && json.data) {
        setExportData(json.data);
        // Expand all departments by default
        setExpandedDepts(new Set(json.data.departments.map((d) => d.name)));
      } else {
        toast.error(json.error || 'Failed to load export data');
      }
    } catch {
      toast.error('Network error loading export data');
    } finally {
      setLoadingExport(false);
    }
  }, [selectedCourse, selectedSemester]);

  useEffect(() => {
    fetchExportData();
  }, [fetchExportData]);

  const toggleDept = (name: string) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!exportData) return;

    const sessionDates = exportData.departments.length > 0
      ? exportData.departments[0].students.length > 0
        ? exportData.departments[0].students[0].sessions.map((s) => s.date)
        : []
      : [];

    const headers = ['Department', 'Name', 'Matric Number', ...sessionDates, 'Attendance %', 'Marks'];
    const rows: string[][] = [];

    for (const dept of exportData.departments) {
      for (const student of dept.students) {
        const sessionStatuses = student.sessions.map((s) => formatExportStatus(s.status));
        rows.push([
          dept.name,
          student.name,
          student.matricNumber,
          ...sessionStatuses,
          `${student.attendancePercentage}%`,
          student.marks.toFixed(2),
        ]);
      }
    }

    const csvString = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${exportData.courseCode}-${exportData.semesterName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  if (loadingSemesters) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
        <h2 className="text-xl font-bold">Export Attendance</h2>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="All Semesters" />
                </SelectTrigger>
                <SelectContent>
                  {semesters.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {exportData && (
              <Button onClick={handleExportCSV} className="w-full md:w-auto">
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {loadingExport && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Preview */}
      {exportData && !loadingExport && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">
                {exportData.courseCode} - {exportData.courseName}
              </h3>
              <p className="text-sm text-muted-foreground">{exportData.semesterName}</p>
            </div>
          </div>

          {exportData.departments.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                No data available for export
              </CardContent>
            </Card>
          ) : (
            exportData.departments.map((dept) => {
              const isExpanded = expandedDepts.has(dept.name);
              return (
                <Card key={dept.name}>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => toggleDept(dept.name)}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {dept.name}
                        <Badge variant="secondary" className="ml-2">
                          {dept.students.length} students
                        </Badge>
                      </CardTitle>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead>Matric No.</TableHead>
                              {dept.students.length > 0 &&
                                dept.students[0].sessions.map((s, i) => (
                                  <TableHead key={i} className="text-center text-xs">
                                    {s.date}
                                  </TableHead>
                                ))}
                              <TableHead className="text-right">Att. %</TableHead>
                              <TableHead className="text-right">Marks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {dept.students.map((student, i) => (
                              <TableRow key={i}>
                                <TableCell className="font-medium">{student.name}</TableCell>
                                <TableCell>{student.matricNumber}</TableCell>
                                {student.sessions.map((s, j) => (
                                  <TableCell key={j} className="text-center">
                                    <Badge
                                      variant={getStatusBadgeVariant(s.status)}
                                      className={`text-xs ${
                                        s.status === 'present'
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                          : ''
                                      }`}
                                    >
                                      {formatExportStatus(s.status)}
                                    </Badge>
                                  </TableCell>
                                ))}
                                <TableCell className="text-right font-medium">
                                  {student.attendancePercentage}%
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {student.marks.toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {loadingCourses && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
