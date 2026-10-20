'use client';
// ============================================================================
// Topnet Solutions Academy — PlanSessionModal
// Plan a live BBB session (title, course, date, duration, max participants)
// ============================================================================
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { courseApi, liveApi } from '@/lib/api';
import MultiLangInput from './MultiLangInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlanSessionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const DURATION_PRESETS = [
  { value: 30, label: '30 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
];

function getLocalizedText(text: Record<string, string> | string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.fr || text.en || Object.values(text)[0] || '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlanSessionModal({ open, onClose, onSuccess }: PlanSessionModalProps) {
  const { token } = useAuth();
  const t = useTranslations('admin.session');
  const t_common = useTranslations('common');
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState<Record<string, string>>({});
  const [description, setDescription] = useState<Record<string, string>>({});
  const [courseId, setCourseId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [duration, setDuration] = useState(60);
  const [maxParticipants, setMaxParticipants] = useState(300);

  const [courses, setCourses] = useState<any[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);

  // Load courses for dropdown
  useEffect(() => {
    if (!open || !token) return;
    setLoadingCourses(true);
    courseApi.list(token, { limit: 100 })
      .then((res: any) => setCourses(res.data || []))
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, [open, token]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTitle({});
      setDescription({});
      setCourseId('');
      setScheduledAt('');
      setDuration(60);
      setMaxParticipants(300);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!token || !title.fr || !scheduledAt) {
      toast.error(t('requiredFields'));
      return;
    }
    setSaving(true);
    try {
      await liveApi.createSession(token, {
        title,
        description: Object.keys(description).length > 0 ? description : undefined,
        courseId: courseId || undefined,
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: duration,
        maxParticipants,
      });
      toast.success(t('planSuccess'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('planError'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass = clsx(
    'w-full px-3 py-2 rounded-lg text-sm',
    'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
    'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
    'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className={clsx(
              'w-full max-w-lg max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
            )}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-lg font-bold text-[var(--text-primary)]">{t('planTitle')}</h2>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              <MultiLangInput
                label={t('titleLabel')}
                value={title}
                onChange={setTitle}
                required
              />

              <MultiLangInput
                label={t('description')}
                value={description}
                onChange={setDescription}
                multiline
                rows={2}
              />

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('linkedCourse')}
                </label>
                <select
                  value={courseId}
                  onChange={e => setCourseId(e.target.value)}
                  className={inputClass}
                  disabled={loadingCourses}
                >
                  <option value="">{t('noCourse')}</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{getLocalizedText(c.title)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('dateTime')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('duration')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_PRESETS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setDuration(p.value)}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                        duration === p.value
                          ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700',
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                  {t('maxParticipants')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(Number(e.target.value))}
                  className={clsx(inputClass, 'max-w-[120px]')}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {t_common('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || !title.fr || !scheduledAt}
                className={clsx(
                  'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium',
                  'bg-brand-navy text-white hover:bg-brand-navy-deep',
                  'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('planBtn')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
