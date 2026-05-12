'use client';
// ============================================================================
// AU-IBAR Learning — Resources Page
// Full-page layout: hero header, search/filters, resource grid
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Video, Download, Search, Music,
  File, Loader2, BookOpen, ExternalLink, FolderOpen,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { resourceApi } from '@/lib/api';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

const TYPE_ICONS: Record<string, typeof FileText> = {
  video: Video,
  text: FileText,
  quiz: FileText,
  practical: File,
  replay: Video,
};

const MIME_LABELS: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'text/html': 'HTML',
  'audio/mpeg': 'MP3',
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

export default function ResourcesPage() {
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const t = useTranslations('resourcesPage');
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'document'>('all');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    resourceApi.list(token, { type: typeFilter === 'all' ? undefined : typeFilter, limit: 100 })
      .then((res: any) => setResources(res.data || []))
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [token, typeFilter]);

  const filtered = useMemo(() => {
    if (!search) return resources;
    const q = search.toLowerCase();
    return resources.filter(r =>
      getLocalText(r.title, language).toLowerCase().includes(q) ||
      getLocalText(r.course_title, language).toLowerCase().includes(q) ||
      (r.document_name || '').toLowerCase().includes(q)
    );
  }, [resources, search, language]);

  const FILTER_TABS = [
    { key: 'all' as const, label: t('all') },
    { key: 'video' as const, label: t('videos') },
    { key: 'document' as const, label: t('documents') },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="space-y-0 max-w-7xl mx-auto -mt-4 lg:-mt-6"
    >
      {/* ── Hero header with embedded search ── */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy via-brand-navy to-brand-navy-deep px-6 py-8 lg:px-8 lg:py-10"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-brand-gold/[0.06]" />
          <div className="absolute -left-8 bottom-0 w-48 h-48 rounded-full bg-white/[0.03]" />
        </div>

        <div className="relative z-10 space-y-5">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-white">{t('title')}</h1>
            <p className="text-sm text-green-100/70 mt-1">{t('subtitle')}</p>
          </div>

          {/* Search bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold/40 transition-all"
              />
            </div>
            <div className="flex gap-1.5">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => { setTypeFilter(tab.key); setLoading(true); }}
                  className={clsx(
                    'px-4 py-3 rounded-xl text-sm font-medium transition-all',
                    typeFilter === tab.key
                      ? 'bg-brand-gold text-gray-900'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Results ── */}
      <motion.div variants={fadeUp} className="pt-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-brand-navy dark:text-brand-gold" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-[var(--text-secondary)] opacity-40" />
            </div>
            <p className="font-semibold text-[var(--text-primary)]">
              {search ? t('noResults', { query: search }) : t('noResources')}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              {!search && t('noResourcesDesc')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(r => {
              const Icon = TYPE_ICONS[r.lesson_type] || FileText;
              const isVideo = !!r.video_url;
              const fileUrl = isVideo ? r.video_url : r.document_url;
              const fileName = r.document_name || getLocalText(r.title, language);
              const fileType = r.document_type
                ? (MIME_LABELS[r.document_type] || r.document_type.split('/')[1])
                : (isVideo ? 'Video' : 'File');

              return (
                <div
                  key={r.id}
                  className={clsx(
                    'group rounded-xl overflow-hidden',
                    'bg-white dark:bg-surface-dark-card',
                    'border border-[var(--border)]',
                    'hover:shadow-md transition-all',
                  )}
                >
                  {/* Card header */}
                  <div className={clsx(
                    'h-24 flex items-center justify-center relative',
                    isVideo
                      ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 dark:from-purple-900/30 dark:to-purple-800/10'
                      : 'bg-gradient-to-br from-brand-navy/5 to-brand-gold/5 dark:from-brand-navy/20 dark:to-brand-gold/10',
                  )}>
                    <Icon className={clsx(
                      'w-10 h-10 opacity-30',
                      isVideo ? 'text-purple-500' : 'text-brand-navy dark:text-brand-gold',
                    )} />
                    <span className={clsx(
                      'absolute top-3 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase',
                      isVideo
                        ? 'bg-purple-500/10 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                        : 'bg-brand-navy/10 text-brand-navy dark:bg-brand-gold/20 dark:text-brand-gold',
                    )}>
                      {fileType}
                    </span>
                  </div>

                  {/* Card body */}
                  <div className="p-4 space-y-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2 group-hover:text-brand-navy dark:group-hover:text-brand-gold transition-colors">
                      {fileName}
                    </h3>

                    {r.course_title && (
                      <p className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                        <BookOpen className="w-3 h-3 shrink-0" />
                        <span className="truncate">{getLocalText(r.course_title, language)}</span>
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/learn/${r.id}`}
                        className={clsx(
                          'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                          'bg-brand-navy/5 text-brand-navy hover:bg-brand-navy hover:text-white',
                          'dark:bg-brand-gold/10 dark:text-brand-gold dark:hover:bg-brand-gold dark:hover:text-gray-900',
                        )}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('open')}
                      </Link>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          download
                          className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          title={t('download')}
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
