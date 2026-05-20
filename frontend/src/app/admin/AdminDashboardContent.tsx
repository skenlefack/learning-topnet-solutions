'use client';
// ============================================================================
// AU-IBAR Learning — Admin Dashboard Content (lazy-loaded)
// Stats, recharts, CRUD tables, session planning, role-scoped
// ============================================================================
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users, BookOpen, Award, Video, TrendingUp,
  Search, Plus, Edit3, Trash2, ChevronLeft, ChevronRight,
  ToggleLeft, ToggleRight, Upload, Download,
  Calendar, ArrowUpDown, X, Check, Palette, Route, ListChecks, BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useAuth } from '@/hooks/useAuth';
import { courseApi, liveApi, adminApi, assessmentApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import {
  CourseFormModal,
  PlanSessionModal,
  UserFormModal,
  BulkUserImportModal,
  CourseAnalytics,
  CategoryManager,
  PathManager,
  QuizBuilder,
  AnalyticsDashboard,
  TenantComparison,
} from './_components/lazy';
import { ConfirmProvider, useConfirm } from './_components/ConfirmDialog';

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.06 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AdminTab = 'dashboard' | 'categories' | 'courses' | 'paths' | 'quiz' | 'users' | 'sessions' | 'analytics' | 'tenants';

const CHART_COLORS = ['#2E7D32', '#C8A951', '#7B1639', '#a855f7', '#ef4444', '#3b82f6'];

function getLocalizedText(text: Record<string, string> | string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.fr || text.en || Object.values(text)[0] || '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDashboardContent() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const t = useTranslations('admin');
  const t_roles = useTranslations('roles');

  const scopeLabel = user?.tenantLevel === 'continental' ? t('scopeContinental')
    : user?.tenantLevel === 'rec' ? t('scopeRec')
      : t('scopeCountry');

  const TABS: { key: AdminTab; label: string; icon: typeof Users }[] = [
    { key: 'dashboard', label: t('tabDashboard'), icon: TrendingUp },
    { key: 'categories', label: 'Catégories', icon: Palette },
    { key: 'courses', label: t('tabCourses'), icon: BookOpen },
    { key: 'paths', label: 'Parcours', icon: Route },
    { key: 'quiz', label: 'Quiz', icon: ListChecks },
    { key: 'users', label: t('tabUsers'), icon: Users },
    { key: 'sessions', label: t('tabSessions'), icon: Video },
    { key: 'analytics', label: 'Analytique', icon: BarChart3 },
    { key: 'tenants', label: 'Tenants', icon: Users },
  ];

  return (
    <ConfirmProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6 max-w-7xl mx-auto"
      >
        {/* Header */}
        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('scope')} : <span className="font-medium text-brand-navy dark:text-brand-gold">{scopeLabel}</span>
            </p>
          </div>
        </motion.div>

        {/* Tabs */}
        <motion.div variants={fadeUp} className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px">
          {TABS.map(tb => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === tb.key
                  ? 'border-brand-navy dark:border-brand-gold text-brand-navy dark:text-brand-gold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              <tb.icon className="w-4 h-4" />
              {tb.label}
            </button>
          ))}
        </motion.div>

        {/* Tab content */}
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'categories' && <CategoryManager />}
        {tab === 'courses' && <CoursesTab />}
        {tab === 'paths' && <PathManager />}
        {tab === 'quiz' && <QuizBuilder />}
        {tab === 'users' && <UsersTab />}
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'analytics' && <AnalyticsDashboard />}
        {tab === 'tenants' && <TenantComparison />}
      </motion.div>
    </ConfirmProvider>
  );
}

// ===========================================================================
// DASHBOARD TAB — Stats + Charts
// ===========================================================================

function DashboardTab() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminApi.stats(token)
      .then((res: any) => setStats(res.data || res))
      .catch(() => {
        // Fallback mock data for when API isn't ready
        setStats({
          totalLearners: 1247,
          totalCourses: 24,
          totalCertifications: 312,
          totalSessions: 56,
          enrollmentsByMonth: [
            { month: 'Jan', count: 45 }, { month: 'Fev', count: 62 }, { month: 'Mar', count: 78 },
            { month: 'Avr', count: 95 }, { month: 'Mai', count: 110 }, { month: 'Jun', count: 134 },
          ],
          completionByCourse: [
            { name: 'ARIS Debutant', rate: 82 }, { name: 'ARIS Intermediaire', rate: 64 },
            { name: 'ARIS Avance', rate: 45 }, { name: 'ARIS Expert', rate: 28 },
          ],
          byCountry: [
            { name: 'Nigeria', value: 234 }, { name: 'Kenya', value: 189 },
            { name: 'Senegal', value: 156 }, { name: 'Ethiopie', value: 134 },
            { name: 'Afrique du Sud', value: 112 }, { name: 'Autres', value: 422 },
          ],
        });
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] animate-pulse" />
        ))}
      </div>
    );
  }

  const statCards = [
    { label: t('learners'), value: stats.totalLearners?.toLocaleString(), icon: Users, color: 'text-brand-navy dark:text-green-400', bg: 'bg-brand-navy/5 dark:bg-green-900/20' },
    { label: t('courses'), value: stats.totalCourses, icon: BookOpen, color: 'text-brand-accent', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: t('certifications'), value: stats.totalCertifications, icon: Award, color: 'text-brand-gold', bg: 'bg-brand-gold-pale dark:bg-yellow-900/20' },
    { label: t('liveSessions'), value: stats.totalSessions, icon: Video, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {statCards.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
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
                  <div className="text-xs text-[var(--text-secondary)]">{stat.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Enrollments by month */}
        <motion.div
          variants={fadeUp}
          className={clsx('rounded-xl p-5', 'bg-white dark:bg-surface-dark-card border border-[var(--border)]')}
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('enrollmentsByMonth')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.enrollmentsByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" fill="#2E7D32" radius={[4, 4, 0, 0]} name={t('enrollmentsByMonth')} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Completion by course */}
        <motion.div
          variants={fadeUp}
          className={clsx('rounded-xl p-5', 'bg-white dark:bg-surface-dark-card border border-[var(--border)]')}
        >
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('completionByCourse')}</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={stats.completionByCourse} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} unit="%" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={120} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, t('completion')]}
              />
              <Bar dataKey="rate" fill="#C8A951" radius={[0, 4, 4, 0]} name={t('rate')} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Pie chart — by country */}
      <motion.div
        variants={fadeUp}
        className={clsx('rounded-xl p-5', 'bg-white dark:bg-surface-dark-card border border-[var(--border)]')}
      >
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">{t('distributionByCountry')}</h3>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={stats.byCountry}
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={45}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
                fontSize={10}
              >
                {stats.byCountry?.map((_: any, i: number) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </div>
  );
}

// ===========================================================================
// COURSES TAB — CRUD table
// ===========================================================================

function CoursesTab() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const t_levels = useTranslations('levels');
  const confirm = useConfirm();
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sortKey, setSortKey] = useState('title');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const limit = 10;

  // View state: 'list' | 'form' | 'analytics'
  const [view, setView] = useState<'list' | 'form' | 'analytics'>('list');
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [analyticsCourse, setAnalyticsCourse] = useState<any>(null);

  const fetchCourses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await courseApi.list(token, { page, limit, search: search || undefined, sort: `${sortKey}:${sortDir}` });
      setCourses(res.data || []);
      setTotal(res.total || res.meta?.total || 0);
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, sortKey, sortDir]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  const totalPages = Math.ceil(total / limit) || 1;

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!token) return;
    const ok = await confirm({
      title: 'Supprimer ce cours ?',
      message: `Le cours « ${title} » et tous ses modules et leçons seront définitivement supprimés.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await courseApi.delete(token, id);
      toast.success(t('courseDeleted'));
      fetchCourses();
    } catch {
      toast.error(t('deleteFailed'));
    }
  };

  // Show analytics
  if (view === 'analytics' && analyticsCourse) {
    return (
      <motion.div variants={fadeUp}>
        <CourseAnalytics
          courseId={analyticsCourse.id}
          courseTitle={getLocalizedText(analyticsCourse.title)}
          onClose={() => { setAnalyticsCourse(null); setView('list'); }}
        />
      </motion.div>
    );
  }

  // Show course form (inline)
  if (view === 'form') {
    return (
      <CourseFormModal
        onBack={() => { setView('list'); setEditingCourse(null); }}
        onSuccess={fetchCourses}
        editCourse={editingCourse}
      />
    );
  }

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder={t('searchCourse')}
            className={clsx(
              'w-full pl-9 pr-4 py-2 rounded-lg text-sm',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
              'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
              'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
            )}
          />
        </div>
        <button
          onClick={() => { setEditingCourse(null); setView('form'); }}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
            'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
          )}
        >
          <Plus className="w-4 h-4" />
          {t('newCourse')}
        </button>
      </div>

      {/* Table */}
      <div className={clsx('rounded-xl overflow-hidden border border-[var(--border)]', 'bg-white dark:bg-surface-dark-card')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-gray-50 dark:bg-gray-800/50">
                {[
                  { key: 'title', label: t('title_col') },
                  { key: 'level', label: t('level_col') },
                  { key: 'status', label: t('status_col') },
                  { key: 'created_at', label: t('createdAt_col') },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)]"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                  {t('actions_col')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={5} className="px-4 py-3">
                      <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">
                    {t('noCourses')}
                  </td>
                </tr>
              ) : (
                courses.map(course => (
                  <tr key={course.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {getLocalizedText(course.title)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        course.level === 'beginner' && 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                        course.level === 'intermediate' && 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
                        course.level === 'advanced' && 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
                        course.level === 'expert' && 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
                      )}>
                        {t_levels(course.level)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        course.status === 'published' && 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
                        course.status === 'draft' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                        course.status === 'archived' && 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
                      )}>
                        {course.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">
                      {course.created_at ? new Date(course.created_at).toLocaleDateString('fr') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setAnalyticsCourse(course); setView('analytics'); }}
                          className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500"
                          title="Analytics"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingCourse(course); setView('form'); }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(course.id, getLocalizedText(course.title))}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)]">
            {t('totalCourses', { count: total })}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-[var(--text-secondary)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-[var(--text-primary)] px-2">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-[var(--text-secondary)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ===========================================================================
// USERS TAB — list, roles, activation
// ===========================================================================

function UsersTab() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const t_roles = useTranslations('roles');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [roleFilter, setRoleFilter] = useState('');
  const limit = 15;

  // Modals
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await adminApi.users(token, { page, limit, search: search || undefined, role: roleFilter || undefined });
      setUsers(res.data || []);
      setTotal(res.total || res.meta?.total || 0);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const totalPages = Math.ceil(total / limit) || 1;

  const toggleActive = async (userId: string, currentState: boolean) => {
    if (!token) return;
    try {
      await adminApi.updateUser(token, userId, { is_active: !currentState });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentState } : u));
      toast.success(!currentState ? t('userActivated') : t('userDeactivated'));
    } catch {
      toast.error(t('updateFailed'));
    }
  };

  const ROLE_COLORS: Record<string, string> = {
    learner: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    trainer: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    admin_country: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    admin_rec: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    admin_continental: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  };

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder={t('searchUser')}
              className={clsx(
                'w-full pl-9 pr-4 py-2 rounded-lg text-sm',
                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
              )}
            />
          </div>
          <select
            value={roleFilter}
            onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
            className={clsx(
              'px-3 py-2 rounded-lg text-sm',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
              'text-[var(--text-primary)]',
              'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
            )}
          >
            <option value="">{t('allRoles')}</option>
            <option value="learner">{t_roles('learner')}</option>
            <option value="trainer">{t_roles('trainer')}</option>
            <option value="admin_country">{t_roles('admin_country')}</option>
            <option value="admin_rec">{t_roles('admin_rec')}</option>
            <option value="admin_continental">{t_roles('admin_continental')}</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBulkImportOpen(true)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border',
              'border-[var(--border)] text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
            )}
          >
            <Upload className="w-4 h-4" />
            {t('importCsv')}
          </button>
          <button
            onClick={() => { setEditingUser(null); setUserModalOpen(true); }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
              'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
            )}
          >
            <Plus className="w-4 h-4" />
            {t('newUser')}
          </button>
        </div>
      </div>

      <UserFormModal
        open={userModalOpen}
        onClose={() => { setUserModalOpen(false); setEditingUser(null); }}
        onSuccess={fetchUsers}
        editUser={editingUser}
      />

      <BulkUserImportModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSuccess={fetchUsers}
      />

      <div className={clsx('rounded-xl overflow-hidden border border-[var(--border)]', 'bg-white dark:bg-surface-dark-card')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('name_col')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('email_col')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('role_col')}</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('active_col')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('actions_col')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td></tr>
                ))
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">{t('noUsers')}</td></tr>
              ) : (
                users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-navy text-white flex items-center justify-center text-[10px] font-bold">
                          {(u.first_name?.[0] || '')}{(u.last_name?.[0] || '')}
                        </div>
                        <span className="font-medium text-[var(--text-primary)]">{u.first_name} {u.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLORS[u.role] || ROLE_COLORS.learner)}>
                        {u.role ? t_roles(u.role) : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleActive(u.id, u.is_active)}
                        className="inline-flex"
                      >
                        {u.is_active
                          ? <ToggleRight className="w-6 h-6 text-green-500" />
                          : <ToggleLeft className="w-6 h-6 text-gray-400" />
                        }
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => { setEditingUser(u); setUserModalOpen(true); }}
                        className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)]">
          <span className="text-xs text-[var(--text-secondary)]">{t('totalUsers', { count: total })}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-[var(--text-secondary)]">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-[var(--text-primary)] px-2">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 text-[var(--text-secondary)]">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ===========================================================================
// QUESTIONS TAB — import/export
// ===========================================================================

function QuestionsTab() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const [importData, setImportData] = useState<any[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [assessmentId, setAssessmentId] = useState('');
  const [exportAssessmentId, setExportAssessmentId] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      if (file.name.endsWith('.json')) {
        const data = JSON.parse(text);
        setImportData(Array.isArray(data) ? data : data.questions || []);
      } else if (file.name.endsWith('.csv')) {
        // Simple CSV parser: first line = headers, rest = data
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const questions = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim().replace(/"/g, ''));
          const obj: any = {};
          headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
          return {
            questionText: { fr: obj.question_fr || obj.question || '', en: obj.question_en || '' },
            questionType: obj.type || 'single_choice',
            options: obj.options ? JSON.parse(obj.options) : [],
            correctAnswer: obj.correct_answer || obj.correctAnswer || '',
            difficulty: parseInt(obj.difficulty) || 1,
            points: parseInt(obj.points) || 1,
            tags: obj.tags ? obj.tags.split(';') : [],
          };
        });
        setImportData(questions);
      }
      toast.success(t('fileLoaded', { name: file.name }));
    } catch {
      toast.error(t('invalidFormat'));
      setImportData(null);
    }
    e.target.value = '';
  };

  const handleImport = async () => {
    if (!token || !importData || !assessmentId) {
      toast.error(t('selectAssessmentAndFile'));
      return;
    }
    setImporting(true);
    try {
      const res: any = await assessmentApi.bulkImport(token, { assessmentId, questions: importData });
      toast.success(t('questionsImported', { count: res.data?.imported || importData.length }));
      setImportData(null);
    } catch (err: any) {
      toast.error(err.message || t('importFailed'));
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!token || !exportAssessmentId) {
      toast.error('Saisissez un ID d\'assessment');
      return;
    }
    try {
      const res: any = await assessmentApi.export_(token, exportAssessmentId);
      const data = res.data || [];
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `questions-${exportAssessmentId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('questionsExported', { count: data.length }));
    } catch (err: any) {
      toast.error(err.message || t('exportFailed'));
    }
  };

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      {/* Import section */}
      <div className={clsx(
        'rounded-xl p-5',
        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
      )}>
        <h3 className="font-semibold text-[var(--text-primary)] mb-3">{t('importQuestions')}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('assessmentId')}</label>
            <input
              type="text"
              value={assessmentId}
              onChange={e => setAssessmentId(e.target.value)}
              className={clsx(
                'w-full max-w-sm px-3 py-2 rounded-lg text-sm',
                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
              )}
              placeholder={t('assessmentIdPlaceholder')}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className={clsx(
              'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer',
              'bg-gray-50 dark:bg-gray-800 border border-dashed border-[var(--border)]',
              'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-brand-navy transition-colors',
            )}>
              <Upload className="w-4 h-4" />
              {t('chooseFile')}
              <input type="file" accept=".csv,.json" className="hidden" onChange={handleFileSelect} />
            </label>

            {importData && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                {t('questionsLoaded', { count: importData.length })}
              </span>
            )}
          </div>

          {/* Preview */}
          {importData && importData.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--text-secondary)]">{t('preview')}</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                {importData.slice(0, 10).map((q: any, i: number) => (
                  <div key={i} className="px-3 py-2 text-xs">
                    <span className="font-medium text-[var(--text-primary)]">
                      {i + 1}. {q.questionText?.fr || q.question_text?.fr || JSON.stringify(q.questionText).slice(0, 80)}
                    </span>
                    <span className="ml-2 text-[var(--text-secondary)]">
                      ({q.questionType || 'single_choice'}, {q.difficulty || 1} pts)
                    </span>
                  </div>
                ))}
                {importData.length > 10 && (
                  <div className="px-3 py-2 text-xs text-[var(--text-secondary)]">
                    {t('andMore', { count: importData.length - 10 })}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  disabled={importing || !assessmentId}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
                    'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
                    'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                    'disabled:opacity-40 disabled:cursor-not-allowed',
                  )}
                >
                  <Check className="w-4 h-4" />
                  {importing ? t('importing') : t('importBtn', { count: importData.length })}
                </button>
                <button
                  onClick={() => setImportData(null)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Export section */}
      <div className={clsx(
        'rounded-xl p-5',
        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
      )}>
        <h3 className="font-semibold text-[var(--text-primary)] mb-3">{t('exportQuestions')}</h3>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('assessmentId')}</label>
            <input
              type="text"
              value={exportAssessmentId}
              onChange={e => setExportAssessmentId(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
              )}
              placeholder={t('exportAssessmentPlaceholder')}
            />
          </div>
          <button
            onClick={handleExport}
            disabled={!exportAssessmentId}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border',
              'border-[var(--border)] text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            <Download className="w-4 h-4" />
            {t('exportJson')}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ===========================================================================
// SESSIONS TAB — live session planning
// ===========================================================================

function SessionsTab() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const confirm = useConfirm();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const fetchSessions = useCallback(() => {
    if (!token) return;
    setLoading(true);
    liveApi.sessions(token)
      .then((res: any) => setSessions(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleCancel = async (id: string) => {
    if (!token) return;
    const ok = await confirm({
      title: 'Annuler cette session ?',
      message: 'La session sera marquée comme annulée et les participants seront notifiés.',
      confirmLabel: 'Annuler la session',
      variant: 'warning',
    });
    if (!ok) return;
    try {
      await liveApi.cancel(token, id);
      setSessions(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s));
      toast.success(t('sessionCancelled'));
    } catch {
      toast.error(t('cancelFailed'));
    }
  };

  return (
    <motion.div variants={fadeUp} className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setPlanModalOpen(true)}
          className={clsx(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
            'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
          )}
        >
          <Plus className="w-4 h-4" />
          {t('planSession')}
        </button>
      </div>

      <PlanSessionModal
        open={planModalOpen}
        onClose={() => setPlanModalOpen(false)}
        onSuccess={fetchSessions}
      />

      <div className={clsx('rounded-xl overflow-hidden border border-[var(--border)]', 'bg-white dark:bg-surface-dark-card')}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-gray-50 dark:bg-gray-800/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('session_col')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('trainer_col')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('date_col')}</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('status_col')}</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[var(--text-secondary)] uppercase">{t('actions_col')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" /></td></tr>
                ))
              ) : sessions.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-secondary)]">{t('noSessions')}</td></tr>
              ) : (
                sessions.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                      {getLocalizedText(s.title)}
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {s.trainer_first_name} {s.trainer_last_name}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString('fr') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                        s.status === 'live' && 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
                        s.status === 'scheduled' && 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
                        s.status === 'ended' && 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
                        s.status === 'cancelled' && 'bg-red-50 text-red-400 dark:bg-red-900/10',
                      )}>
                        {s.status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]" title="Modifier">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {s.status === 'scheduled' && (
                          <button
                            onClick={() => handleCancel(s.id)}
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                            title="Annuler"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
