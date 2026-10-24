'use client';
import SiteHeader from '@/app/_components/SiteHeader';

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SiteHeader />
      {children}
    </div>
  );
}
