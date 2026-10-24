'use client';
import SiteHeader from '@/app/_components/SiteHeader';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SiteHeader />
      {children}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          Topnet Solutions &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
