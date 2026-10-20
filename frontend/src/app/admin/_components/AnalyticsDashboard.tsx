'use client';
// ============================================================================
// Topnet Solutions Academy — Analytics Dashboard (Admin)
// Engagement trends, path analytics, export reports
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Users, Award, BookOpen, Download, Route,
  Loader2, Calendar, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

// Simple inline bar chart
function MiniChart({ data, color = '#1B0CB3' }: { data: { day: string; count: number }[]; color?: string }) {
  if (!data || data.length === 0) return <div className="h-16 flex items-end text-xs text-[var(--text-secondary)]">Aucune donnée</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="h-16 flex items-end gap-px">
      {data.slice(-14).map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm transition-all hover:opacity-80"
          style={{ height: `${Math.max(2, (d.count / max) * 100)}%`, backgroundColor: color }}
          title={`${new Date(d.day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}: ${d.count}`}
        />
      ))}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [engagement, setEngagement] = useState<any>(null);
  const [pathsData, setPathsData] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      adminApi.engagement(token).catch(() => ({ data: null })),
      adminApi.pathsAnalytics(token).catch(() => ({ data: null })),
    ]).then(([engRes, pathRes]: any[]) => {
      setEngagement(engRes.data);
      setPathsData(pathRes.data);
    }).finally(() => setLoading(false));
  }, [token]);

  const handleExport = useCallback(async () => {
    if (!token) return;
    setExporting(true);
    try {
      const res: any = await adminApi.exportReport(token);
      const rows = res.data || [];
      // Generate CSV
      if (rows.length === 0) { toast.error('Aucune donnée à exporter'); return; }
      const headers = Object.keys(rows[0]);
      const csv = [
        headers.join(','),
        ...rows.map((r: any) => headers.map(h => {
          const v = r[h];
          if (typeof v === 'object') return `"${getLocalText(v)}"`;
          return typeof v === 'string' && v.includes(',') ? `"${v}"` : v;
        }).join(',')),
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Rapport exporté');
    } catch (err: any) { toast.error(err.message || 'Erreur export'); }
    finally { setExporting(false); }
  }, [token]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>;
  }

  const eng = engagement || { enrollments: [], completions: [], activeLearners: [], certifications: [] };
  const paths = pathsData || { summary: { totalPaths: 0, totalEnrollments: 0, totalCompletions: 0, completionRate: 0 }, paths: [] };

  // Calculate totals from trends
  const totalEnrollments14d = eng.enrollments.slice(-14).reduce((s: number, d: any) => s + d.count, 0);
  const totalCompletions14d = eng.completions.slice(-14).reduce((s: number, d: any) => s + d.count, 0);
  const totalActive14d = eng.activeLearners.slice(-14).reduce((s: number, d: any) => s + d.count, 0);
  const totalCerts14d = eng.certifications.slice(-14).reduce((s: number, d: any) => s + d.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
          Analytique (14 derniers jours)
        </h3>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-gray-800/30 disabled:opacity-40"
        >
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          Exporter CSV
        </button>
        <a
          href={token ? adminApi.exportExcel(token) : '#'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-gray-800/30"
          download
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </a>
      </div>

      {/* Engagement trend cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TrendCard title="Inscriptions" value={totalEnrollments14d} data={eng.enrollments} icon={Users} color="#1B0CB3" />
        <TrendCard title="Complétions" value={totalCompletions14d} data={eng.completions} icon={Award} color="#009930" />
        <TrendCard title="Apprenants actifs" value={totalActive14d} data={eng.activeLearners} icon={TrendingUp} color="#1B0CB3" />
        <TrendCard title="Certifications" value={totalCerts14d} data={eng.certifications} icon={Award} color="#1B0CB3" />
      </div>

      {/* Learning Paths Analytics */}
      <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5">
        <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
          <Route className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
          Parcours de formation
        </h4>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
            <div className="text-xl font-bold text-[var(--text-primary)]">{paths.summary.totalPaths}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">Parcours</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
            <div className="text-xl font-bold text-[var(--text-primary)]">{paths.summary.publishedPaths}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">Publiés</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
            <div className="text-xl font-bold text-[var(--text-primary)]">{paths.summary.totalEnrollments}</div>
            <div className="text-[10px] text-[var(--text-secondary)]">Inscrits</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
            <div className="text-xl font-bold text-emerald-600">{paths.summary.completionRate}%</div>
            <div className="text-[10px] text-[var(--text-secondary)]">Taux complétion</div>
          </div>
        </div>

        {/* Per-path table */}
        {paths.paths.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left py-2 px-2 font-semibold text-[var(--text-secondary)]">Parcours</th>
                  <th className="text-center py-2 px-2 font-semibold text-[var(--text-secondary)]">Cours</th>
                  <th className="text-center py-2 px-2 font-semibold text-[var(--text-secondary)]">Inscrits</th>
                  <th className="text-center py-2 px-2 font-semibold text-[var(--text-secondary)]">Complétés</th>
                  <th className="text-center py-2 px-2 font-semibold text-[var(--text-secondary)]">Progression moy.</th>
                  <th className="text-center py-2 px-2 font-semibold text-[var(--text-secondary)]">Statut</th>
                </tr>
              </thead>
              <tbody>
                {paths.paths.map((p: any) => (
                  <tr key={p.id} className="border-b border-[var(--border)]/50 hover:bg-gray-50 dark:hover:bg-gray-800/20">
                    <td className="py-2 px-2 font-medium text-[var(--text-primary)]">{getLocalText(p.title)}</td>
                    <td className="py-2 px-2 text-center">{p.course_count}</td>
                    <td className="py-2 px-2 text-center">{p.total_enrolled}</td>
                    <td className="py-2 px-2 text-center">{p.total_completed}</td>
                    <td className="py-2 px-2 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-16 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-navy dark:bg-brand-gold" style={{ width: `${p.avg_progress}%` }} />
                        </div>
                        <span>{p.avg_progress}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-[10px] font-medium',
                        p.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                      )}>
                        {p.is_published ? 'Publié' : 'Brouillon'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-[var(--text-secondary)] text-center py-4">Aucun parcours créé</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend Card
// ---------------------------------------------------------------------------

function TrendCard({
  title, value, data, icon: Icon, color,
}: {
  title: string;
  value: number;
  data: { day: string; count: number }[];
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[var(--text-secondary)]">{title}</span>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] mb-2">
        {value.toLocaleString('fr-FR')}
      </div>
      <MiniChart data={data} color={color} />
    </div>
  );
}
