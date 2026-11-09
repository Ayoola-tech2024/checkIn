'use client';

import { useState } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import type { UserRole, AuthUser } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Shield,
  GraduationCap,
  BookOpen,
  Loader2,
  Fingerprint,
  LogIn,
  Users,
  Eye,
  EyeOff,
  MapPin,
  Sparkles,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

interface RoleOption {
  role: UserRole;
  label: string;
  badge: string;
  icon: React.ReactNode;
  hint: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    role: 'student',
    label: 'Student',
    badge: 'Undergraduate',
    icon: <GraduationCap className="size-4" />,
    hint: 'Enter your FUTA matric number or student email',
  },
  {
    role: 'lecturer',
    label: 'Lecturer',
    badge: 'Faculty',
    icon: <BookOpen className="size-4" />,
    hint: 'Enter your institutional staff email address',
  },
  {
    role: 'hod',
    label: 'HOD',
    badge: 'Department Head',
    icon: <Users className="size-4" />,
    hint: 'Enter your Head of Department administrative email',
  },
  {
    role: 'admin',
    label: 'Admin',
    badge: 'Superuser',
    icon: <Shield className="size-4" />,
    hint: 'Enter central administration credentials',
  },
];

export function LoginScreen() {
  const { login } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentRoleConfig = ROLE_OPTIONS.find((r) => r.role === selectedRole) || ROLE_OPTIONS[0];

  const handleRoleChange = (role: UserRole) => {
    setSelectedRole(role);
    setError('');
    setIdentifier('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please provide all credentials');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const body: Record<string, string> = {
        password,
        role: selectedRole,
      };

      if (selectedRole === 'student') {
        if (identifier.includes('@')) {
          body.email = identifier.trim();
        } else {
          body.matricNumber = identifier.trim().toUpperCase();
        }
      } else {
        body.email = identifier.trim();
      }

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Authentication failed. Please verify credentials.');
        return;
      }

      login(data.data as AuthUser);
      toast.success(`Welcome back, ${data.data.name}!`);
    } catch {
      setError('Network communication failed. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] flex flex-col justify-between p-4 sm:p-6 lg:p-8 antialiased">
      
      {/* Top Navigation Bar */}
      <header className="max-w-7xl w-full mx-auto flex items-center justify-between pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl border border-blue-500/20 shadow-sm">
            <Fingerprint className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight">check<span className="text-blue-600 dark:text-blue-400">In</span></span>
              <span className="text-[11px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                SLIT • FUTA
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">School of Logistics and Innovation Technology</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--card)] border border-[var(--border)] text-xs font-medium">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[var(--muted-foreground)]">System Status:</span>
            <span className="text-[var(--foreground)]">Operational</span>
          </div>
          <ThemeToggle className="size-9 rounded-xl border border-[var(--border)]" />
        </div>
      </header>

      {/* Main Dual-Column Showcase & Login */}
      <main className="max-w-7xl w-full mx-auto my-auto py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* Left Column: Product Showcase & Architecture Value */}
        <div className="lg:col-span-7 space-y-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium border border-blue-500/20">
              <Sparkles className="size-3.5" />
              <span>Next-Gen Academic Verification</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.15]">
              Biometric Attendance & Geofenced Hall Clearance
            </h1>
            <p className="text-sm sm:text-base text-[var(--muted-foreground)] max-w-xl leading-relaxed">
              Designed for high-throughput lecture halls. Powered by MediaPipe 468-point 3D facial landmarks and dual-anchor Haversine GPS proximity verification.
            </p>
          </div>

          {/* Architecture Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Fingerprint className="size-5" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">MediaPipe 3D Mesh</h3>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-normal">
                Sub-millimeter landmark spatial geometry with integrated Eye Aspect Ratio (EAR) anti-spoof liveness.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <MapPin className="size-5" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">50m Haversine Radius</h3>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-normal">
                Two-phase high-precision coordinates matching student devices directly to lecturer active venues.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                <Building2 className="size-5" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">7 SLIT Departments</h3>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-normal">
                Hierarchical role governance across BIT, FINT, EMT, LTT, PMT, PRMT, and SIMT faculties.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-1.5">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <CheckCircle2 className="size-5" />
                <h3 className="text-sm font-semibold text-[var(--foreground)]">75% Exam Clearance</h3>
              </div>
              <p className="text-xs text-[var(--muted-foreground)] leading-normal">
                Continuous CA scoring calculations, live analytics dashboards, and official RFC 4180 CSV exports.
              </p>
            </div>
          </div>

        </div>

        {/* Right Column: Sleek Authentication Card */}
        <div className="lg:col-span-5 w-full">
          <Card className="border-[var(--border)] bg-[var(--card)] shadow-lg rounded-2xl overflow-hidden">
            
            {/* Top Accent Bar */}
            <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500" />

            <CardHeader className="space-y-3 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold tracking-tight">Portal Access</CardTitle>
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5">
                  {currentRoleConfig.badge}
                </Badge>
              </div>
              <CardDescription className="text-xs text-[var(--muted-foreground)]">
                {currentRoleConfig.hint}
              </CardDescription>

              {/* Role Segmented Tabs */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-[var(--background)] rounded-xl border border-[var(--border)]">
                {ROLE_OPTIONS.map((opt) => {
                  const isActive = selectedRole === opt.role;
                  return (
                    <button
                      key={opt.role}
                      type="button"
                      onClick={() => handleRoleChange(opt.role)}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs font-semibold border border-[var(--border)]'
                          : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                      }`}
                    >
                      {opt.icon}
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                
                {/* Identifier Input */}
                <div className="space-y-1.5">
                  <Label htmlFor="identifier" className="text-xs font-medium">
                    {selectedRole === 'student' ? 'Matric Number or Email' : 'Institutional Email'}
                  </Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder={selectedRole === 'student' ? 'e.g. BIT/25/9975' : 'e.g. name@futa.edu.ng'}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    required
                    className="h-10 text-sm rounded-xl border-[var(--border)] bg-[var(--background)] focus:border-blue-500"
                  />
                  {selectedRole === 'student' && (
                    <p className="text-[11px] text-[var(--muted-foreground)]">
                      Default student password is your <strong>SURNAME</strong> in uppercase.
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your security password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-10 text-sm rounded-xl border-[var(--border)] bg-[var(--background)] focus:border-blue-500 pr-10"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive font-medium">
                    {error}
                  </div>
                )}

                {/* Submit Action Button */}
                <Button
                  type="submit"
                  disabled={loading || !identifier || !password}
                  className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Authenticating credentials...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      <span>Sign In as {currentRoleConfig.label}</span>
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto pt-6 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--muted-foreground)]">
        <div>
          © 2026 Federal University of Technology, Akure. School of Logistics & Innovation Technology.
        </div>
        <div className="flex items-center gap-4">
          <span>PostgREST Database</span>
          <span>•</span>
          <span>WASM MediaPipe 468</span>
          <span>•</span>
          <span>Haversine GPS Engine</span>
        </div>
      </footer>

    </div>
  );
}
