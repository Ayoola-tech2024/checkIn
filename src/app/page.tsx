'use client';

import { useAuthStore } from '@/hooks/use-auth';
import { LoginScreen } from '@/components/checkin/login-screen';
import { AdminDashboard } from '@/components/checkin/admin-dashboard';
import { StudentPortal } from '@/components/checkin/student-portal';
import { LecturerPortal } from '@/components/checkin/lecturer-portal';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, user, hydrated } = useAuthStore();

  // Wait for hydration to complete before rendering
  // This prevents the flash of login screen → dashboard on page load
  // and prevents hydration mismatches when opening in a new tab
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

  if (!isAuthenticated || !user) {
    return <LoginScreen />;
  }

  switch (user.role) {
    case 'admin':
      return <AdminDashboard />;
    case 'lecturer':
      return <LecturerPortal />;
    case 'student':
      return <StudentPortal />;
    default:
      return <LoginScreen />;
  }
}
