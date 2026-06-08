// ============================================================
// checkIn - Lecturer Portal Component
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import {
  LogOut,
  Plus,
  Play,
  Square,
  BarChart3,
  ClipboardCheck,
  Clock,
  MapPin,
  Users,
  Loader2,
  Radio,
  Eye,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useAuthStore } from '@/hooks/use-auth';
import { useGeoLocation } from '@/hooks/use-geo-location';
import { AnalyticsPanel } from './analytics-panel';
import { GradingPanel } from './grading-panel';
import { ExportPanel } from './export-panel';
import type {
  SessionInfo,
  AttendanceInfo,
  AttendanceStatus,
  VenueInfo,
  DepartmentInfo,
  CourseInfo,
  ApiResponse,
} from '@/lib/types';
import {
  SESSION_POLL_INTERVAL,
  ATTENDANCE_POLL_INTERVAL,
  DEFAULT_DISTANCE_THRESHOLD,
  DEFAULT_SESSION_DURATION,
} from '@/lib/constants';

// ============================================================
// Session Status Badge
// ============================================================
function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; label: string }> = {
    scheduled: { variant: 'outline', className: 'border-slate-400 text-slate-600 dark:text-slate-300', label: 'Scheduled' },
    active: { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse', label: 'Active' },
    completed: { variant: 'secondary', className: '', label: 'Completed' },
    cancelled: { variant: 'destructive', className: '', label: 'Cancelled' },
  };
  const c = config[status] || { variant: 'outline' as const, className: '', label: status };
  return (
    <Badge variant={c.variant} className={c.className}>
      {c.label}
    </Badge>
  );
}

// ============================================================
// Attendance Status Badge
// ============================================================
function AttendanceStatusBadge({ status }: { status: AttendanceStatus }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; label: string }> = {
    present: { variant: 'default', className: 'bg-emerald-600 hover:bg-emerald-700 text-white', label: 'Present' },
    absent: { variant: 'destructive', className: '', label: 'Absent' },
    pending_review: { variant: 'secondary', className: 'bg-amber-500 hover:bg-amber-600 text-white', label: 'Pending Review' },
    pending: { variant: 'secondary', className: 'bg-amber-500 hover:bg-amber-600 text-white', label: 'Pending' },
    rejected_location: { variant: 'destructive', className: '', label: 'Rejected (Loc)' },
    rejected_identity: { variant: 'destructive', className: '', label: 'Rejected (ID)' },
  };
  const c = config[status] || { variant: 'outline' as const, className: '', label: status };
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

// ============================================================
// Create Session Dialog
// ============================================================
interface CreateSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lecturerId: string;
  courses: CourseInfo[];
  onCreated: () => void;
}

function CreateSessionDialog({ open, onOpenChange, lecturerId, courses, onCreated }: CreateSessionDialogProps) {
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [level, setLevel] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [distanceThreshold, setDistanceThreshold] = useState(DEFAULT_DISTANCE_THRESHOLD);
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_SESSION_DURATION);
  const [scheduledAt, setScheduledAt] = useState('');
  const [venues, setVenues] = useState<VenueInfo[]>([]);
  const [departments, setDepartments] = useState<DepartmentInfo[]>([]);
  const [saving, setSaving] = useState(false);

  // Fetch venues and departments
  useEffect(() => {
    if (open) {
      fetch('/api/admin/venues')
        .then((r) => r.json())
        .then((json) => { if (json.success) setVenues(json.data); })
        .catch(() => toast.error('Failed to load venues'));

      fetch('/api/admin/departments')
        .then((r) => r.json())
        .then((json) => { if (json.success) setDepartments(json.data); })
        .catch(() => toast.error('Failed to load departments'));
    }
  }, [open]);

  const resetForm = () => {
    setTitle('');
    setCourseId('');
    setVenueId('');
    setLevel('');
    setSelectedDepts([]);
    setDistanceThreshold(DEFAULT_DISTANCE_THRESHOLD);
    setDurationMinutes(DEFAULT_SESSION_DURATION);
    setScheduledAt('');
  };

  const handleDeptToggle = (deptId: string) => {
    setSelectedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((d) => d !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async () => {
    if (!title || !courseId || !venueId || !level || selectedDepts.length === 0 || !scheduledAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/lecturer/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          courseId,
          venueId,
          lecturerId,
          level,
          departmentIds: selectedDepts,
          distanceThreshold,
          durationMinutes,
          scheduledAt,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success('Session created successfully');
        resetForm();
        onOpenChange(false);
        onCreated();
      } else if (res.status === 409) {
        // Concurrency conflict
        const conflicts = json.data?.conflicts || [];
        if (json.error?.includes('Venue')) {
          const conflictList = conflicts.map((c: { title: string; courseName: string; scheduledAt: string }) =>
            `"${c.title}" (${c.courseName}) at ${format(new Date(c.scheduledAt), 'PPp')}`
          ).join(', ');
          toast.error(`Venue conflict: ${conflictList}`, { duration: 8000 });
        } else if (json.error?.includes('department')) {
          const conflictList = conflicts.map((c: { title: string; conflictingDepartments?: string[] }) =>
            `"${c.title}" (Depts: ${c.conflictingDepartments?.join(', ')})`
          ).join(', ');
          toast.error(`Department conflict: ${conflictList}`, { duration: 8000 });
        } else {
          toast.error(json.error || 'Scheduling conflict detected');
        }
      } else {
        toast.error(json.error || 'Failed to create session');
      }
    } catch {
      toast.error('Network error creating session');
    } finally {
      setSaving(false);
    }
  };

  // Filter departments for selected course
  const courseDepartments = courseId
    ? courses.find((c) => c.id === courseId)?.departments || departments
    : departments;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="session-title">Session Title *</Label>
            <Input
              id="session-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Week 5 Lecture"
            />
          </div>

          {/* Course & Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={courseId} onValueChange={(val) => {
                setCourseId(val);
                setSelectedDepts([]);
                const course = courses.find((c) => c.id === val);
                if (course) setLevel(course.level);
              }}>
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
              <Label htmlFor="session-level">Level *</Label>
              <Input
                id="session-level"
                type="number"
                min="100"
                max="600"
                step="100"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. 200"
              />
            </div>
          </div>

          {/* Venue */}
          <div className="space-y-2">
            <Label>Venue *</Label>
            <Select value={venueId} onValueChange={setVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Select venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Departments */}
          <div className="space-y-2">
            <Label>Departments * (select one or more)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
              {courseDepartments.map((dept) => (
                <div key={dept.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`dept-${dept.id}`}
                    checked={selectedDepts.includes(dept.id)}
                    onCheckedChange={() => handleDeptToggle(dept.id)}
                  />
                  <label
                    htmlFor={`dept-${dept.id}`}
                    className="text-sm leading-none cursor-pointer"
                  >
                    {dept.name}
                  </label>
                </div>
              ))}
              {courseDepartments.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-3">
                  {courseId ? 'No departments for this course' : 'Select a course first'}
                </p>
              )}
            </div>
          </div>

          {/* Distance Threshold */}
          <div className="space-y-2">
            <Label>Distance Threshold: {distanceThreshold}m</Label>
            <Slider
              value={[distanceThreshold]}
              onValueChange={([val]) => setDistanceThreshold(val)}
              min={10}
              max={500}
              step={10}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10m</span>
              <span>500m</span>
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="session-duration">Duration (minutes) *</Label>
            <Input
              id="session-duration"
              type="number"
              min={5}
              max={120}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 15)}
            />
          </div>

          {/* Scheduled Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="session-scheduled">Scheduled Date & Time *</Label>
            <Input
              id="session-scheduled"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Create Session
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Live Session Monitor
// ============================================================
interface LiveMonitorProps {
  session: SessionInfo;
}

function LiveMonitor({ session }: LiveMonitorProps) {
  const [attendances, setAttendances] = useState<AttendanceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAttendances = useCallback(async () => {
    try {
      const res = await fetch(`/api/lecturer/analytics?sessionId=${session.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setAttendances(json.data.attendances || []);
      }
    } catch {
      // Silently fail on polling
    } finally {
      setLoading(false);
    }
  }, [session.id]);

  useEffect(() => {
    fetchAttendances();
    intervalRef.current = setInterval(fetchAttendances, ATTENDANCE_POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAttendances]);

  const present = attendances.filter((a) => a.status === 'present').length;
  const pending = attendances.filter((a) => a.status === 'pending_review' || a.status === 'pending').length;
  const rejected = attendances.filter(
    (a) => a.status === 'rejected_location' || a.status === 'rejected_identity'
  ).length;
  const total = session.totalTargetStudents || 0;

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-emerald-600 animate-pulse" />
          <CardTitle className="text-base">Live Monitor</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{present}</div>
            <div className="text-xs text-muted-foreground">Present</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected}</div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </div>
        </div>

        {/* Progress */}
        {total > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Check-in Progress</span>
              <span>{present + pending + rejected} / {total}</span>
            </div>
            <Progress value={((present + pending + rejected) / total) * 100} className="h-2" />
          </div>
        )}

        {/* Recent Check-ins */}
        <div className="max-h-60 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : attendances.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">
              No check-ins yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances
                  .filter((a) => a.checkInTime)
                  .sort((a, b) => new Date(b.checkInTime!).getTime() - new Date(a.checkInTime!).getTime())
                  .map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium text-sm">
                        {a.studentName || a.studentId.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.checkInTime ? format(new Date(a.checkInTime), 'HH:mm:ss') : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {a.similarityScore !== null ? `${a.similarityScore.toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        <AttendanceStatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Session Card
// ============================================================
interface SessionCardProps {
  session: SessionInfo;
  onRefresh: () => void;
  onViewAnalytics: (sessionId: string) => void;
}

function SessionCard({ session, onRefresh, onViewAnalytics }: SessionCardProps) {
  const { getCurrentPosition } = useGeoLocation();
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);

  const handleStartSession = async () => {
    setStarting(true);
    try {
      const pos = await getCurrentPosition();
      const res = await fetch('/api/lecturer/start-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          lecturerLat: pos.latitude,
          lecturerLng: pos.longitude,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Session started successfully');
        onRefresh();
      } else {
        toast.error(json.error || 'Failed to start session');
      }
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error('Failed to get GPS location');
      }
    } finally {
      setStarting(false);
    }
  };

  const handleEndSession = async () => {
    setEnding(true);
    try {
      const res = await fetch('/api/lecturer/end-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Session ended. ${json.data?.absentStudentsCreated || 0} absent records created.`);
        onRefresh();
      } else {
        toast.error(json.error || 'Failed to end session');
      }
    } catch {
      toast.error('Network error ending session');
    } finally {
      setEnding(false);
    }
  };

  return (
    <Card className={session.status === 'active' ? 'border-emerald-300 dark:border-emerald-700' : ''}>
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{session.title}</h3>
            <p className="text-sm text-muted-foreground">
              {session.courseCode} - {session.courseName}
            </p>
          </div>
          <SessionStatusBadge status={session.status} />
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{session.venueName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{format(new Date(session.scheduledAt), 'PPp')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{session.durationMinutes} min &middot; {session.distanceThreshold}m radius</span>
          </div>
          <div className="text-muted-foreground">
            Level {session.level}
          </div>
        </div>

        {/* Departments */}
        <div className="flex flex-wrap gap-1">
          {session.departments.map((d) => (
            <Badge key={d.id} variant="outline" className="text-xs">
              {d.name}
            </Badge>
          ))}
        </div>

        <Separator />

        {/* Attendance count & actions */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            Attendance: <span className="font-medium text-foreground">{session.attendanceCount || 0}</span>
            {session.totalTargetStudents ? ` / ${session.totalTargetStudents}` : ''}
          </div>
          <div className="flex items-center gap-2">
            {session.status === 'scheduled' && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleStartSession}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="mr-1 h-3.5 w-3.5" />
                )}
                Start
              </Button>
            )}
            {session.status === 'active' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLiveMonitor(!showLiveMonitor)}
                >
                  <Eye className="mr-1 h-3.5 w-3.5" />
                  {showLiveMonitor ? 'Hide' : 'Monitor'}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleEndSession}
                  disabled={ending}
                >
                  {ending ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Square className="mr-1 h-3.5 w-3.5" />
                  )}
                  End
                </Button>
              </>
            )}
            {session.status === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewAnalytics(session.id)}
              >
                <BarChart3 className="mr-1 h-3.5 w-3.5" />
                Analytics
              </Button>
            )}
          </div>
        </div>

        {/* Live Monitor */}
        {showLiveMonitor && session.status === 'active' && (
          <LiveMonitor session={session} />
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Review Queue Tab
// ============================================================
interface ReviewQueueTabProps {
  lecturerId: string;
}

function ReviewQueueTab({ lecturerId }: ReviewQueueTabProps) {
  const [queue, setQueue] = useState<
    {
      id: string;
      studentName: string;
      matricNumber: string;
      departmentName: string;
      sessionTitle: string;
      courseName: string;
      venueName: string;
      similarityScore: number | null;
      checkInTime: string | null;
      selfieData: string | null;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`/api/lecturer/review-queue?lecturerId=${lecturerId}`);
      const json = await res.json();
      if (json.success) {
        setQueue(json.data || []);
      }
    } catch {
      // Silent fail on polling
    } finally {
      setLoading(false);
    }
  }, [lecturerId]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, ATTENDANCE_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleAction = async (attendanceId: string, action: 'approve' | 'reject') => {
    setActioning(attendanceId);
    try {
      const res = await fetch('/api/lecturer/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId, action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(action === 'approve' ? 'Student approved' : 'Student rejected');
        fetchQueue();
      } else {
        toast.error(json.error || 'Failed to process action');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setActioning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          Pending Reviews
          {queue.length > 0 && (
            <Badge variant="secondary" className="bg-amber-500 text-white">
              {queue.length}
            </Badge>
          )}
        </h3>
      </div>

      {queue.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No pending reviews
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Selfie thumbnail */}
                  {item.selfieData && (
                    <div className="flex-shrink-0">
                      <img
                        src={item.selfieData}
                        alt="Student selfie"
                        className="w-14 h-14 rounded-lg object-cover border"
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{item.studentName}</span>
                      <Badge variant="outline" className="text-xs">{item.matricNumber}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>{item.departmentName}</p>
                      <p>{item.sessionTitle} &middot; {item.courseName}</p>
                      <p>
                        {item.checkInTime ? format(new Date(item.checkInTime), 'PPp') : 'No time'}
                        {item.similarityScore !== null && (
                          <span className="ml-2 font-medium text-amber-600">
                            Similarity: {item.similarityScore.toFixed(1)}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAction(item.id, 'approve')}
                      disabled={actioning === item.id}
                    >
                      {actioning === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(item.id, 'reject')}
                      disabled={actioning === item.id}
                    >
                      {actioning === item.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                      )}
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Lecturer Portal
// ============================================================
export function LecturerPortal() {
  const { user, logout } = useAuthStore();
  const geo = useGeoLocation();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [analyticsSessionId, setAnalyticsSessionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('sessions');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const lecturerId = user?.id || '';

  const fetchSessions = useCallback(async () => {
    if (!lecturerId) return;
    try {
      const res = await fetch(`/api/lecturer/sessions?lecturerId=${lecturerId}`);
      const json: ApiResponse<SessionInfo[]> = await res.json();
      if (json.success && json.data) {
        setSessions(json.data);
        // Extract courses from sessions
        const courseMap = new Map<string, CourseInfo>();
        for (const s of json.data) {
          if (s.courseId && s.courseName && s.courseCode) {
            courseMap.set(s.courseId, {
              id: s.courseId,
              name: s.courseName,
              code: s.courseCode,
              level: s.level,
              lecturerId,
              departments: s.departments,
            });
          }
        }
        setCourses(Array.from(courseMap.values()));
      }
    } catch {
      // silent
    } finally {
      setLoadingSessions(false);
    }
  }, [lecturerId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Poll when there's an active session
  useEffect(() => {
    const hasActive = sessions.some((s) => s.status === 'active');
    if (hasActive) {
      intervalRef.current = setInterval(fetchSessions, SESSION_POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessions, fetchSessions]);

  // Analytics view
  if (analyticsSessionId) {
    return (
      <AnalyticsPanel
        sessionId={analyticsSessionId}
        onBack={() => setAnalyticsSessionId(null)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <ClipboardCheck className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-lg font-bold">checkIn</h1>
            </div>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground">Lecturer Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="mr-1 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b bg-card">
            <div className="max-w-7xl mx-auto px-4">
              <TabsList className="h-12 bg-transparent p-0 gap-0">
                <TabsTrigger
                  value="sessions"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-12"
                >
                  Sessions
                </TabsTrigger>
                <TabsTrigger
                  value="review"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-12"
                >
                  Review Queue
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-12"
                >
                  Analytics
                </TabsTrigger>
                <TabsTrigger
                  value="grading"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-12"
                >
                  Grading
                </TabsTrigger>
                <TabsTrigger
                  value="export"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 h-12"
                >
                  Export
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="mt-0">
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">My Sessions</h2>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Session
                </Button>
              </div>

              {loadingSessions ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : sessions.length === 0 ? (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-1">No Sessions Yet</h3>
                    <p className="text-sm mb-4">Create your first attendance session to get started.</p>
                    <Button onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" /> Create Session
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {/* Active sessions first */}
                  {sessions
                    .filter((s) => s.status === 'active')
                    .map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onRefresh={fetchSessions}
                        onViewAnalytics={setAnalyticsSessionId}
                      />
                    ))}
                  {/* Scheduled sessions */}
                  {sessions
                    .filter((s) => s.status === 'scheduled')
                    .map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onRefresh={fetchSessions}
                        onViewAnalytics={setAnalyticsSessionId}
                      />
                    ))}
                  {/* Completed sessions */}
                  {sessions
                    .filter((s) => s.status === 'completed')
                    .map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onRefresh={fetchSessions}
                        onViewAnalytics={setAnalyticsSessionId}
                      />
                    ))}
                  {/* Cancelled sessions */}
                  {sessions
                    .filter((s) => s.status === 'cancelled')
                    .map((s) => (
                      <SessionCard
                        key={s.id}
                        session={s}
                        onRefresh={fetchSessions}
                        onViewAnalytics={setAnalyticsSessionId}
                      />
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Review Queue Tab */}
          <TabsContent value="review" className="mt-0">
            <ReviewQueueTab lecturerId={lecturerId} />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="mt-0">
            <div className="p-4 md:p-6 space-y-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <BarChart3 className="h-5 w-5" /> Session Analytics
              </h2>
              <SessionAnalyticsSelector
                sessions={sessions}
                onViewAnalytics={setAnalyticsSessionId}
              />
            </div>
          </TabsContent>

          {/* Grading Tab */}
          <TabsContent value="grading" className="mt-0">
            <GradingPanel lecturerId={lecturerId} />
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="mt-0">
            <ExportPanel lecturerId={lecturerId} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Session Dialog */}
      <CreateSessionDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        lecturerId={lecturerId}
        courses={courses}
        onCreated={fetchSessions}
      />
    </div>
  );
}

// ============================================================
// Session Analytics Selector (for Analytics tab)
// ============================================================
function SessionAnalyticsSelector({
  sessions,
  onViewAnalytics,
}: {
  sessions: SessionInfo[];
  onViewAnalytics: (sessionId: string) => void;
}) {
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  if (completedSessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No completed sessions to analyze
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {completedSessions.map((s) => (
        <Card key={s.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold truncate">{s.title}</h4>
              <p className="text-sm text-muted-foreground">
                {s.courseCode} &middot; {s.venueName} &middot; {format(new Date(s.scheduledAt), 'PPp')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Attendance: {s.attendanceCount || 0} / {s.totalTargetStudents || '?'}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewAnalytics(s.id)}
            >
              <BarChart3 className="mr-1 h-3.5 w-3.5" /> View
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
