// ============================================================
// checkIn - Grading Panel Component
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { GraduationCap, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { SemesterInfo, CourseInfo, ApiResponse, ValidLevel } from '@/lib/types';

interface GradingPanelProps {
  lecturerId: string;
}

interface CourseGrading {
  courseId: string;
  courseName: string;
  courseCode: string;
  level: number;
  grading: {
    id: string;
    courseId: string;
    semesterId: string;
    semesterName: string;
    totalMarks: number;
  }[];
}

interface StudentMark {
  name: string;
  matricNumber: string;
  departmentName: string;
  attendancePercentage: number;
  marks: number;
}

interface StudentScoreRow {
  id: string | null;
  studentId: string;
  studentName: string;
  matricNumber: string;
  departmentName: string;
  courseId: string;
  semesterId: string;
  caScore: number;
  examScore: number;
  total: number;
}

export function GradingPanel({ lecturerId }: GradingPanelProps) {
  const [semesters, setSemesters] = useState<SemesterInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [gradingData, setGradingData] = useState<CourseGrading[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [totalMarks, setTotalMarks] = useState<string>('100');
  const [studentMarks, setStudentMarks] = useState<StudentMark[]>([]);
  const [loadingSemesters, setLoadingSemesters] = useState(true);
  const [loadingGrading, setLoadingGrading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [studentScores, setStudentScores] = useState<StudentScoreRow[]>([]);
  const [scoreInputs, setScoreInputs] = useState<
    Record<string, { ca: string; exam: string }>
  >({});
  const [dirtyScores, setDirtyScores] = useState<Set<string>>(new Set());
  const [loadingScores, setLoadingScores] = useState(false);
  const [savingScores, setSavingScores] = useState(false);

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

  // Fetch courses and grading data
  const fetchGradingData = useCallback(async () => {
    if (!lecturerId) return;
    setLoadingGrading(true);
    try {
      const params = new URLSearchParams({ lecturerId });
      if (selectedSemester) params.set('semesterId', selectedSemester);
      const res = await fetch(`/api/lecturer/grading?${params}`);
      const json: ApiResponse<CourseGrading[]> = await res.json();
      if (json.success && json.data) {
        setGradingData(json.data);
        // Extract courses from grading data
        const courseList: CourseInfo[] = json.data.map((g) => ({
          id: g.courseId,
          name: g.courseName,
          code: g.courseCode,
          level: g.level as ValidLevel,
          schoolId: '',
          lecturerId,
          departments: [],
        }));
        setCourses(courseList);
        // Pre-fill totalMarks if grading exists for selected course+semester
        if (selectedCourse && selectedSemester) {
          const courseGrading = json.data.find((g) => g.courseId === selectedCourse);
          if (courseGrading) {
            const existingGrading = courseGrading.grading.find(
              (gr) => gr.semesterId === selectedSemester
            );
            if (existingGrading) {
              setTotalMarks(existingGrading.totalMarks.toString());
            }
          }
        }
      }
    } catch {
      toast.error('Failed to load grading data');
    } finally {
      setLoadingGrading(false);
    }
  }, [lecturerId, selectedSemester, selectedCourse]);

  useEffect(() => {
    fetchGradingData();
  }, [fetchGradingData]);

  // Save grading
  const handleSaveGrading = async () => {
    if (!selectedCourse || !selectedSemester) {
      toast.error('Please select a course and semester');
      return;
    }
    const marks = parseFloat(totalMarks);
    if (isNaN(marks) || marks <= 0) {
      toast.error('Please enter valid total marks');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/lecturer/grading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          semesterId: selectedSemester,
          totalMarks: marks,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Grading saved successfully');
        fetchGradingData();
        // Auto-calculate marks
        handleCalculateMarks();
      } else {
        toast.error(json.error || 'Failed to save grading');
      }
    } catch {
      toast.error('Network error saving grading');
    } finally {
      setSaving(false);
    }
  };

  // Calculate marks
  const handleCalculateMarks = async () => {
    if (!selectedCourse || !selectedSemester) {
      toast.error('Please select a course and semester first');
      return;
    }

    setCalculating(true);
    try {
      const res = await fetch(
        `/api/lecturer/export?courseId=${selectedCourse}&semesterId=${selectedSemester}`
      );
      const json = await res.json();
      if (json.success && json.data) {
        const marks: StudentMark[] = [];
        for (const dept of json.data.departments) {
          for (const student of dept.students) {
            marks.push({
              name: student.name,
              matricNumber: student.matricNumber,
              departmentName: dept.name,
              attendancePercentage: student.attendancePercentage,
              marks: student.marks,
            });
          }
        }
        setStudentMarks(marks);
      } else {
        toast.error(json.error || 'Failed to calculate marks');
      }
    } catch {
      toast.error('Network error calculating marks');
    } finally {
      setCalculating(false);
    }
  };

  // Fetch per-student CA/exam scores for the selected course+semester.
  const fetchStudentScores = useCallback(async () => {
    if (!selectedCourse || !selectedSemester) {
      setStudentScores([]);
      setScoreInputs({});
      setDirtyScores(new Set());
      return;
    }
    setLoadingScores(true);
    try {
      const res = await fetch(
        `/api/lecturer/grading/scores?courseId=${selectedCourse}&semesterId=${selectedSemester}`
      );
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setStudentScores(json.data as StudentScoreRow[]);
        const inputs: Record<string, { ca: string; exam: string }> = {};
        for (const row of json.data as StudentScoreRow[]) {
          inputs[row.studentId] = {
            ca: String(row.caScore ?? 0),
            exam: String(row.examScore ?? 0),
          };
        }
        setScoreInputs(inputs);
        setDirtyScores(new Set());
      } else {
        toast.error(json.error || 'Failed to load student scores');
      }
    } catch {
      toast.error('Network error loading student scores');
    } finally {
      setLoadingScores(false);
    }
  }, [selectedCourse, selectedSemester]);

  useEffect(() => {
    fetchStudentScores();
  }, [fetchStudentScores]);

  // Track per-row edits to the CA/exam inputs.
  const handleScoreChange = (
    studentId: string,
    field: 'ca' | 'exam',
    value: string
  ) => {
    setScoreInputs((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
    setDirtyScores((prev) => {
      const next = new Set(prev);
      next.add(studentId);
      return next;
    });
  };

  // Save only the dirty rows via the batch endpoint.
  const handleSaveScores = async () => {
    if (!selectedCourse || !selectedSemester) {
      toast.error('Please select a course and semester');
      return;
    }
    if (dirtyScores.size === 0) {
      toast.info('No changes to save');
      return;
    }

    const scores = Array.from(dirtyScores).map((studentId) => {
      const input = scoreInputs[studentId] || { ca: '0', exam: '0' };
      return {
        studentId,
        caScore: parseFloat(input.ca) || 0,
        examScore: parseFloat(input.exam) || 0,
      };
    });

    setSavingScores(true);
    try {
      const res = await fetch('/api/lecturer/grading/scores/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse,
          semesterId: selectedSemester,
          scores,
        }),
      });
      const json = await res.json();
      if (json.success) {
        const imported: number = json.imported ?? 0;
        toast.success(`Saved ${imported} score${imported === 1 ? '' : 's'}`);
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          toast.warning(`${json.errors.length} row(s) failed to save`);
        }
        setDirtyScores(new Set());
        // Refresh to pick up fresh totals/ids.
        fetchStudentScores();
      } else {
        toast.error(json.error || 'Failed to save scores');
      }
    } catch {
      toast.error('Network error saving scores');
    } finally {
      setSavingScores(false);
    }
  };

  if (loadingSemesters) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-20" />
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
        <GraduationCap className="h-6 w-6 text-emerald-600" />
        <h2 className="text-xl font-bold">Grading Management</h2>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Set Grading</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-2">
              <Label>Semester</Label>
              <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                <SelectTrigger>
                  <SelectValue placeholder="Select semester" />
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

            <div className="space-y-2">
              <Label>Total Marks (100% attendance)</Label>
              <Input
                type="number"
                min="1"
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                placeholder="100"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSaveGrading} disabled={saving} className="flex-1">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleCalculateMarks}
                disabled={calculating}
              >
                {calculating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Calculate'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Grading */}
      {gradingData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Existing Grading Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead className="text-right">Total Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradingData.flatMap((g) =>
                    g.grading.map((gr) => (
                      <TableRow key={gr.id}>
                        <TableCell>
                          {g.courseCode} - {g.courseName}
                        </TableCell>
                        <TableCell>{gr.semesterName}</TableCell>
                        <TableCell className="text-right font-medium">
                          {gr.totalMarks}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {gradingData.every((g) => g.grading.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No grading records yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student Marks */}
      {studentMarks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Student Marks Calculation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Matric No.</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Attendance %</TableHead>
                    <TableHead className="text-right">Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentMarks.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.matricNumber}</TableCell>
                      <TableCell>{s.departmentName}</TableCell>
                      <TableCell className="text-right">{s.attendancePercentage}%</TableCell>
                      <TableCell className="text-right font-semibold">
                        {s.marks.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-Student CA & Exam Scores */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-Student CA &amp; Exam Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedCourse || !selectedSemester ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Please select a course and semester above to load students.
            </p>
          ) : loadingScores ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : studentScores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No students enrolled in this course.
            </p>
          ) : (
            <>
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matric No.</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead className="w-32">CA Score (max 100)</TableHead>
                      <TableHead className="w-32">Exam Score (max 100)</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Attendance Mark</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentScores.map((row) => {
                      const input = scoreInputs[row.studentId] || {
                        ca: '0',
                        exam: '0',
                      };
                      const caNum = parseFloat(input.ca) || 0;
                      const examNum = parseFloat(input.exam) || 0;
                      const total = caNum + examNum;
                      const attendance = studentMarks.find(
                        (m) => m.matricNumber === row.matricNumber
                      );
                      return (
                        <TableRow key={row.studentId}>
                          <TableCell className="font-medium">{row.studentName}</TableCell>
                          <TableCell>{row.matricNumber}</TableCell>
                          <TableCell>{row.departmentName}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={input.ca}
                              onChange={(e) =>
                                handleScoreChange(row.studentId, 'ca', e.target.value)
                              }
                              placeholder="0–100"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={input.exam}
                              onChange={(e) =>
                                handleScoreChange(row.studentId, 'exam', e.target.value)
                              }
                              placeholder="0–100"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {total.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {attendance ? attendance.marks.toFixed(2) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  {dirtyScores.size > 0
                    ? `${dirtyScores.size} row(s) modified`
                    : 'All changes saved'}
                </p>
                <Button
                  onClick={handleSaveScores}
                  disabled={savingScores || dirtyScores.size === 0}
                >
                  {savingScores ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving
                    </>
                  ) : (
                    'Save Scores'
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {loadingGrading && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
