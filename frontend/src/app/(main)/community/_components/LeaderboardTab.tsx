'use client';
// ============================================================================
// AU-IBAR Learning — LeaderboardTab
// Ranking table from /dashboard/leaderboard endpoint
// ============================================================================
import { useState, useEffect } from 'react';
import { Trophy, Medal, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { learningApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

export default function LeaderboardTab() {
  const { token, user } = useAuth();
  const { language } = useAuthStore();
  const t = useTranslations('leaderboardTab');
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    learningApi.leaderboard(token, { period, limit: 50 })
      .then((res: any) => setEntries(res.data || []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [token, period]);

  const PERIODS = [
    { value: 'all', label: t('all') },
    { value: 'monthly', label: t('monthly') },
    { value: 'weekly', label: t('weekly') },
  ];

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-[var(--text-secondary)]">{rank}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex gap-1">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              period === p.value
                ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className={clsx(
        'rounded-xl overflow-hidden border border-[var(--border)]',
        'bg-white dark:bg-surface-dark-card',
      )}>
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-[var(--text-secondary)] opacity-40" />
            </div>
            <p className="font-semibold text-[var(--text-primary)]">{t('noData')}</p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">{t('noDataDesc')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase w-16">{t('rank')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('learner')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('score')}</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('coursesCompleted')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {entries.map((entry, idx) => {
                  const rank = entry.rank || idx + 1;
                  const isCurrentUser = entry.user_id === user?.id;
                  return (
                    <tr
                      key={entry.user_id || idx}
                      className={clsx(
                        'transition-colors',
                        isCurrentUser
                          ? 'bg-brand-navy/5 dark:bg-brand-gold/5'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/30',
                      )}
                    >
                      <td className="px-4 py-3 text-center">{getRankIcon(rank)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0',
                            rank <= 3
                              ? 'bg-brand-gold text-gray-900'
                              : 'bg-brand-navy text-white',
                          )}>
                            {(entry.first_name?.[0] || '')}{(entry.last_name?.[0] || '')}
                          </div>
                          <div>
                            <span className={clsx(
                              'font-medium',
                              isCurrentUser ? 'text-brand-navy dark:text-brand-gold' : 'text-[var(--text-primary)]',
                            )}>
                              {entry.first_name} {entry.last_name}
                              {isCurrentUser && <span className="text-[10px] ml-1">{t('you')}</span>}
                            </span>
                            {entry.country && (
                              <span className="block text-[10px] text-[var(--text-secondary)]">{entry.country}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-bold text-[var(--text-primary)]">
                          {(entry.score || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[var(--text-secondary)]">
                        {entry.courses_completed || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
