'use client';

import { useState } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import type { UserRole, AuthUser } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Shield,
  GraduationCap,
  BookOpen,
  ArrowLeft,
  Loader2,
  Fingerprint,
  LogIn,
  ChevronRight,
} from 'lucide-react';

type LoginStep = 'select-role' | 'login-form';

interface RoleCard {
  role: UserRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  gradientFrom: string;
  gradientTo: string;
  bgLight: string;
  bgDark: string;
  borderHover: string;
}

const ROLES: RoleCard[] = [
  {
    role: 'admin',
    title: 'Admin',
    description: 'Manage students, departments, courses & system settings',
    icon: <Shield className="size-7" />,
    color: 'text-rose-600 dark:text-rose-400',
    gradientFrom: 'from-rose-500',
    gradientTo: 'to-rose-600',
    bgLight: 'bg-rose-50',
    bgDark: 'dark:bg-rose-950/30',
    borderHover: 'hover:border-rose-300 dark:hover:border-rose-700',
  },
  {
    role: 'lecturer',
    title: 'Lecturer',
    description: 'Create sessions, review attendance & manage courses',
    icon: <BookOpen className="size-7" />,
    color: 'text-sky-600 dark:text-sky-400',
    gradientFrom: 'from-sky-500',
    gradientTo: 'to-sky-600',
    bgLight: 'bg-sky-50',
    bgDark: 'dark:bg-sky-950/30',
    borderHover: 'hover:border-sky-300 dark:hover:border-sky-700',
  },
  {
    role: 'student',
    title: 'Student',
    description: 'Check in to sessions, view attendance history',
    icon: <GraduationCap className="size-7" />,
    color: 'text-emerald-600 dark:text-emerald-400',
    gradientFrom: 'from-emerald-500',
    gradientTo: 'to-emerald-600',
    bgLight: 'bg-emerald-50',
    bgDark: 'dark:bg-emerald-950/30',
    borderHover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
];

export function LoginScreen() {
  const { login } = useAuthStore();
  const [step, setStep] = useState<LoginStep>('select-role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [matricNumber, setMatricNumber] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setStep('login-form');
    setEmail('');
    setMatricNumber('');
    setPassword('');
    setError('');
  };

  const handleBack = () => {
    setStep('select-role');
    setSelectedRole(null);
    setEmail('');
    setMatricNumber('');
    setPassword('');
    setName('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !password) return;
    if (selectedRole !== 'student' && !email) return;
    if (selectedRole === 'student' && !email && !matricNumber) return;

    setLoading(true);
    setError('');

    try {
      const body: Record<string, string> = { password, role: selectedRole };
      if (email) body.email = email;
      if (matricNumber) body.matricNumber = matricNumber;

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Login failed');
        return;
      }

      login(data.data as AuthUser);
      toast.success(`Welcome back, ${data.data.name}!`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  const selectedRoleData = ROLES.find((r) => r.role === selectedRole);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-blue-950 relative overflow-hidden">
      {/* Decorative background blobs with blue tints */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Top-right large blob */}
        <div className="absolute -top-32 -right-32 size-[28rem] rounded-full bg-blue-200/30 dark:bg-blue-900/20 blur-3xl" />
        {/* Bottom-left large blob */}
        <div className="absolute -bottom-32 -left-32 size-[28rem] rounded-full bg-blue-100/40 dark:bg-blue-950/30 blur-3xl" />
        {/* Center subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[40rem] rounded-full bg-blue-50/50 dark:bg-blue-900/10 blur-3xl" />
        {/* Small accent blob top-left */}
        <div className="absolute top-20 left-20 size-48 rounded-full bg-sky-100/40 dark:bg-sky-900/15 blur-2xl" />
        {/* Small accent blob bottom-right */}
        <div className="absolute bottom-20 right-20 size-48 rounded-full bg-indigo-100/30 dark:bg-indigo-900/10 blur-2xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header - Prominent checkIn logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center size-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 shadow-lg shadow-blue-500/25 dark:shadow-blue-700/30 mb-5 ring-4 ring-blue-100 dark:ring-blue-900/50 ring-offset-4 ring-offset-white dark:ring-offset-slate-900">
            <Fingerprint className="size-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            check<span className="text-blue-600 dark:text-blue-400">In</span>
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Student Attendance Platform
          </p>
        </div>

        {/* Step: Select Role */}
        {step === 'select-role' && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-center text-foreground">
              Choose your role
            </h2>
            <div className="grid gap-3 sm:grid-cols-1">
              {ROLES.map((r) => (
                <Card
                  key={r.role}
                  className={`cursor-pointer transition-all duration-300 ease-out hover:shadow-lg hover:shadow-blue-500/8 dark:hover:shadow-blue-400/5 ${r.borderHover} hover:-translate-y-1 hover:scale-[1.01] group border-border/60 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm`}
                  onClick={() => handleSelectRole(r.role)}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div
                      className={`flex items-center justify-center size-14 rounded-xl ${r.bgLight} ${r.bgDark} ${r.color} group-hover:scale-110 transition-transform duration-300 shadow-sm`}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {r.title}
                        </h3>
                        {r.role === 'admin' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {r.description}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground/40 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all duration-300" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step: Login Form */}
        {step === 'login-form' && selectedRole && (
          <Card className="shadow-xl shadow-blue-500/8 dark:shadow-blue-900/20 border-blue-100 dark:border-blue-900/40 bg-white/90 dark:bg-slate-900/70 backdrop-blur-sm overflow-hidden">
            {/* Blue accent line at top */}
            <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600" />
            <CardHeader className="pb-4">
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200 mb-3 w-fit group/btn"
              >
                <ArrowLeft className="size-4 group-hover/btn:-translate-x-0.5 transition-transform duration-200" />
                Back to role selection
              </button>
              <CardTitle className="flex items-center gap-3 text-xl">
                <span className={`flex items-center justify-center size-10 rounded-lg ${selectedRoleData?.bgLight} ${selectedRoleData?.bgDark} ${selectedRoleData?.color} shadow-sm`}>
                  {selectedRoleData?.icon}
                </span>
                <span>
                  Sign in as {selectedRoleData?.title}
                </span>
              </CardTitle>
              <CardDescription className="ml-[52px]">
                Enter your credentials to access the platform
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {selectedRole === 'student' ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="matricNumber">Matric Number</Label>
                      <Input
                        id="matricNumber"
                        type="text"
                        placeholder="e.g. CSC/2024/001"
                        value={matricNumber}
                        onChange={(e) => setMatricNumber(e.target.value)}
                        autoFocus
                        className="transition-all duration-200 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">or</span>
                      <Separator className="flex-1" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="your.email@university.edu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="transition-all duration-200 focus:ring-blue-500/20"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                      className="transition-all duration-200 focus:ring-blue-500/20"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="transition-all duration-200 focus:ring-blue-500/20"
                  />
                </div>

                {selectedRole === 'student' && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/20 p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <GraduationCap className="size-4 mt-0.5 shrink-0" />
                      Use your Matric Number with default password (CheckIn@2024) to log in and activate your account.
                    </p>
                  </div>
                )}

                {selectedRole === 'lecturer' && (
                  <div className="rounded-lg border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/20 p-3">
                    <p className="text-sm text-sky-800 dark:text-sky-200 flex items-start gap-2">
                      <BookOpen className="size-4 mt-0.5 shrink-0" />
                      Use your email with default password (CheckIn@2024) to log in.
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 dark:from-blue-600 dark:to-blue-700 dark:hover:from-blue-700 dark:hover:to-blue-800 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all duration-300"
                  disabled={loading || (!email && !matricNumber && selectedRole === 'student') || (!email && selectedRole !== 'student') || !password}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Sign In
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}



        {/* Footer with subtle gradient */}
        <div className="mt-10 text-center">
          <div className="h-px bg-gradient-to-r from-transparent via-blue-200 dark:via-blue-800/40 to-transparent mb-4" />
          <p className="text-xs text-muted-foreground/70">
            checkIn &mdash; Student Attendance Platform
          </p>
        </div>
      </div>
    </div>
  );
}
