'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { ApiResponse } from '@/lib/types';
import {
  SLIT_DEPARTMENTS,
  VALID_LEVELS,
  SCHOOL,
} from '@/lib/constants';
import {
  User,
  Mail,
  Shield,
  GraduationCap,
  BookOpen,
  LogOut,
  Loader2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Camera,
  Building2,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface ProfilePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AdminProfileData {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface LecturerProfileData {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
  courses: { id: string; name: string; code: string }[];
  sessionCount: number;
}

interface StudentProfileData {
  id: string;
  name: string;
  email: string | null;
  matricNumber: string;
  departmentName: string;
  departmentCode: string;
  level: number;
  activated: boolean;
  selfieData: string | null;
  createdAt: string;
}

type ProfileData = AdminProfileData | LecturerProfileData | StudentProfileData;

// ============================================================
// Helpers
// ============================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleColor(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-rose-500/20 text-rose-600 dark:text-rose-400';
    case 'lecturer':
      return 'bg-sky-500/20 text-sky-600 dark:text-sky-400';
    case 'student':
      return 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getAvatarBg(role: string): string {
  switch (role) {
    case 'admin':
      return 'bg-rose-500 text-white';
    case 'lecturer':
      return 'bg-sky-500 text-white';
    case 'student':
      return 'bg-emerald-500 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getRoleIcon(role: string) {
  switch (role) {
    case 'admin':
      return <Shield className="size-3.5" />;
    case 'lecturer':
      return <BookOpen className="size-3.5" />;
    case 'student':
      return <GraduationCap className="size-3.5" />;
    default:
      return <User className="size-3.5" />;
  }
}

function getRoleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function getApiBase(role: string): string {
  switch (role) {
    case 'admin':
      return '/api/admin/profile';
    case 'lecturer':
      return '/api/lecturer/profile';
    case 'student':
      return '/api/student/profile';
    default:
      return '';
  }
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ============================================================
// Profile Panel Component
// ============================================================

export function ProfilePanel({ open, onOpenChange }: ProfilePanelProps) {
  const { user, logout, updateUser } = useAuthStore();
  const role = user?.role ?? 'student';

  // Profile data state
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editLevel, setEditLevel] = useState<string>('100');
  const [editDepartmentCode, setEditDepartmentCode] = useState<string>('none');
  const [saving, setSaving] = useState(false);

  // Password change state
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Student selfie for display
  const [studentSelfie, setStudentSelfie] = useState<string | null>(null);

  // Fetch profile on open
  const fetchProfile = useCallback(async () => {
    if (!user?.id || !open) return;
    setLoading(true);

    try {
      const apiUrl = `${getApiBase(role)}?${role}Id=${user.id}`;
      const res = await fetch(apiUrl);
      const data: ApiResponse<ProfileData> = await res.json();

      if (data.success && data.data) {
        const profile = data.data;
        setProfileData(profile);
        setEditName(profile.name);
        setEditEmail(profile.email ?? '');

        // Set SLIT-specific fields
        if (role === 'student') {
          const studentProfile = profile as StudentProfileData;
          setEditLevel(String(studentProfile.level ?? 100));
        }
        if (role === 'lecturer') {
          const lecturerProfile = profile as LecturerProfileData;
          setEditDepartmentCode(lecturerProfile.departmentId ?? 'none');
        }

        // For student, extract selfie data
        if (role === 'student') {
          const studentProfile = profile as StudentProfileData;
          setStudentSelfie(studentProfile.selfieData);
        }
      } else {
        toast.error(data.error || 'Failed to load profile');
      }
    } catch {
      toast.error('Network error loading profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id, role, open]);

  useEffect(() => {
    if (open) {
      fetchProfile();
      // Reset password fields on open
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordOpen(false);
    }
  }, [open, fetchProfile]);

  // Handle save
  const handleSave = async () => {
    if (!user?.id) return;

    // Validate
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    if (!editEmail.trim()) {
      toast.error('Email cannot be empty');
      return;
    }

    // Validate password fields if changing password
    if (passwordOpen && newPassword) {
      if (!currentPassword) {
        toast.error('Current password is required to change password');
        return;
      }
      if (newPassword.length < 6) {
        toast.error('New password must be at least 6 characters');
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error('New passwords do not match');
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        id: user.id,
        name: editName.trim(),
        email: editEmail.trim(),
      };

      // Include SLIT-specific fields
      if (role === 'student') {
        payload.level = parseInt(editLevel, 10);
      }
      if (role === 'lecturer') {
        payload.departmentId = editDepartmentCode === 'none' ? null : editDepartmentCode;
      }

      if (passwordOpen && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch(getApiBase(role), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data: ApiResponse = await res.json();

      if (data.success) {
        toast.success('Profile updated successfully');
        const updates: Record<string, unknown> = { name: editName.trim(), email: editEmail.trim() };
        if (role === 'student') updates.level = parseInt(editLevel, 10);
        if (role === 'lecturer') updates.departmentId = editDepartmentCode === 'none' ? null : editDepartmentCode;
        updateUser(updates);
        // Refresh profile
        fetchProfile();
        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPasswordOpen(false);
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch {
      toast.error('Network error updating profile');
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    onOpenChange(false);
    logout();
    toast.success('Logged out successfully');
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto"
        aria-label="Profile panel"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="sr-only">User Profile</SheetTitle>
          <SheetDescription className="sr-only">
            View and manage your profile information
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 px-1 pb-6">
          {/* ============================================ */}
          {/* Header: Avatar + Name + Role Badge + Email  */}
          {/* ============================================ */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <Avatar className="size-20 ring-4 ring-background shadow-lg">
              {role === 'student' && studentSelfie ? (
                <img
                  src={studentSelfie}
                  alt={`${user.name}'s profile photo`}
                  className="size-full rounded-full object-cover"
                />
              ) : (
                <AvatarFallback
                  className={getAvatarBg(role)}
                  style={{ fontSize: '1.5rem' }}
                >
                  {getInitials(user.name)}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold leading-tight">{user.name}</h2>
              <Badge
                className={`gap-1.5 ${getRoleColor(role)} border-0`}
                variant="secondary"
              >
                {getRoleIcon(role)}
                {getRoleLabel(role)}
              </Badge>
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 border text-xs">
                {SCHOOL}
              </Badge>
              {user.email && (
                <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5 mt-1">
                  <Mail className="size-3.5" />
                  {user.email}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* ============================================ */}
          {/* Profile Details Card                         */}
          {/* ============================================ */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Card className="border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <User className="size-4" />
                  Profile Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Admin Profile */}
                {role === 'admin' && profileData && (
                  <>
                    <DetailRow icon={<User className="size-4" />} label="Name" value={(profileData as AdminProfileData).name} />
                    <DetailRow icon={<Mail className="size-4" />} label="Email" value={(profileData as AdminProfileData).email} />
                    <DetailRow
                      icon={<Shield className="size-4" />}
                      label="Created"
                      value={formatDate((profileData as AdminProfileData).createdAt)}
                    />
                  </>
                )}

                {/* Lecturer Profile */}
                {role === 'lecturer' && profileData && (
                  <>
                    <DetailRow icon={<User className="size-4" />} label="Name" value={(profileData as LecturerProfileData).name} />
                    <DetailRow icon={<Mail className="size-4" />} label="Email" value={(profileData as LecturerProfileData).email} />
                    <DetailRow
                      icon={<Building2 className="size-4" />}
                      label="Department"
                      value={(profileData as LecturerProfileData).departmentName || 'Not assigned'}
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <BookOpen className="size-4 shrink-0" />
                        <span>Assigned Courses</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-6">
                        {(profileData as LecturerProfileData).courses.length > 0 ? (
                          (profileData as LecturerProfileData).courses.map((c) => (
                            <Badge key={c.id} variant="outline" className="text-xs font-normal">
                              {c.code} — {c.name}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">No courses assigned</span>
                        )}
                      </div>
                    </div>
                    <DetailRow
                      icon={<GraduationCap className="size-4" />}
                      label="Sessions Taken"
                      value={`${(profileData as LecturerProfileData).sessionCount} session(s)`}
                    />
                  </>
                )}

                {/* Student Profile */}
                {role === 'student' && profileData && (
                  <>
                    <DetailRow icon={<User className="size-4" />} label="Name" value={(profileData as StudentProfileData).name} />
                    <DetailRow
                      icon={<GraduationCap className="size-4" />}
                      label="Matric Number"
                      value={(profileData as StudentProfileData).matricNumber}
                      mono
                    />
                    <DetailRow icon={<Mail className="size-4" />} label="Email" value={(profileData as StudentProfileData).email || 'Not set'} />
                    <DetailRow
                      icon={<Building2 className="size-4" />}
                      label="Department"
                      value={
                        (profileData as StudentProfileData).departmentName ||
                        'Not assigned'
                      }
                    />
                    <DetailRow
                      icon={<GraduationCap className="size-4" />}
                      label="Level"
                      value={String((profileData as StudentProfileData).level ?? '—')}
                    />
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground min-w-[80px]">Status</span>
                      {(profileData as StudentProfileData).activated ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 border hover:bg-emerald-100">
                          Activated
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800 border hover:bg-amber-100">
                          Not Activated
                        </Badge>
                      )}
                    </div>
                    {(profileData as StudentProfileData).selfieData && (
                      <div className="flex items-start gap-2 text-sm">
                        <Camera className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="text-muted-foreground min-w-[80px]">Photo</span>
                        <Avatar className="size-12 ring-2 ring-background shadow-sm">
                          <img
                            src={(profileData as StudentProfileData).selfieData!}
                            alt="Profile selfie"
                            className="size-full rounded-full object-cover"
                          />
                        </Avatar>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Separator />

          {/* ============================================ */}
          {/* Edit Profile Section                          */}
          {/* ============================================ */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Pencil className="size-4" />
                Edit Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="text-sm">
                  Name
                </Label>
                <Input
                  id="profile-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your name"
                  aria-label="Edit name"
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="profile-email" className="text-sm">
                  Email
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="your@email.com"
                  aria-label="Edit email"
                />
              </div>

              {/* School (read-only) */}
              <div className="space-y-2">
                <Label className="text-sm">School</Label>
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 border">
                    {SCHOOL}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Read-only</span>
                </div>
              </div>

              {/* Student: Level dropdown */}
              {role === 'student' && (
                <div className="space-y-2">
                  <Label htmlFor="profile-level" className="text-sm">Level</Label>
                  <Select value={editLevel} onValueChange={setEditLevel}>
                    <SelectTrigger id="profile-level" className="w-full">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      {VALID_LEVELS.map((l) => (
                        <SelectItem key={String(l)} value={String(l)}>
                          {l} Level
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Lecturer: Department dropdown */}
              {role === 'lecturer' && (
                <div className="space-y-2">
                  <Label htmlFor="profile-dept" className="text-sm">Department</Label>
                  <Select value={editDepartmentCode} onValueChange={setEditDepartmentCode}>
                    <SelectTrigger id="profile-dept" className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {SLIT_DEPARTMENTS.map((d) => (
                        <SelectItem key={d.code} value={d.code}>
                          {d.name} ({d.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Change Password (Collapsible) */}
              <Collapsible open={passwordOpen} onOpenChange={setPasswordOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between gap-2 text-muted-foreground hover:text-foreground px-2"
                    aria-expanded={passwordOpen}
                    aria-controls="password-section"
                  >
                    <span className="flex items-center gap-2">
                      <KeyRound className="size-4" />
                      Change Password
                    </span>
                    {passwordOpen ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent id="password-section" className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="current-password" className="text-sm">
                      Current Password
                    </Label>
                    <Input
                      id="current-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      aria-label="Current password"
                      autoComplete="current-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password" className="text-sm">
                      New Password
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      aria-label="New password"
                      autoComplete="new-password"
                    />
                    {newPassword.length > 0 && newPassword.length < 6 && (
                      <p className="text-xs text-destructive">
                        Password must be at least 6 characters
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password" className="text-sm">
                      Confirm New Password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      aria-label="Confirm new password"
                      autoComplete="new-password"
                    />
                    {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                      <p className="text-xs text-destructive">
                        Passwords do not match
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Save Button */}
              <Button
                onClick={handleSave}
                disabled={saving || !editName.trim() || !editEmail.trim()}
                className="w-full shadow-sm hover:shadow-md transition-shadow"
                aria-label="Save profile changes"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* ============================================ */}
          {/* Logout Button                                */}
          {/* ============================================ */}
          <Button
            variant="destructive"
            onClick={handleLogout}
            className="w-full shadow-sm hover:shadow-md transition-shadow"
            aria-label="Log out of your account"
          >
            <LogOut className="size-4" />
            Log Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================
// Detail Row Helper
// ============================================================

function DetailRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground min-w-[80px]">{label}</span>
      <span className={mono ? 'font-mono' : ''}>{value}</span>
    </div>
  );
}
