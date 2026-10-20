'use client';
// ============================================================================
// Topnet Solutions Academy — Tenant Comparison (Admin Continental)
// Side-by-side metrics comparison across countries/RECs
// ============================================================================
import { useState, useEffect } from 'react';
import { Loader2, Globe, Users, BookOpen, Award, TrendingUp, Video } from 'lucide-react';
import clsx from 'clsx';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

const LEVEL_COLORS: Record<string, string> = {
  continental: 'bg-brand-gold/20 text-brand-gold',
  rec: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  country: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export default function TenantComparison() {
  const { token } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<string>('user_count');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!token) return;
    adminApi.tenantsCompare(token)
      .then((res: any) => setTenants(res.data || []))
      .catch(() => setTenants([]))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const sorted = [...tenants].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return sortDir === 'desc' ? vb - va : va - vb;
  });

  // Totals
  const totals = tenants.reduce((acc, t) => ({
    users: acc.users + t.user_count,
    enrollments: acc.enrollments + t.enrollment_count,
    completed: acc.completed + t.completed_count,
    certs: acc.certs + t.cert_count,
  }), { users: 0, enrollments: 0, completed: 0, certs: 0 });

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>;
  }

  const columns = [
    { key: 'user_count', label: 'Utilisateurs', icon: Users },
    { key: 'enrollment_count', label: 'Inscriptions', icon: BookOpen },
    { key: 'completed_count', label: 'Complétés', icon: Award },
    { key: 'avg_progress', label: 'Progression', icon: TrendingUp },
    { key: 'cert_count', label: 'Certificats', icon: Award },
    { key: 'completion_rate', label: 'Taux complétion', icon: TrendingUp },
  ];

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
        <Globe className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
        Comparaison des tenants
      </h3>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">{tenants.length}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Tenants</div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">{totals.users}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Utilisateurs</div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] text-center">
          <div className="text-xl font-bold text-[var(--text-primary)]">{totals.enrollments}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Inscriptions</div>
        </div>
        <div className="p-3 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] text-center">
          <div className="text-xl font-bold text-emerald-600">{totals.certs}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">Certificats</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-3 px-3 font-semibold text-[var(--text-secondary)]">Tenant</th>
              <th className="text-center py-3 px-2 font-semibold text-[var(--text-secondary)]">Niveau</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className="text-center py-3 px-2 font-semibold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] transition-colors"
                >
                  <span className="flex items-center justify-center gap-1">
                    {col.label}
                    {sortKey === col.key && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => {
              const maxEnrollments = Math.max(...tenants.map((x: any) => x.enrollment_count), 1);
              const barWidth = (t.enrollment_count / maxEnrollments) * 100;

              return (
                <tr key={t.id} className={clsx('border-b border-[var(--border)]/50', i % 2 === 0 ? '' : 'bg-gray-50/50 dark:bg-gray-800/10')}>
                  <td className="py-2.5 px-3 font-medium text-[var(--text-primary)]">
                    {getLocalText(t.name)}
                    <span className="text-[10px] text-[var(--text-secondary)] ml-1">({t.code})</span>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <span className={clsx('px-1.5 py-0.5 rounded text-[10px] font-medium', LEVEL_COLORS[t.level] || 'bg-gray-100')}>
                      {t.level}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center font-medium">{t.user_count}</td>
                  <td className="py-2.5 px-2 text-center">
                    <div className="flex items-center gap-1.5 justify-center">
                      <div className="w-12 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-brand-navy dark:bg-brand-gold" style={{ width: `${barWidth}%` }} />
                      </div>
                      <span>{t.enrollment_count}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center">{t.completed_count}</td>
                  <td className="py-2.5 px-2 text-center">{t.avg_progress}%</td>
                  <td className="py-2.5 px-2 text-center">{t.cert_count}</td>
                  <td className="py-2.5 px-2 text-center">
                    <span className={clsx('font-medium', t.completion_rate >= 50 ? 'text-emerald-600' : t.completion_rate >= 25 ? 'text-amber-600' : 'text-red-500')}>
                      {t.completion_rate}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
