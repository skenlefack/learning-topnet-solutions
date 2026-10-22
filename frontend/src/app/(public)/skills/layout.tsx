'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Monitor, LogIn, UserPlus } from 'lucide-react';
import { useAuthStore } from '@/lib/store';

export default function SkillsPublicLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Minimal navbar */}
      <nav className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Accueil</span>
            </Link>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700" />
            <Link href="/skills" className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              <Monitor className="w-5 h-5 text-blue-600" />
              <span>Tests de niveau IT</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {token ? (
              <button
                onClick={() => router.push('/dashboard')}
                className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 bg-gray-100 dark:bg-gray-700 rounded-lg"
              >
                Mon espace
              </button>
            ) : (
              <>
                <button
                  onClick={() => router.push('/login')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900"
                >
                  <LogIn className="w-4 h-4" /> Connexion
                </button>
                <button
                  onClick={() => router.push('/register')}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <UserPlus className="w-4 h-4" /> S'inscrire
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      {children}

      {/* Footer minimal */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          Topnet Solutions &copy; {new Date().getFullYear()} — Plateforme de formation et certification IT
        </div>
      </footer>
    </div>
  );
}
