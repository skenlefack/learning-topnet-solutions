'use client';
// ============================================================================
// Topnet Solutions Academy — Stats Grid
// 4 stat cards with count-up animation on mount
// ============================================================================
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Users, Award, Globe } from 'lucide-react';
import clsx from 'clsx';

interface StatsGridProps {
  enrollments: any[];
  courses: any[];
  certifications: any[];
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Count-up hook
// ---------------------------------------------------------------------------

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    if (counted.current || target === 0) {
      setValue(target);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setValue(Math.round(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatsGrid({ enrollments, courses, certifications, isLoading }: StatsGridProps) {
  const activeEnrollments = enrollments.filter((e: any) => e.status === 'active').length;
  const totalCourses = courses.length;
  const issuedCerts = certifications.filter((c: any) => c.status === 'issued').length;
  // Unique countries from enrollments
  const countries = new Set(enrollments.map((e: any) => e.countryCode ?? e.country).filter(Boolean)).size;

  const stats = [
    {
      label: 'Cours inscrits',
      value: activeEnrollments,
      icon: BookOpen,
      color: 'text-brand-navy dark:text-green-400',
      bg: 'bg-brand-navy/5 dark:bg-green-900/20',
    },
    {
      label: 'Cours disponibles',
      value: totalCourses,
      icon: Users,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      label: 'Certifications',
      value: issuedCerts,
      icon: Award,
      color: 'text-brand-gold',
      bg: 'bg-brand-gold-pale dark:bg-yellow-900/20',
    },
    {
      label: 'Pays connectés',
      value: countries || 1,
      icon: Globe,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 bg-white dark:bg-surface-dark-card border border-[var(--border)] animate-pulse"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="space-y-1.5">
                <div className="h-5 w-8 rounded bg-gray-100 dark:bg-gray-800" />
                <div className="h-3 w-16 rounded bg-gray-50 dark:bg-gray-800/50" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
      {stats.map((stat) => (
        <StatCard key={stat.label} {...stat} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  bg: string;
}) {
  const { value: display, ref } = useCountUp(value);

  return (
    <div
      ref={ref}
      className={clsx(
        'card-hover rounded-xl p-4',
        'bg-white dark:bg-surface-dark-card',
        'border border-[var(--border)]',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', bg)}>
          <Icon className={clsx('w-5 h-5', color)} />
        </div>
        <div>
          <div className={clsx('text-xl font-bold text-[var(--text-primary)]')}>{display}</div>
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}
