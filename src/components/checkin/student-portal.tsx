// ============================================================
// checkIn - Student Portal Component
// ============================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LogOut,
  RefreshCw,
  MapPin,
  Clock,
  Building2,
  Users,
  CalendarDays,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Mail,
  Lock,
  Camera,
  ChevronRight,
  Ruler,
  GraduationCap,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Fingerprint,
  LogIn,
  UserCircle,
  TrendingUp,
  UserCheck,
  UserX,
  CalendarClock,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/hooks/use-auth';
import { FaceCapture } from '@/components/checkin/face-capture';
import { CheckInFlow } from '@/components/checkin/check-in-flow';
import { ProfilePanel } from '@/components/checkin/profile-panel';
import { ThemeToggle } from '@/components/theme-toggle';
import type { SessionInfo, CheckInResult, AttendanceStatus, ApiResponse } from '@/lib/types';
import { SESSION_POLL_INTERVAL, SCHOOL } from '@/lib/constants';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

type ActivationStep = 'email' | 'selfie' | 'processing' | 'complete';

interface SessionWithAttendance extends SessionInfo {
  attendance?: {
    id: string;
    status: AttendanceStatus;
    similarityScore: number | null;
    checkInTime: string | null;
  } | null;
}

interface StudentStats {
  totalSessions: number;
  totalPresent: number;
  totalAbsent: number;
  totalPending: number;
  totalRejected: number;
  attendanceRate: number;
  upcomingSessions: number;
  recentAttendance: Array<{
    id: string;
    sessionId: string;
    sessionTitle: string;
    courseName: string;
    status: string;
    similarityScore: number | null;
    checkInTime: string | null;
    scheduledAt: string | null;
  }>;
}

// ============================================================
// Student Portal
// ============================================================

export function StudentPortal() {
  const { user, logout, updateUser } = useAuthStore();
  const isActivated = user?.activated === true;

  if (!isActivated) {
    return <ActivationFlow />;
  }

  return <ActivePortal />;
}

// ============================================================
// Activation Flow
// ============================================================

function ActivationFlow() {
  const { user, updateUser, logout } = useAuthStore();
  const [step, setStep] = useState<ActivationStep>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [faceData, setFaceData] = useState<{ selfieData: string; facialDescriptor: number[] } | null>(null);
  const [activating, setActivating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmailStep = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [email, password, confirmPassword]);

  const handleEmailSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (validateEmailStep()) {
        setStep('selfie');
      }
    },
    [validateEmailStep]
  );

  const handleFaceCapture = useCallback(
    (data: { selfieData: string; facialDescriptor: number[] }) => {
      setFaceData(data);
      setStep('processing');

      // Call activate API
      activateAccount(data);
    },
    []
  );

  const activateAccount = useCallback(
    async (data: { selfieData: string; facialDescriptor: number[] }) => {
      if (!user?.id) return;

      setActivating(true);

      try {
        const response = await fetch('/api/student/activate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: user.id,
            email,
            password,
            facialData: JSON.stringify({ descriptor: data.facialDescriptor }),
            selfieData: data.selfieData,
          }),
        });

        const result: ApiResponse = await response.json();

        if (result.success && result.data) {
          setStep('complete');
          updateUser({
            activated: true,
            email,
          });
          toast.success('Account activated successfully!');
        } else {
          toast.error(result.error || 'Activation failed');
          setStep('selfie');
          setFaceData(null);
        }
      } catch {
        toast.error('Network error. Please try again.');
        setStep('selfie');
        setFaceData(null);
      } finally {
        setActivating(false);
      }
    },
    [user?.id, email, password, updateUser]
  );

  const handleFaceError = useCallback((error: string) => {
    toast.error(error);
  }, []);

  // Step indicator
  const steps = [
    { key: 'email', label: 'Link Email', icon: Mail },
    { key: 'selfie', label: 'Capture Selfie', icon: Camera },
    { key: 'complete', label: 'Complete', icon: CheckCircle2 },
  ] as const;

  const currentStepIndex = steps.findIndex(
    (s) => s.key === (step === 'processing' ? 'selfie' : step)
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-page-gradient">
      <div className="w-full max-w-md space-y-6">
        {/* Header with back to login */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <div className="flex items-center justify-center size-10 rounded-xl header-gradient text-white shadow-sm">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold text-primary">checkIn</h1>
          </div>
          <p className="text-sm text-muted-foreground">Activate your student account</p>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Login
          </button>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentStepIndex;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : isDone
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step 1: Email & Password */}
        {step === 'email' && (
          <Card className="card-elevated border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Link Your Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? 'border-red-500' : ''}
                    autoFocus
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Create Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={errors.password ? 'border-red-500' : ''}
                  />
                  {errors.password && (
                    <p className="text-xs text-red-500">{errors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={errors.confirmPassword ? 'border-red-500' : ''}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-red-500">{errors.confirmPassword}</p>
                  )}
                </div>
                <Button type="submit" className="w-full gap-2">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Selfie Capture */}
        {step === 'selfie' && (
          <div className="space-y-4">
            <Card className="card-elevated border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    Capture Your Selfie
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStep('email'); setFaceData(null); }}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-blue-50/50 dark:bg-blue-950/20 p-3">
                  <p className="text-sm text-muted-foreground">
                    This photo will be used for identity verification during attendance check-in.
                    Make sure your face is clearly visible and well-lit.
                  </p>
                </div>
              </CardContent>
            </Card>
            <FaceCapture
              onCapture={handleFaceCapture}
              mode="activation"
              onError={handleFaceError}
            />
          </div>
        )}

        {/* Step 3: Processing */}
        {step === 'processing' && (
          <Card className="card-elevated border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="relative">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-semibold">Activating Your Account</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Processing your facial data and setting up your profile...
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && (
          <Card className="card-elevated border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center gap-4 py-8">
                <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center ring-4 ring-emerald-100/50 dark:ring-emerald-950/50">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    Account Activated!
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Your account is ready. You can now check in to attendance sessions.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Active Portal
// ============================================================

function ActivePortal() {
  const { user, logout } = useAuthStore();
  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCheckIn, setActiveCheckIn] = useState<SessionInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/student/sessions?studentId=${user.id}`);
      const result: ApiResponse<SessionWithAttendance[]> = await response.json();

      if (result.success && result.data) {
        setSessions(result.data);
      }
    } catch {
      // Silently fail for polling - don't spam errors
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/student/stats?studentId=${user.id}`);
      const result: ApiResponse<StudentStats> = await response.json();

      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch {
      // Silently fail - stats are not critical
    } finally {
      setStatsLoading(false);
    }
  }, [user?.id]);

  // Initial fetch + polling
  useEffect(() => {
    fetchSessions();
    fetchStats();

    pollRef.current = setInterval(fetchSessions, SESSION_POLL_INTERVAL);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchSessions, fetchStats]);

  // Handle check-in completion
  const handleCheckInComplete = useCallback(
    (result: CheckInResult) => {
      setActiveCheckIn(null);
      // Refresh sessions and stats to get updated attendance status
      fetchSessions();
      fetchStats();

      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    },
    [fetchSessions, fetchStats]
  );

  const handleLogout = useCallback(async () => {
    await logout();
    toast.info('Logged out successfully');
  }, [logout]);

  // Categorize sessions
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const upcomingSessions = sessions.filter((s) => s.status === 'scheduled');
  const pastSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'cancelled'
  );

  // Check-in flow is active
  if (activeCheckIn) {
    return (
      <div className="min-h-screen p-4 sm:p-6 bg-page-gradient">
        <div className="max-w-lg mx-auto pt-4">
          <CheckInFlow
            session={activeCheckIn}
            studentId={user!.id}
            onComplete={handleCheckInComplete}
            onCancel={() => setActiveCheckIn(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-page-gradient">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/80 backdrop-blur-sm border-b border-border/60">
        <div className="header-gradient">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center justify-center size-8 rounded-lg bg-white/20 shrink-0">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-semibold truncate text-white">{user?.name}</h1>
                <p className="text-xs text-white/70 truncate flex items-center gap-1.5">
                  {user?.matricNumber} • {user?.departmentName} • Level {user?.level ?? '—'}
                  <Badge className="bg-white/20 text-white border-white/30 text-[9px] px-1 py-0 hover:bg-white/30">{SCHOOL}</Badge>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setProfileOpen(true)}
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10"
                title="View profile"
              >
                <UserCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchSessions}
                className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10"
                title="Refresh sessions"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <div className="rounded-md border-white/20 bg-white/5 backdrop-blur-sm">
                <ThemeToggle className="h-9 w-9 text-white/80 hover:text-white hover:bg-white/10" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="h-9 w-9 text-white/80 hover:text-red-200 hover:bg-white/10"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 space-y-6">
        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-32 w-full rounded-xl" />
            </div>
          </div>
        )}

        {!loading && sessions.length === 0 && stats && stats.totalSessions === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center size-16 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 mb-4">
              <BookOpen className="h-8 w-8 text-primary/40" />
            </div>
            <p className="text-muted-foreground mt-4">No sessions found for your department</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sessions will appear here when a lecturer creates one for your department
            </p>
          </div>
        )}

        {/* Attendance Stats Overview */}
        {!loading && stats && stats.totalSessions > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Attendance Overview
            </h2>

            {/* Stat Cards Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Attendance Rate Card */}
              <Card className="card-elevated border-0 shadow-sm col-span-2 lg:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Attendance Rate</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold tracking-tight text-foreground">
                          {statsLoading ? '—' : stats.attendanceRate}
                        </span>
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                      <TrendingUp className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <Progress
                    value={stats.attendanceRate}
                    className="h-1.5 mt-3 bg-emerald-100 dark:bg-emerald-950/50"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    {stats.totalPresent} of {stats.totalPresent + stats.totalAbsent + stats.totalRejected} sessions attended
                  </p>
                </CardContent>
              </Card>

              {/* Present Card */}
              <Card className="card-elevated border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Present</p>
                      <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                        {statsLoading ? '—' : stats.totalPresent}
                      </p>
                    </div>
                    <div className="flex items-center justify-center size-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/50">
                      <UserCheck className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Checked in successfully
                  </p>
                </CardContent>
              </Card>

              {/* Absent Card */}
              <Card className="card-elevated border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Absent</p>
                      <p className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                        {statsLoading ? '—' : stats.totalAbsent}
                      </p>
                    </div>
                    <div className="flex items-center justify-center size-9 rounded-lg bg-red-100 dark:bg-red-950/50">
                      <UserX className="h-4.5 w-4.5 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Missed sessions
                  </p>
                </CardContent>
              </Card>

              {/* Upcoming Card */}
              <Card className="card-elevated border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Upcoming</p>
                      <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                        {statsLoading ? '—' : stats.upcomingSessions}
                      </p>
                    </div>
                    <div className="flex items-center justify-center size-9 rounded-lg bg-amber-100 dark:bg-amber-950/50">
                      <CalendarClock className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    Scheduled sessions
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Donut Chart + Recent Attendance */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {/* Donut Chart */}
              <Card className="card-elevated border-0 shadow-sm sm:col-span-2">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Distribution</p>
                  <div className="h-[140px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Present', value: stats.totalPresent, color: '#10b981' },
                            { name: 'Absent', value: stats.totalAbsent, color: '#ef4444' },
                            { name: 'Pending', value: stats.totalPending, color: '#f59e0b' },
                            { name: 'Rejected', value: stats.totalRejected, color: '#8b5cf6' },
                          ].filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={35}
                          outerRadius={55}
                          paddingAngle={3}
                          dataKey="value"
                          stroke="none"
                        >
                          {[
                            { name: 'Present', value: stats.totalPresent, color: '#10b981' },
                            { name: 'Absent', value: stats.totalAbsent, color: '#ef4444' },
                            { name: 'Pending', value: stats.totalPending, color: '#f59e0b' },
                            { name: 'Rejected', value: stats.totalRejected, color: '#8b5cf6' },
                          ]
                            .filter((d) => d.value > 0)
                            .map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            fontSize: '12px',
                          }}
                          formatter={(value: number, name: string) => [`${value}`, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1">
                    {[
                      { label: 'Present', color: 'bg-emerald-500' },
                      { label: 'Absent', color: 'bg-red-500' },
                      { label: 'Pending', color: 'bg-amber-500' },
                      { label: 'Rejected', color: 'bg-violet-500' },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${item.color}`} />
                        <span className="text-[10px] text-muted-foreground">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Attendance */}
              <Card className="card-elevated border-0 shadow-sm sm:col-span-3">
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3">Recent Attendance</p>
                  {stats.recentAttendance.length === 0 ? (
                    <div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">
                      No attendance records yet
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                      {stats.recentAttendance.map((record) => (
                        <RecentAttendanceItem key={record.id} record={record} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {!loading && sessions.length > 0 && (
          <>
            {/* Active Sessions */}
            {activeSessions.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  Active Now ({activeSessions.length})
                </h2>
                <div className="space-y-3">
                  {activeSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onCheckIn={() => setActiveCheckIn(session)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Upcoming Sessions */}
            {upcomingSessions.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Upcoming ({upcomingSessions.length})
                </h2>
                <div className="space-y-3">
                  {upcomingSessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </section>
            )}

            {/* Past Sessions */}
            {pastSessions.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Past Sessions
                </h2>
                <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {pastSessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Profile Panel */}
      <ProfilePanel open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Footer */}
      <footer className="bg-secondary/50 border-t border-border/60 mt-auto">
        <div className="max-w-2xl mx-auto px-4 py-3 text-center text-xs text-muted-foreground">
          checkIn — Student Attendance Platform
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Recent Attendance Item
// ============================================================

interface RecentAttendanceItemProps {
  record: {
    id: string;
    sessionId: string;
    sessionTitle: string;
    courseName: string;
    status: string;
    similarityScore: number | null;
    checkInTime: string | null;
    scheduledAt: string | null;
  };
}

function RecentAttendanceItem({ record }: RecentAttendanceItemProps) {
  const getStatusBadge = () => {
    switch (record.status) {
      case 'present':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Present
          </Badge>
        );
      case 'pending_review':
        return (
          <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />
            Review
          </Badge>
        );
      case 'absent':
        return (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <XCircle className="h-2.5 w-2.5" />
            Absent
          </Badge>
        );
      case 'rejected_identity':
        return (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <XCircle className="h-2.5 w-2.5" />
            Rejected
          </Badge>
        );
      case 'rejected_location':
        return (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <MapPin className="h-2.5 w-2.5" />
            Rejected
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            Pending
          </Badge>
        );
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const checkInTime = formatTime(record.checkInTime);
  const scheduledTime = formatTime(record.scheduledAt);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate leading-tight">{record.sessionTitle}</p>
        <p className="text-[11px] text-muted-foreground truncate">{record.courseName}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground">
          {checkInTime || scheduledTime || '—'}
        </span>
        {getStatusBadge()}
      </div>
    </div>
  );
}

// ============================================================
// Session Card
// ============================================================

interface SessionCardProps {
  session: SessionWithAttendance;
  onCheckIn?: () => void;
}

function SessionCard({ session, onCheckIn }: SessionCardProps) {
  const isActive = session.status === 'active';
  const attendanceStatus = session.attendance?.status;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = () => {
    if (attendanceStatus) {
      switch (attendanceStatus) {
        case 'present':
          return (
            <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Present
            </Badge>
          );
        case 'pending_review':
          return (
            <Badge className="bg-amber-500 hover:bg-amber-600 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Pending Review
            </Badge>
          );
        case 'absent':
          return (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Absent
            </Badge>
          );
        case 'rejected_identity':
          return (
            <Badge variant="destructive" className="gap-1">
              <XCircle className="h-3 w-3" />
              Identity Rejected
            </Badge>
          );
        case 'rejected_location':
          return (
            <Badge variant="destructive" className="gap-1">
              <MapPin className="h-3 w-3" />
              Location Rejected
            </Badge>
          );
        case 'pending':
          return (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Pending
            </Badge>
          );
      }
    }

    // Session status badges
    switch (session.status) {
      case 'active':
        return (
          <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            Live
          </Badge>
        );
      case 'scheduled':
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            Scheduled
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return null;
    }
  };

  const alreadyCheckedIn =
    attendanceStatus === 'present' || attendanceStatus === 'pending_review';

  return (
    <Card
      className={`card-elevated hover:shadow-md transition-shadow border-0 ${
        isActive
          ? alreadyCheckedIn
            ? 'border-l-4 border-l-emerald-400 dark:border-l-emerald-600 bg-card'
            : onCheckIn
              ? 'cursor-pointer hover:border-emerald-500/50 active:scale-[0.98] border-l-4 border-l-blue-400 dark:border-l-blue-600 bg-blue-50/30 dark:bg-blue-950/20'
              : 'border-l-4 border-l-emerald-400 dark:border-l-emerald-600 bg-card'
          : 'bg-card'
      }`}
      onClick={isActive && !alreadyCheckedIn && onCheckIn ? onCheckIn : undefined}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            {/* Course info */}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm truncate">
                  {session.courseName}
                </h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {session.courseCode}
                {session.level && ` • ${session.level}`}
              </p>
            </div>

            {/* Session details */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{session.venueName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {formatDate(session.scheduledAt)}, {formatTime(session.scheduledAt)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Ruler className="h-3.5 w-3.5 shrink-0" />
                <span>Within {session.distanceThreshold}m</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{session.durationMinutes} min</span>
              </div>
              {session.departments.length > 0 && (
                <div className="flex items-center gap-1.5 col-span-2">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {session.departments.map((d) => d.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Check-in button for active sessions */}
          {isActive && !alreadyCheckedIn && onCheckIn && (
            <Button
              size="sm"
              className="shrink-0 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onCheckIn();
              }}
            >
              Check In
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {alreadyCheckedIn && (
            <div className="flex items-center justify-center size-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          )}
        </div>

        {/* Score display for attended sessions */}
        {attendanceStatus && session.attendance?.similarityScore !== null && session.attendance?.similarityScore !== undefined && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Similarity Score</span>
              <span className="font-medium">
                {Math.round(session.attendance.similarityScore)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  attendanceStatus === 'present'
                    ? 'bg-emerald-500'
                    : attendanceStatus === 'pending_review'
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(Math.max(session.attendance.similarityScore, 0), 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
