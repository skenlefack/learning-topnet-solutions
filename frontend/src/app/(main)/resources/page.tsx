'use client';
// ============================================================================
// AU-IBAR Learning — Resources Page
// Lists all documents, videos, files published by trainers across courses
// ============================================================================
import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText, Video, Download, Search, Filter, Music,
  File, Loader2, BookOpen, ExternalLink,
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

export default function ResourcesPage() {
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'video' | 'document'>('all');

  useEffect(() => {
    if (!token) return;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 max-w-5xl mx-auto"
    >
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Ressources</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Documents, vidéos et fichiers publiés par les formateurs
        </p>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une ressource..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-white dark:bg-surface-dark-card border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'video', 'document'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTypeFilter(t); setLoading(true); }}
              className={clsx(
                'px-3 py-2 rounded-xl text-xs font-medium transition-colors',
                typeFilter === t
                  ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                  : 'bg-white dark:bg-surface-dark-card border border-[var(--border)] text-[var(--text-secondary)] hover:bg-gray-50',
              )}
            >
              {t === 'all' ? 'Tout' : t === 'video' ? 'Vidéos' : 'Documents'}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30 mb-3" />
          <p className="text-sm text-[var(--text-secondary)]">Aucune ressource trouvée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const Icon = TYPE_ICONS[r.lesson_type] || FileText;
            const isVideo = !!r.video_url;
            const fileUrl = isVideo ? r.video_url : r.document_url;
            const fileName = r.document_name || getLocalText(r.title, language);
            const fileType = r.document_type ? (MIME_LABELS[r.document_type] || r.document_type.split('/')[1]) : (isVideo ? 'Vidéo' : 'Fichier');

            return (
              <div
                key={r.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] hover:shadow-sm transition-shadow"
              >
                <div className={clsx(
                  'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                  isVideo ? 'bg-purple-50 dark:bg-purple-900/20' : 'bg-brand-navy/5 dark:bg-brand-gold/20',
                )}>
                  <Icon className={clsx('w-5 h-5', isVideo ? 'text-purple-500' : 'text-brand-navy dark:text-brand-gold')} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{fileName}</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-medium">{fileType}</span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {getLocalText(r.course_title, language)}
                    </span>
                    {r.duration_minutes && <span>{r.duration_minutes} min</span>}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/learn/${r.id}`}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                    title="Ouvrir"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                  {fileUrl && (
                    <a
                      href={fileUrl}
                      download
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
