'use client';
// ============================================================================
// Topnet Solutions — Reusable Site Header for all public pages
// Same branding as landing page navbar
// ============================================================================
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Menu, X, LogIn, UserPlus, LayoutDashboard } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/lib/store';

const NAV_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Tests IT', href: '/skills' },
  { label: 'Formations', href: '/catalog' },
  { label: 'Offres', href: '/shop' },
];

export default function SiteHeader() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#1B0CB3] via-[#00B341] to-[#A09060]" />

      <nav
        className={clsx(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-[0_2px_15px_rgba(0,0,0,0.06)]'
            : 'bg-white dark:bg-gray-900',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo-topnet.jpg" alt="Topnet Solutions" width={120} height={40} className="w-[120px] h-auto object-contain" />
              <span className="text-base font-bold text-[#00B341]">Academy</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-[#1B0CB3] dark:hover:text-blue-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {token ? (
                <button
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1B0CB3] text-white hover:bg-[#0D0670] transition-colors"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Mon espace</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/login')}
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-[#1B0CB3] text-[#1B0CB3] hover:bg-[#1B0CB3]/5 transition-colors"
                  >
                    <LogIn className="w-4 h-4" /> Connexion
                  </button>
                  <button
                    onClick={() => router.push('/register')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1B0CB3] text-white hover:bg-[#0D0670] transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline">S'inscrire</span>
                  </button>
                </>
              )}

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>
    </>
  );
}
