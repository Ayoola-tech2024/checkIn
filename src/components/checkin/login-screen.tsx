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
  UserPlus,
  LogIn,
} from 'lucide-react';

type LoginStep = 'select-role' | 'login-form' | 'admin-init';

interface RoleCard {
  role: UserRole;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const ROLES: RoleCard[] = [
  {
    role: 'admin',
    title: 'Admin',
    description: 'Manage students, departments, courses & system settings',
    icon: <Shield className="size-8" />,
    color: 'text-rose-600 dark:text-rose-400',
  },
  {
    role: 'lecturer',
    title: 'Lecturer',
    description: 'Create sessions, review attendance & manage courses',
    icon: <BookOpen className="size-8" />,
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    role: 'student',
    title: 'Student',
    description: 'Check in to sessions, view attendance history',
    icon: <GraduationCap className="size-8" />,
    color: 'text-emerald-600 dark:text-emerald-400',
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
        // If admin login fails with 401 and the message says invalid credentials,
        // it might be that no admin exists yet — offer to create one
        if (
          selectedRole === 'admin' &&
          res.status === 401 &&
          data.error?.includes('Invalid credentials')
        ) {
          setStep('admin-init');
          setError('');
          setLoading(false);
          return;
        }
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

  const handleAdminInit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to create admin account');
        return;
      }

      // Now login with the newly created admin
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'admin' }),
      });

      const loginData = await loginRes.json();

      if (!loginData.success) {
        setError('Admin created but login failed. Please try logging in.');
        setStep('login-form');
        return;
      }

      login(loginData.data as AuthUser);
      toast.success('Admin account created successfully!');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg">
            <Fingerprint className="size-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            checkIn
          </h1>
          <p className="text-muted-foreground mt-1">
            Student Attendance Platform
          </p>
        </div>

        {/* Step: Select Role */}
        {step === 'select-role' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-center text-foreground">
              Choose your role
            </h2>
            <div className="grid gap-4 sm:grid-cols-1">
              {ROLES.map((r) => (
                <Card
                  key={r.role}
                  className="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 group"
                  onClick={() => handleSelectRole(r.role)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={`flex items-center justify-center size-14 rounded-xl bg-muted ${r.color} group-hover:scale-105 transition-transform`}
                    >
                      {r.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">
                          {r.title}
                        </h3>
                        {r.role === 'admin' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {r.description}
                      </p>
                    </div>
                    <LogIn className="size-4 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Step: Login Form */}
        {step === 'login-form' && selectedRole && (
          <Card className="shadow-lg">
            <CardHeader>
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 w-fit"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <CardTitle className="flex items-center gap-2">
                {ROLES.find((r) => r.role === selectedRole)?.icon &&
                  (
                    <span className={ROLES.find((r) => r.role === selectedRole)?.color}>
                      {ROLES.find((r) => r.role === selectedRole)?.icon}
                    </span>
                  )}
                Sign in as {ROLES.find((r) => r.role === selectedRole)?.title}
              </CardTitle>
              <CardDescription>
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
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Separator className="flex-1" />
                      <span className="text-xs text-muted-foreground">or</span>
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
                  />
                </div>

                {selectedRole === 'student' && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                      <GraduationCap className="size-4 mt-0.5 shrink-0" />
                      Use your Matric Number with default password (CheckIn@2024) to log in and activate your account.
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
                  className="w-full"
                  disabled={loading || (!email && !matricNumber && selectedRole === 'student') || (!email && selectedRole !== 'student') || !password}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Step: Admin Init */}
        {step === 'admin-init' && (
          <Card className="shadow-lg">
            <CardHeader>
              <button
                onClick={handleBack}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 w-fit"
              >
                <ArrowLeft className="size-4" />
                Back
              </button>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-rose-600 dark:text-rose-400" />
                Initialize Admin Account
              </CardTitle>
              <CardDescription>
                No admin account found. Create the initial administrator to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdminInit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="init-name">Full Name</Label>
                  <Input
                    id="init-name"
                    type="text"
                    placeholder="Admin Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="init-email">Email</Label>
                  <Input
                    id="init-email"
                    type="email"
                    placeholder="admin@university.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="init-password">Password</Label>
                  <Input
                    id="init-password"
                    type="password"
                    placeholder="Create a secure password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <Separator />

                <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-3">
                  <p className="text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2">
                    <Shield className="size-4 mt-0.5 shrink-0" />
                    This will create the system administrator account. Only one admin can be initialized.
                  </p>
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !name || !email || !password}
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating admin...
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4" />
                      Create Admin Account
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          checkIn &mdash; Student Attendance Platform
        </p>
      </div>
    </div>
  );
}
