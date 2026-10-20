'use client';
// ============================================================================
// Topnet Solutions Academy — Dashboard Shell
// Layout wrapper: Sidebar + Header + main content slot
// Animated entrance with framer-motion fade-up stagger
// ============================================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  Award,
  TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import Sidebar from './Sidebar';
import Header from './Header';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Stat cards data (mock — will come from API)
// ---------------------------------------------------------------------------

const STATS_KEYS = [
  { key: 'enrolledCourses', value: '6', icon: BookOpen, color: 'text-brand-navy dark:text-green-400', bg: 'bg-brand-navy/5 dark:bg-green-900/20' },
  { key: 'learningHours', value: '42h', icon: Clock, color: 'text-brand-maroon', bg: 'bg-brand-maroon-light dark:bg-pink-900/20' },
  { key: 'certifications', value: '1', icon: Award, color: 'text-brand-gold', bg: 'bg-brand-gold-pale dark:bg-yellow-900/20' },
  { key: 'progression', value: '68%', icon: TrendingUp, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardShell({ children }: { children?: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] transition-colors">
      <div className="flex">
        {/* Sidebar */}
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main area */}
        <div className="flex-1 flex flex-col min-h-screen lg:ml-0">
          <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />

          <main className="flex-1 p-4 lg:p-6">
            {children ?? <DashboardHome />}
          </main>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default dashboard content (when no children are passed)
// ---------------------------------------------------------------------------

function DashboardHome() {
  const t = useTranslations('dashboard');
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Welcome banner */}
      <motion.div
        variants={fadeUp}
        className={clsx(
          'relative overflow-hidden rounded-2xl px-6 py-8 lg:px-8 lg:py-10',
          'bg-gradient-to-br from-gray-50 to-white dark:from-surface-dark-card dark:to-surface-dark-card',
          'border border-[var(--border)]',
        )}
      >
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-primary)] mb-2">
            {t('welcome')} <span className="font-display text-brand-navy dark:text-brand-gold">{t('brandName')}</span>
          </h1>
          <p className="text-[var(--text-secondary)] max-w-lg text-sm lg:text-base">
            {t('subtitle')}
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-brand-navy/[0.03] dark:bg-brand-gold/[0.05] animate-float" />
        <div className="absolute -right-4 -bottom-8 w-28 h-28 rounded-full bg-brand-gold/[0.04]" />
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {STATS_KEYS.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.key}
              className={clsx(
                'card-hover rounded-xl p-4',
                'bg-white dark:bg-surface-dark-card',
                'border border-[var(--border)]',
              )}
            >
              <div className="flex items-center gap-3">
                <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', stat.bg)}>
                  <Icon className={clsx('w-5 h-5', stat.color)} />
                </div>
                <div>
                  <div className="text-xl font-bold text-[var(--text-primary)]">{stat.value}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{t(stat.key)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Placeholder for course cards, progress, etc. */}
      <motion.div variants={fadeUp}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
          {t('continueLearning')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={clsx(
                'card-hover rounded-xl overflow-hidden',
                'bg-white dark:bg-surface-dark-card',
                'border border-[var(--border)]',
              )}
            >
              <div className="h-32 bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 dark:from-brand-navy/20 dark:to-brand-gold/10" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-1/2 rounded bg-gray-50 dark:bg-gray-800/50" />
                <div className="flex items-center gap-2 pt-2">
                  <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand-navy dark:bg-brand-gold"
                      style={{ width: `${20 + i * 25}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--text-secondary)]">{20 + i * 25}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
