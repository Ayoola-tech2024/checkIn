// ============================================================
// checkIn - Export Panel Component
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, FileSpreadsheet, Loader2, ChevronDown, ChevronRight, Printer } from 'lucide-react';
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

/**
 * RFC 4180 CSV field escaping: wrap every field in double quotes and double
 * any internal double-quote characters. Also handles newlines within fields
 * (which are preserved inside quotes per RFC 4180 §2.6).
 */
function escapeCsv(value: string | number | undefined | null): string {
  const str = value === undefined || value === null ? '' : String(value);
  // Double internal double-quotes, then wrap the whole field in double quotes.
  return `"${str.replace(/"/g, '""')}"`;
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

    const csvString = [headers, ...rows].map((row) => row.map((cell) => escapeCsv(cell)).join(',')).join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-${exportData.courseCode}-${exportData.semesterName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  };

  const handlePrintSenateSheet = () => {
    if (!exportData) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      toast.error('Please allow popups to open the Senate Master Sheet');
      return;
    }

    const totalSessions = exportData.departments?.[0]?.students?.[0]?.sessions?.length || 1;
    let studentRowsHtml = '';
    let sn = 1;

    for (const dept of exportData.departments) {
      for (const student of dept.students) {
        const pct = student.attendancePercentage;
        const isEligible = pct >= 75;
        const caMark = (student.marks * 0.3).toFixed(1);
        const statusBadge = isEligible
          ? '<span style="color: #059669; font-weight: bold;">ELIGIBLE</span>'
          : '<span style="color: #dc2626; font-weight: bold;">BARRED (&lt;75%)</span>';

        studentRowsHtml += `
          <tr>
            <td style="text-align: center;">${sn++}</td>
            <td>${student.name}</td>
            <td><strong>${student.matricNumber}</strong></td>
            <td>${dept.name}</td>
            <td style="text-align: center;">${pct}%</td>
            <td style="text-align: center;">${statusBadge}</td>
            <td style="text-align: center;">${caMark} / 30</td>
            <td style="text-align: center;">___ / 70</td>
            <td style="text-align: center;">___ / 100</td>
          </tr>
        `;
      }
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>FUTA Senate Master Sheet - ${exportData.courseCode}</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; margin: 30px; color: #111; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
          .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .header h2 { margin: 5px 0; font-size: 16px; font-weight: normal; }
          .header h3 { margin: 5px 0; font-size: 14px; font-style: italic; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
          th { background-color: #f3f4f6; text-transform: uppercase; font-size: 11px; }
          .signatures { display: flex; justify-content: space-between; margin-top: 60px; font-size: 12px; }
          .sig-box { width: 28%; text-align: center; border-top: 1px solid #000; padding-top: 5px; }
          @media print { body { margin: 15px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Federal University of Technology, Akure</h1>
          <h2>School of Logistics and Innovation Technology (SLIT)</h2>
          <h3>Official Senate Attendance & Examination Master Sheet</h3>
        </div>

        <div class="meta-grid">
          <div>
            <p><strong>Course Code:</strong> ${exportData.courseCode}</p>
            <p><strong>Course Title:</strong> ${exportData.courseName}</p>
            <p><strong>Semester:</strong> ${exportData.semesterName}</p>
          </div>
          <div style="text-align: right;">
            <p><strong>Total Sessions Held:</strong> ${totalSessions}</p>
            <p><strong>Attendance Threshold:</strong> FUTA 75% Rule</p>
            <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">S/N</th>
              <th>Student Name</th>
              <th>Matric Number</th>
              <th>Department</th>
              <th style="text-align: center;">Attendance %</th>
              <th style="text-align: center;">FUTA 75% Status</th>
              <th style="text-align: center;">CA Mark (30%)</th>
              <th style="text-align: center;">Exam Mark (70%)</th>
              <th style="text-align: center;">Total (100%)</th>
            </tr>
          </thead>
          <tbody>
            ${studentRowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div class="sig-box">
            Course Lecturer Signature & Date
          </div>
          <div class="sig-box">
            Head of Department (HOD) Signature
          </div>
          <div class="sig-box">
            Dean, SLIT Signature & Date
          </div>
        </div>

        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
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
              <div className="flex gap-2 w-full md:w-auto col-span-1 md:col-span-3">
                <Button onClick={handleExportCSV} className="flex-1 md:flex-initial">
                  <Download className="mr-2 h-4 w-4" /> Export CSV
                </Button>
                <Button onClick={handlePrintSenateSheet} variant="outline" className="flex-1 md:flex-initial border-emerald-600 text-emerald-700 dark:text-emerald-400">
                  <Printer className="mr-2 h-4 w-4 text-emerald-600" /> Print Senate Sheet
                </Button>
              </div>
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
