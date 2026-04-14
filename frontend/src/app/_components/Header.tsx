'use client';
// ============================================================================
// AU-IBAR Learning — Header
// Search, notifications, dark mode toggle, language selector, user avatar
// Sticky with backdrop blur
// ============================================================================
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  Moon,
  Sun,
  Menu,
  Globe,
  X,
  LogOut,
  User,
  BookOpen,
  Layers,
  FileText,
  Loader2,
} from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { searchApi } from '@/lib/api';
import NotificationDropdown from './NotificationDropdown';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderProps {
  onMenuToggle: () => void;
}

const LANGUAGES = [
  { code: 'fr' as const, label: 'Fran\u00e7ais', short: 'FR' },
  { code: 'en' as const, label: 'English', short: 'EN' },
  { code: 'ar' as const, label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', short: 'AR' },
  { code: 'pt' as const, label: 'Portugu\u00eas', short: 'PT' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function getLocalizedText(text: Record<string, string> | string | undefined, lang: string = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const { user, token, theme, toggleTheme, language, setLanguage } = useAuthStore();
  const router = useRouter();
  const t = useTranslations('header');

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ courses: any[]; modules: any[]; lessons: any[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Focus input when search opens
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2 || !token) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res: any = await searchApi.global(token, { q: searchQuery, lang: language });
        setSearchResults(res.data || { courses: [], modules: [], lessons: [] });
      } catch {
        setSearchResults({ courses: [], modules: [], lessons: [] });
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, token, language]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    useAuthStore.getState().logout();
    document.cookie = 'aris-token=; path=/; max-age=0; samesite=lax';
    toast.success(t('logoutSuccess'));
    window.location.href = '/login';
  };

  // User initials
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase()
    : 'AA';

  const currentLang = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return (
    <header
      className={clsx(
        'sticky top-0 z-30 h-14 flex items-center justify-between px-4 lg:px-6',
        'bg-white/80 dark:bg-surface-dark-card/80 glass',
        'border-b border-[var(--border)]',
      )}
    >
      {/* Left — Hamburger + Branding (mobile) + Search */}
      <div className="flex items-center gap-2">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 -ms-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
          aria-label="Toggle menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Mobile brand — hidden on desktop (sidebar shows it) */}
        <div className="lg:hidden flex items-center gap-2">
          <Image
            src="/au-logo.png"
            alt="AU-IBAR"
            width={28}
            height={28}
            className="w-7 h-7 object-contain"
          />
          <div className="leading-none">
            <span className="font-display text-lg text-brand-navy dark:text-white tracking-tight">
              AU-IBAR
            </span>
            <span className="text-[9px] font-medium tracking-widest text-brand-gold uppercase ms-1">
              Learning
            </span>
          </div>
        </div>

        {/* Page context — visible on desktop */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            learning.au-ibar.org
          </span>
        </div>

        {/* Search */}
        <div className="relative flex items-center" ref={searchContainerRef}>
          <AnimatePresence>
            {searchOpen ? (
              <motion.div
                key="search-input"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-visible"
              >
                <div className="relative">
                  {searchLoading ? (
                    <Loader2 className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-navy dark:text-brand-gold animate-spin" />
                  ) : (
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                  )}
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('search')}
                    className={clsx(
                      'w-full pl-8 pr-8 py-2 rounded-lg text-sm',
                      'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                      'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                      'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
                      'focus:border-brand-navy dark:focus:border-brand-gold',
                    )}
                  />
                  <button
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                      setSearchResults(null);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Search results dropdown */}
                {searchResults && searchQuery.length >= 2 && (
                  <div className={clsx(
                    'absolute left-0 top-full mt-1 w-full max-h-80 overflow-y-auto rounded-xl shadow-lg z-50',
                    'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                  )}>
                    {searchResults.courses.length === 0 && searchResults.modules.length === 0 && searchResults.lessons.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-[var(--text-secondary)] text-center">
                        {t('noResults', { query: searchQuery })}
                      </div>
                    ) : (
                      <>
                        {searchResults.courses.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] bg-gray-50 dark:bg-gray-800/50">
                              {t('sectionCourses')}
                            </div>
                            {searchResults.courses.map((c: any) => (
                              <button
                                key={c.id}
                                onClick={() => {
                                  router.push(`/courses/${c.slug || c.id}`);
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  setSearchResults(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <BookOpen className="w-4 h-4 text-brand-navy dark:text-brand-gold shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                    {getLocalizedText(c.title, language)}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">{c.level}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.modules.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] bg-gray-50 dark:bg-gray-800/50">
                              {t('sectionModules')}
                            </div>
                            {searchResults.modules.map((m: any) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  router.push(`/courses/${m.course_slug || m.course_id}`);
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  setSearchResults(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <Layers className="w-4 h-4 text-purple-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                    {getLocalizedText(m.title, language)}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)] truncate">
                                    {getLocalizedText(m.course_title, language)}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchResults.lessons.length > 0 && (
                          <div>
                            <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-[var(--text-secondary)] bg-gray-50 dark:bg-gray-800/50">
                              {t('sectionLessons')}
                            </div>
                            {searchResults.lessons.map((l: any) => (
                              <button
                                key={l.id}
                                onClick={() => {
                                  router.push(`/courses/${l.course_slug || l.course_id}`);
                                  setSearchOpen(false);
                                  setSearchQuery('');
                                  setSearchResults(null);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <FileText className="w-4 h-4 text-green-500 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                                    {getLocalizedText(l.title, language)}
                                  </p>
                                  <p className="text-[10px] text-[var(--text-secondary)] truncate">
                                    {l.type} — {getLocalizedText(l.course_title, language)}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.button
                key="search-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Right — Actions */}
      <div className="flex items-center gap-1">
        {/* Notifications */}
        <NotificationDropdown />

        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Language selector */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => setLangOpen(!langOpen)}
            className={clsx(
              'flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold',
              'hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]',
            )}
            aria-label="Select language"
          >
            <Globe className="w-4 h-4" />
            <span>{currentLang.short}</span>
          </button>

          <AnimatePresence>
            {langOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className={clsx(
                  'absolute right-0 top-full mt-1 w-36 py-1 rounded-lg shadow-lg',
                  'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                )}
              >
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setLanguage(lang.code);
                      setLangOpen(false);
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm',
                      language === lang.code
                        ? 'bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-gold font-medium'
                        : 'text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}
                  >
                    <span className="text-xs font-bold w-5">{lang.short}</span>
                    {lang.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-[var(--border)] mx-1 hidden sm:block" />

        {/* User avatar + dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-1"
            aria-label="User menu"
          >
            <div
              className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                'bg-brand-navy text-white',
              )}
            >
              {initials}
            </div>
            <div className="hidden sm:block text-left leading-tight">
              <div className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[120px]">
                {user ? `${user.firstName} ${user.lastName}` : 'Utilisateur'}
              </div>
              <div className="text-[10px] text-[var(--text-secondary)] capitalize">
                {user?.role?.replace('_', ' ') || 'learner'}
              </div>
            </div>
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className={clsx(
                  'absolute right-0 top-full mt-1 w-48 py-1 rounded-lg shadow-lg',
                  'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                )}
              >
                <div className="px-3 py-2 border-b border-[var(--border)]">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {user ? `${user.firstName} ${user.lastName}` : 'Utilisateur'}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {user?.email || ''}
                  </p>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push('/profile'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800/50"
                >
                  <User className="w-4 h-4" />
                  {t('profile')}
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4" />
                  {t('logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
