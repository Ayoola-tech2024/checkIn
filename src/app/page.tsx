'use client';

import { useAuthStore } from '@/hooks/use-auth';
import { LoginScreen } from '@/components/checkin/login-screen';
import { AdminDashboard } from '@/components/checkin/admin-dashboard';
import { StudentPortal } from '@/components/checkin/student-portal';
import { LecturerPortal } from '@/components/checkin/lecturer-portal';

export default function Home() {
  const { isAuthenticated, user } = useAuthStore();

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
