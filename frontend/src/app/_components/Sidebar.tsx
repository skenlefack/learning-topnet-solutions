'use client';
// ============================================================================
// AU-IBAR Learning — Sidebar
// Navigation, certification levels, tenant selector, responsive collapsible
// ============================================================================
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  Video,
  Award,
  Users,
  ChevronDown,
  Sprout,
  BookMarked,
  Target,
  Crown,
  X,
  Lock,
  CheckCircle2,
  Unlock,
  Settings,
  FileText,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

type CertLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';
type LevelStatus = 'certified' | 'unlocked' | 'locked';

interface LevelInfo {
  key: CertLevel;
  label: string;
  icon: React.ReactNode;
  color: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const NAV_KEYS = [
  { href: '/', key: 'dashboard', icon: LayoutDashboard },
  { href: '/courses', key: 'courses', icon: BookOpen },
  { href: '/live', key: 'live', icon: Video },
  { href: '/resources', key: 'resources', icon: FileText },
  { href: '/certificates', key: 'certificates', icon: Award },
  { href: '/community', key: 'community', icon: Users },
] as const;

const TRAINER_ROLES = ['trainer', 'admin_country', 'admin_rec', 'admin_continental'];

const CERT_LEVEL_KEYS: { key: CertLevel; i18nKey: string; icon: React.ReactNode; color: string }[] = [
  { key: 'beginner', i18nKey: 'beginner', icon: <Sprout className="w-4 h-4" />, color: 'text-green-500' },
  { key: 'intermediate', i18nKey: 'intermediate', icon: <BookMarked className="w-4 h-4" />, color: 'text-blue-500' },
  { key: 'advanced', i18nKey: 'advanced', icon: <Target className="w-4 h-4" />, color: 'text-purple-500' },
  { key: 'expert', i18nKey: 'expert', icon: <Crown className="w-4 h-4" />, color: 'text-brand-gold' },
];

const ADMIN_ROLES = ['admin_country', 'admin_rec', 'admin_continental'];

// ---------------------------------------------------------------------------
// Level status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: LevelStatus }) {
  if (status === 'certified') {
    return <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold" />;
  }
  if (status === 'unlocked') {
    return <Unlock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />;
  }
  return <Lock className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isAdmin = user ? ADMIN_ROLES.includes(user.role) : false;
  const isTrainer = user ? TRAINER_ROLES.includes(user.role) : false;
  const t = useTranslations('nav');
  const tLevels = useTranslations('levels');

  // Mock level statuses — in production this comes from the API
  const levelStatuses: Record<CertLevel, LevelStatus> = {
    beginner: 'certified',
    intermediate: 'unlocked',
    advanced: 'locked',
    expert: 'locked',
  };

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <aside
        className={clsx(
          'fixed top-0 start-0 z-50 h-full w-56 flex flex-col',
          'bg-white dark:bg-surface-dark-card border-r border-[var(--border)]',
          'transition-transform duration-300 ease-in-out',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand header */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-[var(--border)]">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={onClose}>
            <Image
              src="/au-logo.png"
              alt="ARIS Academy"
              width={36}
              height={36}
              className="w-9 h-9 object-contain"
              priority
            />
            <div className="leading-none">
              <span className="font-display text-lg text-brand-navy dark:text-white tracking-tight">
                ARIS
              </span>
              <span className="block text-[9px] font-semibold tracking-[0.2em] text-brand-gold uppercase mt-0.5">
                Academy
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
          {NAV_KEYS.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive
                    ? 'bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-white border-s-[3px] border-brand-gold -ms-px'
                    : 'text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className={clsx('w-[18px] h-[18px]', isActive && 'text-brand-navy dark:text-brand-gold')} />
                {t(item.key)}
              </Link>
            );
          })}

          {/* Trainer link — visible for trainers and admins */}
          {isTrainer && (() => {
            const isActive = pathname.startsWith('/trainer');
            return (
              <Link
                href="/trainer"
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mt-2',
                  isActive
                    ? 'bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-white border-s-[3px] border-brand-gold -ms-px'
                    : 'text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-[var(--text-primary)]',
                )}
              >
                <BarChart3 className={clsx('w-[18px] h-[18px]', isActive && 'text-brand-navy dark:text-brand-gold')} />
                {t('trainer')}
              </Link>
            );
          })()}

          {/* Admin link — visible only for admin roles */}
          {isAdmin && (() => {
            const isActive = pathname.startsWith('/admin');
            return (
              <Link
                href="/admin"
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mt-2 border-t border-[var(--border)] pt-3',
                  isActive
                    ? 'bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-white border-s-[3px] border-brand-gold -ms-px'
                    : 'text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-[var(--text-primary)]',
                )}
              >
                <Settings className={clsx('w-[18px] h-[18px]', isActive && 'text-brand-navy dark:text-brand-gold')} />
                {t('admin')}
              </Link>
            );
          })()}
        </nav>

        {/* Certification levels */}
        <div className="px-3 pb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1 mb-2">
            {t('progression')}
          </div>
          <div className="space-y-0.5">
            {CERT_LEVEL_KEYS.map((level) => {
              const status = levelStatuses[level.key];
              return (
                <div
                  key={level.key}
                  className={clsx(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors',
                    status === 'certified' && 'bg-gradient-to-r from-brand-gold/10 to-brand-gold/5 text-brand-gold',
                    status === 'unlocked' && 'text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800/30',
                    status === 'locked' && 'text-gray-300 dark:text-gray-600 opacity-50',
                  )}
                >
                  <span className={clsx(
                    'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0',
                    status === 'certified' && 'bg-brand-gold/15',
                    status === 'unlocked' && 'bg-gray-100 dark:bg-gray-800/50',
                    status === 'locked' && 'bg-gray-50 dark:bg-gray-800/30',
                  )}>
                    <span className={clsx(status !== 'locked' && level.color)}>{level.icon}</span>
                  </span>
                  <span className="flex-1">{tLevels(level.i18nKey)}</span>
                  <StatusBadge status={status} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Admin tenant selector */}
        {isAdmin && (
          <div className="px-3 pb-3 border-t border-[var(--border)] pt-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)] px-1 mb-1.5">
              {t('tenant')}
            </div>
            <button
              className={clsx(
                'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium',
                'bg-gradient-to-r from-brand-navy/5 to-transparent dark:from-brand-navy/15 dark:to-transparent',
                'text-[var(--text-primary)] border border-[var(--border)]',
                'hover:from-brand-navy/10 dark:hover:from-brand-navy/25 transition-all',
              )}
            >
              <span className="truncate">
                {user?.tenantLevel === 'continental' && 'AU-IBAR (Continental)'}
                {user?.tenantLevel === 'rec' && 'ECOWAS (REC)'}
                {user?.tenantLevel === 'country' && user?.tenantId?.slice(0, 8) + '...'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)] shrink-0" />
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-3 pb-3 pt-1 border-t border-[var(--border)]">
          <div className="text-[10px] text-center text-[var(--text-secondary)]">
            AU-IBAR &copy; {new Date().getFullYear()}
          </div>
        </div>
      </aside>
    </>
  );
}
