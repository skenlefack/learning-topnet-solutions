'use client';
// ============================================================================
// Topnet Solutions Academy — Admin Dashboard
// Lazy-loaded back-office with stats, charts, CRUD, role-scoped data
// ============================================================================
import { Suspense, lazy } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import DashboardShell from '../_components/DashboardShell';

const AdminDashboardContent = lazy(() => import('./AdminDashboardContent'));

const ADMIN_ROLES = ['admin_country', 'admin_rec', 'admin_continental'];

function AdminSkeleton() {
  return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-brand-navy dark:text-brand-gold mx-auto" />
        <p className="text-sm text-[var(--text-secondary)]">Chargement du back-office...</p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, token } = useAuth();
  const router = useRouter();

  // Guard: only admin roles
  useEffect(() => {
    if (user && !ADMIN_ROLES.includes(user.role)) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  if (!user || !ADMIN_ROLES.includes(user.role)) {
    return (
      <DashboardShell>
        <AdminSkeleton />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Suspense fallback={<AdminSkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </DashboardShell>
  );
}
