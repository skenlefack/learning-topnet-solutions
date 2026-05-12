'use client';
// ============================================================================
// AU-IBAR Learning — Live Sessions Page
// Lists: live sessions (pulsing), upcoming (week calendar), recordings (grid)
// Filters: by course, by trainer
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Video, Calendar, Play, Clock, Users, Filter,
  ChevronLeft, ChevronRight, Radio,
} from 'lucide-react';
import clsx from 'clsx';
import { format, startOfWeek, addDays, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/hooks/useAuth';
import { liveApi } from '@/lib/api';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Session {
  id: string;
  title: Record<string, string>;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scheduled_at: string;
  duration_minutes: number;
  max_participants: number;
  trainer_first_name: string;
  trainer_last_name: string;
  course_title?: Record<string, string>;
  course_id?: string;
  current_attendees?: number;
  registered_count?: number;
  recording_url?: string;
  recording_duration_seconds?: number;
}

type Tab = 'live' | 'upcoming' | 'recordings';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalizedText(text: Record<string, string> | string | undefined, lang = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60 > 0 ? `${m % 60}` : ''}`;
}

// ---------------------------------------------------------------------------
// Mock data fallback
// ---------------------------------------------------------------------------

const MOCK_SESSIONS: Session[] = [
  {
    id: 'mock-live-1',
    title: { fr: 'Formation en ligne \u2014 Module Surveillance', en: 'Online Training \u2014 Surveillance Module' },
    status: 'scheduled',
    scheduled_at: new Date(Date.now() + 86400000).toISOString(),
    duration_minutes: 90,
    max_participants: 50,
    trainer_first_name: 'Dr. Amina',
    trainer_last_name: 'Diallo',
    course_id: 'course-1',
    course_title: { fr: 'Fondamentaux', en: 'Fundamentals' },
  },
  {
    id: 'mock-live-2',
    title: { fr: 'Atelier pratique — Saisie de données', en: 'Practical Workshop — Data Entry' },
    status: 'scheduled',
    scheduled_at: new Date(Date.now() + 172800000).toISOString(),
    duration_minutes: 60,
    max_participants: 30,
    trainer_first_name: 'Jean',
    trainer_last_name: 'Mbeki',
    course_id: 'course-2',
    course_title: { fr: 'Collecte de données terrain', en: 'Field Data Collection' },
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LivePage() {
  const t = useTranslations('live');
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [upcoming, setUpcoming] = useState<Session[]>([]);
  const [recordings, setRecordings] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterCourse, setFilterCourse] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');

  // Fetch data
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      liveApi.sessions(token).catch(() => ({ data: [] })),
      liveApi.upcoming(token).catch(() => ({ data: [] })),
      liveApi.recordings(token, { limit: 50 }).catch(() => ({ data: [] })),
    ]).then(([sessRes, upRes, recRes]: any[]) => {
      const liveSessions = (sessRes.data || []).filter((s: Session) => s.status === 'live');
      setSessions(liveSessions);
      setUpcoming(upRes.data || []);
      setRecordings(recRes.data || []);
      // If there are live sessions, default to live tab
      if (liveSessions.length > 0) setTab('live');
    }).finally(() => setLoading(false));
  }, [token]);

  // Unique courses & trainers for filters
  const allSessions = useMemo(() => [...sessions, ...upcoming, ...recordings], [sessions, upcoming, recordings]);
  const courses = useMemo(() => {
    const map = new Map<string, string>();
    allSessions.forEach(s => {
      if (s.course_id && s.course_title) {
        map.set(s.course_id, getLocalizedText(s.course_title));
      }
    });
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [allSessions]);

  const trainers = useMemo(() => {
    const set = new Map<string, string>();
    allSessions.forEach(s => {
      const name = `${s.trainer_first_name} ${s.trainer_last_name}`;
      set.set(name, name);
    });
    return Array.from(set.values());
  }, [allSessions]);

  // Apply filters
  function filterSessions(list: Session[]): Session[] {
    return list.filter(s => {
      if (filterCourse && s.course_id !== filterCourse) return false;
      if (filterTrainer) {
        const name = `${s.trainer_first_name} ${s.trainer_last_name}`;
        if (name !== filterTrainer) return false;
      }
      return true;
    });
  }

  // Week calendar data
  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const filteredUpcoming = filterSessions(upcoming);
  const filteredRecordings = filterSessions(recordings);
  const filteredLive = filterSessions(sessions);

  const TABS: { key: Tab; label: string; icon: typeof Video; count: number }[] = [
    { key: 'live', label: t('liveTab'), icon: Radio, count: filteredLive.length },
    { key: 'upcoming', label: t('upcomingTab'), icon: Calendar, count: filteredUpcoming.length },
    { key: 'recordings', label: t('recordingsTab'), icon: Play, count: filteredRecordings.length },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
          <p className="text-sm text-[var(--text-secondary)]">{t('subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <select
              value={filterCourse}
              onChange={e => setFilterCourse(e.target.value)}
              className={clsx(
                'pl-8 pr-3 py-1.5 rounded-lg text-xs',
                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                'text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
              )}
            >
              <option value="">{t('allCourses')}</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <select
            value={filterTrainer}
            onChange={e => setFilterTrainer(e.target.value)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
              'text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
            )}
          >
            <option value="">{t('allTrainers')}</option>
            {trainers.map(tr => <option key={tr} value={tr}>{tr}</option>)}
          </select>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp} className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === tb.key
                ? 'border-brand-navy dark:border-brand-gold text-brand-navy dark:text-brand-gold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            <tb.icon className="w-4 h-4" />
            {tb.label}
            {tb.count > 0 && (
              <span className={clsx(
                'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                tb.key === 'live' ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)]',
              )}>
                {tb.count}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-4 animate-pulse">
              <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
              <div className="h-3 w-1/2 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
              <div className="h-3 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* ====== LIVE TAB ====== */}
          {tab === 'live' && (
            <motion.div variants={fadeUp}>
              {filteredLive.length === 0 ? (
                <div className="text-center py-16">
                  <Radio className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3 opacity-40" />
                  <p className="font-medium text-[var(--text-secondary)]">{t('noLive')}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{t('noLiveDesc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLive.map(session => (
                    <Link key={session.id} href={`/live/${session.id}`}>
                      <div className={clsx(
                        'card-hover rounded-xl overflow-hidden',
                        'bg-white dark:bg-surface-dark-card',
                        'border-2 border-red-500/30',
                        'relative',
                      )}>
                        {/* Live badge */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-bold z-10">
                          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                          {t('liveBadge')}
                        </div>
                        <div className="h-28 bg-gradient-to-br from-red-500/10 to-brand-navy/10 dark:from-red-900/20 dark:to-brand-navy/20 flex items-center justify-center">
                          <Video className="w-10 h-10 text-red-500/50" />
                        </div>
                        <div className="p-4 space-y-2">
                          <h3 className="font-semibold text-[var(--text-primary)] line-clamp-1">
                            {getLocalizedText(session.title)}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {session.trainer_first_name} {session.trainer_last_name}
                          </p>
                          {session.course_title && (
                            <p className="text-xs text-brand-navy dark:text-brand-gold">
                              {getLocalizedText(session.course_title)}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-[var(--text-secondary)] pt-1">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {session.current_attendees || 0} / {session.max_participants}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {session.duration_minutes} min
                            </span>
                          </div>
                          <button className="mt-2 w-full py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition-colors">
                            {t('join')}
                          </button>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ====== UPCOMING TAB — Week Calendar ====== */}
          {tab === 'upcoming' && (
            <motion.div variants={fadeUp} className="space-y-4">
              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setWeekOffset(w => w - 1)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {format(weekDays[0], 'd MMM', { locale: fr })} — {format(weekDays[6], 'd MMM yyyy', { locale: fr })}
                </span>
                <button
                  onClick={() => setWeekOffset(w => w + 1)}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Week grid — hidden on mobile, shown as list instead */}
              <div className="hidden md:grid grid-cols-7 gap-2">
                {weekDays.map(day => {
                  const isToday = isSameDay(day, new Date());
                  const daySessions = filteredUpcoming.filter(s =>
                    isSameDay(parseISO(s.scheduled_at), day)
                  );
                  return (
                    <div key={day.toISOString()} className="min-h-[120px]">
                      <div className={clsx(
                        'text-center text-xs font-semibold py-1.5 rounded-t-lg',
                        isToday
                          ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                          : 'bg-gray-50 dark:bg-gray-800/50 text-[var(--text-secondary)]',
                      )}>
                        <div>{format(day, 'EEE', { locale: fr })}</div>
                        <div className="text-lg font-bold">{format(day, 'd')}</div>
                      </div>
                      <div className={clsx(
                        'border border-t-0 border-[var(--border)] rounded-b-lg p-1.5 space-y-1',
                        'bg-white dark:bg-surface-dark-card min-h-[80px]',
                      )}>
                        {daySessions.map(s => (
                          <Link key={s.id} href={`/live/${s.id}`}>
                            <div className={clsx(
                              'p-1.5 rounded text-[10px] leading-tight cursor-pointer',
                              'bg-brand-navy/5 dark:bg-brand-navy/20 hover:bg-brand-navy/10 dark:hover:bg-brand-navy/30',
                              'border-l-2 border-brand-navy dark:border-brand-gold',
                            )}>
                              <div className="font-semibold text-[var(--text-primary)] truncate">
                                {getLocalizedText(s.title)}
                              </div>
                              <div className="text-[var(--text-secondary)]">
                                {format(parseISO(s.scheduled_at), 'HH:mm')} &middot; {s.duration_minutes}min
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* List view (always on mobile, below calendar on desktop) */}
              {filteredUpcoming.length > 0 ? (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] md:mt-2">{t('allUpcoming')}</h3>
                  {filteredUpcoming.map(s => (
                    <Link key={s.id} href={`/live/${s.id}`}>
                      <div className={clsx(
                        'card-hover flex items-center gap-4 p-4 rounded-xl',
                        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                      )}>
                        <div className={clsx(
                          'w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0',
                          'bg-brand-navy/5 dark:bg-brand-navy/20',
                        )}>
                          <span className="text-[10px] font-bold text-brand-navy dark:text-brand-gold uppercase">
                            {format(parseISO(s.scheduled_at), 'MMM', { locale: fr })}
                          </span>
                          <span className="text-lg font-bold text-brand-navy dark:text-brand-gold leading-none">
                            {format(parseISO(s.scheduled_at), 'd')}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-[var(--text-primary)] truncate">
                            {getLocalizedText(s.title)}
                          </h4>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {s.trainer_first_name} {s.trainer_last_name}
                            {s.course_title && ` · ${getLocalizedText(s.course_title)}`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-[var(--text-primary)]">
                            {format(parseISO(s.scheduled_at), 'HH:mm')}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">{s.duration_minutes} min</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <Calendar className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3 opacity-40" />
                  <p className="font-medium text-[var(--text-secondary)]">{t('noUpcoming')}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{t('noUpcomingDesc')}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* ====== RECORDINGS TAB — Grid ====== */}
          {tab === 'recordings' && (
            <motion.div variants={fadeUp}>
              {filteredRecordings.length === 0 ? (
                <div className="text-center py-16">
                  <Play className="w-12 h-12 mx-auto text-[var(--text-secondary)] mb-3 opacity-40" />
                  <p className="font-medium text-[var(--text-secondary)]">{t('noRecordings')}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{t('noRecordingsDesc')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredRecordings.map(rec => (
                    <div
                      key={rec.id}
                      className={clsx(
                        'card-hover rounded-xl overflow-hidden',
                        'bg-white dark:bg-surface-dark-card',
                        'border border-[var(--border)]',
                      )}
                    >
                      <div className="h-32 bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 dark:from-brand-navy/20 dark:to-brand-gold/10 flex items-center justify-center relative">
                        <Play className="w-10 h-10 text-brand-navy/30 dark:text-brand-gold/30" />
                        {rec.recording_duration_seconds && (
                          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                            {formatDuration(rec.recording_duration_seconds)}
                          </span>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <h3 className="font-semibold text-sm text-[var(--text-primary)] line-clamp-2">
                          {getLocalizedText(rec.title)}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {rec.trainer_first_name} {rec.trainer_last_name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(parseISO(rec.scheduled_at), 'd MMM yyyy', { locale: fr })}
                        </div>
                        <Link href={`/live/${rec.id}`}>
                          <button className="mt-2 w-full py-2 bg-brand-navy hover:bg-brand-navy-deep text-white text-sm font-medium rounded-lg transition-colors dark:bg-brand-gold dark:hover:bg-brand-gold-dark dark:text-gray-900">
                            {t('watchReplay')}
                          </button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
