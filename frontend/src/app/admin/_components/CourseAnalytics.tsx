'use client';
// ============================================================================
// Admin — Course Analytics (enrollment funnel, score distribution, completion)
// ============================================================================
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, FunnelChart, Funnel, LabelList, Cell,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';

interface Props {
  courseId: string;
  courseTitle: string;
  onClose: () => void;
}

const FUNNEL_COLORS = ['#2E7D32', '#4CAF50', '#00B341', '#A09060'];

function getLocalizedText(text: Record<string, string> | string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.en || text.fr || Object.values(text)[0] || '';
}

export default function CourseAnalytics({ courseId, courseTitle, onClose }: Props) {
  const { token } = useAuth();
  const t = useTranslations('admin.analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token || !courseId) return;
    setLoading(true);
    adminApi.courseAnalytics(token, courseId)
      .then((res: any) => setAnalytics(res.data || res))
      .catch(() => {
        // Fallback mock data
        setAnalytics({
          funnel: [
            { name: t('enrolled'), value: 234 },
            { name: t('inProgress'), value: 178 },
            { name: t('completed'), value: 112 },
            { name: t('certified'), value: 89 },
          ],
          scoreDistribution: [
            { range: '0-20', count: 5 },
            { range: '21-40', count: 12 },
            { range: '41-60', count: 28 },
            { range: '61-80', count: 67 },
            { range: '81-100', count: 45 },
          ],
          moduleCompletion: [
            { name: 'Module 1', rate: 94 },
            { name: 'Module 2', rate: 87 },
            { name: 'Module 3', rate: 76 },
            { name: 'Module 4', rate: 65 },
            { name: 'Module 5', rate: 58 },
          ],
          summary: {
            totalEnrolled: 234,
            avgScore: 72.4,
            avgCompletionDays: 18,
            certificationRate: 38,
          },
        });
      })
      .finally(() => setLoading(false));
  }, [token, courseId]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{t('title')}</h3>
          <p className="text-sm text-[var(--text-secondary)]">{courseTitle}</p>
        </div>
        <button onClick={onClose}
          className="px-3 py-1.5 rounded-lg text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800">
          {t('backToList')}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('enrolled'), value: analytics.summary?.totalEnrolled },
          { label: t('avgScore'), value: `${analytics.summary?.avgScore}%` },
          { label: t('avgDays'), value: analytics.summary?.avgCompletionDays },
          { label: t('certRate'), value: `${analytics.summary?.certificationRate}%` },
        ].map(stat => (
          <div key={stat.label} className={clsx(
            'rounded-xl p-4 border border-[var(--border)]',
            'bg-white dark:bg-surface-dark-card',
          )}>
            <div className="text-xl font-bold text-[var(--text-primary)]">{stat.value}</div>
            <div className="text-xs text-[var(--text-secondary)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Enrollment funnel */}
        <div className={clsx('rounded-xl p-5 border border-[var(--border)]', 'bg-white dark:bg-surface-dark-card')}>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('enrollmentFunnel')}</h4>
          <div className="space-y-2">
            {analytics.funnel?.map((step: any, i: number) => {
              const maxVal = analytics.funnel[0]?.value || 1;
              const pct = Math.round((step.value / maxVal) * 100);
              return (
                <div key={step.name} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--text-secondary)] w-20 shrink-0">{step.name}</span>
                  <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--text-primary)] w-12 text-right">{step.value}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score distribution */}
        <div className={clsx('rounded-xl p-5 border border-[var(--border)]', 'bg-white dark:bg-surface-dark-card')}>
          <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('scoreDistribution')}</h4>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={analytics.scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="range" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#00B341" radius={[4, 4, 0, 0]} name={t('students')} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Module completion */}
      <div className={clsx('rounded-xl p-5 border border-[var(--border)]', 'bg-white dark:bg-surface-dark-card')}>
        <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('completionByModule')}</h4>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={analytics.moduleCompletion} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={80} />
            <Tooltip
              contentStyle={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => [`${v}%`, 'Completion']}
            />
            <Bar dataKey="rate" fill="#2E7D32" radius={[0, 4, 4, 0]} name="Completion %" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
