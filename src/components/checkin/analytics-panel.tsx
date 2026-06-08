// ============================================================
// checkIn - Analytics Panel Component
// ============================================================

'use client';

import { useEffect, useState, useCallback } from 'react';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Users,
  UserCheck,
  UserX,
  Clock,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { SessionAnalytics, AttendanceStatus } from '@/lib/types';

interface AnalyticsPanelProps {
  sessionId: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  present: '#10b981',
  absent: '#ef4444',
  pending_review: '#f59e0b',
  pending: '#f59e0b',
  rejected_location: '#dc2626',
  rejected_identity: '#b91c1c',
};

const STATUS_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  present: 'default',
  absent: 'destructive',
  pending_review: 'secondary',
  pending: 'secondary',
  rejected_location: 'destructive',
  rejected_identity: 'destructive',
};

function formatStatus(status: AttendanceStatus): string {
  const map: Record<string, string> = {
    present: 'Present',
    absent: 'Absent',
    pending_review: 'Pending Review',
    pending: 'Pending',
    rejected_location: 'Rejected (Location)',
    rejected_identity: 'Rejected (Identity)',
  };
  return map[status] || status;
}

export function AnalyticsPanel({ sessionId, onBack }: AnalyticsPanelProps) {
  const [analytics, setAnalytics] = useState<SessionAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch(`/api/lecturer/analytics?sessionId=${sessionId}`);
      const json = await res.json();
      if (json.success) {
        setAnalytics(json.data);
      } else {
        toast.error(json.error || 'Failed to load analytics');
      }
    } catch {
      toast.error('Network error loading analytics');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <p className="text-muted-foreground mt-4 text-center">No analytics data available.</p>
      </div>
    );
  }

  const { session, totalTargetStudents, presentCount, absentCount, pendingCount, rejectedCount, lateCount, attendances, absentStudents } = analytics;

  // Pie chart data
  const pieData = [
    { name: 'Present', value: presentCount, color: '#10b981' },
    { name: 'Absent', value: absentCount, color: '#ef4444' },
    { name: 'Pending', value: pendingCount, color: '#f59e0b' },
    { name: 'Rejected', value: rejectedCount, color: '#dc2626' },
  ].filter((d) => d.value > 0);

  // Department breakdown for bar chart
  const deptMap = new Map<string, { present: number; absent: number; pending: number; rejected: number }>();
  for (const a of attendances) {
    const dept = a.departmentName || 'Unknown';
    if (!deptMap.has(dept)) {
      deptMap.set(dept, { present: 0, absent: 0, pending: 0, rejected: 0 });
    }
    const entry = deptMap.get(dept)!;
    if (a.status === 'present') entry.present++;
    else if (a.status === 'absent') entry.absent++;
    else if (a.status === 'pending_review' || a.status === 'pending') entry.pending++;
    else entry.rejected++;
  }

  const barData = Array.from(deptMap.entries()).map(([name, counts]) => ({
    department: name,
    ...counts,
  }));

  const summaryCards = [
    { label: 'Target Students', value: totalTargetStudents, icon: Users, color: 'text-blue-600 dark:text-blue-400' },
    { label: 'Present', value: presentCount, icon: UserCheck, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Absent', value: absentCount, icon: UserX, color: 'text-red-600 dark:text-red-400' },
    { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-amber-600 dark:text-amber-400' },
    { label: 'Rejected', value: rejectedCount, icon: ShieldAlert, color: 'text-red-700 dark:text-red-300' },
    { label: 'Late', value: lateCount, icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400' },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" onClick={onBack} className="w-fit">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Sessions
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{session.title}</h2>
          <p className="text-sm text-muted-foreground">
            {session.courseCode} &middot; {session.venueName} &middot;{' '}
            {format(new Date(session.scheduledAt), 'PPp')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4 flex flex-col items-center gap-1">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <span className="text-2xl font-bold">{card.value}</span>
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">No data to display</p>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Department Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="department" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="present" stackId="a" fill="#10b981" name="Present" />
                  <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="Pending" />
                  <Bar dataKey="rejected" stackId="a" fill="#dc2626" name="Rejected" />
                  <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Absent" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-10">No data to display</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Attendance Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Matric No.</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in Time</TableHead>
                  <TableHead className="text-right">Similarity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.studentName}</TableCell>
                    <TableCell>{a.matricNumber}</TableCell>
                    <TableCell>{a.departmentName}</TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_BADGE_VARIANT[a.status] || 'outline'}
                        className={a.status === 'present' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                      >
                        {formatStatus(a.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {a.checkInTime ? format(new Date(a.checkInTime), 'HH:mm:ss') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.similarityScore !== null ? `${a.similarityScore.toFixed(1)}%` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
                {attendances.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No attendance records
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Absent Students */}
      {absentStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-600 dark:text-red-400">
              Absent Students ({absentStudents.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Matric No.</TableHead>
                    <TableHead>Department</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absentStudents.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.matricNumber}</TableCell>
                      <TableCell>{s.departmentName}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
