'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/hooks/use-auth';
import { LoginScreen } from '@/components/checkin/login-screen';
import { AdminDashboard } from '@/components/checkin/admin-dashboard';
import { StudentPortal } from '@/components/checkin/student-portal';
import { LecturerPortal } from '@/components/checkin/lecturer-portal';
import { HodPortal } from '@/components/checkin/hod-portal';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, user, hydrated, validateSession, validating } = useAuthStore();
  const validated = useRef(false);

  // After hydration, validate the session cookie against the server.
  // This ensures the JWT is still valid and prevents stale local state.
  useEffect(() => {
    if (hydrated && !validated.current) {
      validated.current = true;
      validateSession();
    }
  }, [hydrated, validateSession]);

  // Wait for hydration to complete before rendering
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading checkIn...</p>
        </div>
      </div>
    );
  }

  // While validating the session, show loading (only if we think we're authenticated)
  if (isAuthenticated && validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'hod':
      return <HodPortal />;
    case 'lecturer':
      return <LecturerPortal />;
    case 'student':
      return <StudentPortal />;
    default:
      return <LoginScreen />;
  }
}
