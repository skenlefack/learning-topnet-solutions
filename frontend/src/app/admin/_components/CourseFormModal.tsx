'use client';
// ============================================================================
// AU-IBAR Learning — CourseFormModal
// 3-step wizard: Metadata → Modules → Lessons
// Supports create and edit modes
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronRight, ChevronLeft, Plus, Trash2,
  GripVertical, BookOpen, Video, FileText, HelpCircle, Wrench,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { courseApi } from '@/lib/api';
import MultiLangInput from './MultiLangInput';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MultiLangText {
  fr?: string;
  en?: string;
  ar?: string;
  pt?: string;
  [key: string]: string | undefined;
}

interface LessonDraft {
  id?: string;
  title: MultiLangText;
  type: 'video' | 'text' | 'quiz' | 'practical';
  content?: string;
  videoUrl?: string;
  durationMinutes?: number;
  sortOrder: number;
}

interface ModuleDraft {
  id?: string;
  title: MultiLangText;
  estimatedMinutes?: number;
  sortOrder: number;
  lessons: LessonDraft[];
}

interface CourseFormData {
  title: MultiLangText;
  description: MultiLangText;
  slug: string;
  level: string;
  estimatedHours?: number;
  passingScore: number;
  tags: string[];
  status: string;
}

interface CourseFormModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editCourse?: any; // existing course for edit mode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

const LESSON_TYPE_ICONS: Record<string, typeof Video> = {
  video: Video,
  text: FileText,
  quiz: HelpCircle,
  practical: Wrench,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CourseFormModal({ open, onClose, onSuccess, editCourse }: CourseFormModalProps) {
  const { token } = useAuth();
  const isEdit = !!editCourse;
  const t = useTranslations('admin.courseForm');
  const t_admin = useTranslations('admin');
  const t_levels = useTranslations('levels');
  const t_lessonTypes = useTranslations('lessonTypes');
  const t_common = useTranslations('common');

  const LEVEL_OPTIONS = [
    { value: 'beginner', label: t_levels('beginner') },
    { value: 'intermediate', label: t_levels('intermediate') },
    { value: 'advanced', label: t_levels('advanced') },
    { value: 'expert', label: t_levels('expert') },
  ];

  const STEP_LABELS = [t('stepMeta'), t('stepModules'), t('stepLessons')];

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1: Metadata
  const [form, setForm] = useState<CourseFormData>({
    title: {},
    description: {},
    slug: '',
    level: 'beginner',
    estimatedHours: undefined,
    passingScore: 70,
    tags: [],
    status: 'draft',
  });
  const [tagInput, setTagInput] = useState('');

  // Step 2: Modules
  const [modules, setModules] = useState<ModuleDraft[]>([]);

  // Step 3: Active module index for lesson editing
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);

  // Pre-fill in edit mode
  useEffect(() => {
    if (!open) {
      setStep(0);
      setForm({ title: {}, description: {}, slug: '', level: 'beginner', estimatedHours: undefined, passingScore: 70, tags: [], status: 'draft' });
      setModules([]);
      setActiveModuleIdx(0);
      setTagInput('');
      return;
    }

    if (editCourse) {
      setForm({
        title: editCourse.title || {},
        description: editCourse.description || {},
        slug: editCourse.slug || '',
        level: editCourse.level || 'beginner',
        estimatedHours: editCourse.estimated_hours ?? undefined,
        passingScore: editCourse.passing_score ?? 70,
        tags: editCourse.tags || [],
        status: editCourse.status || 'draft',
      });

      // Load modules if available
      if (editCourse.modules && Array.isArray(editCourse.modules)) {
        setModules(
          editCourse.modules.map((m: any, idx: number) => ({
            id: m.id,
            title: m.title || {},
            estimatedMinutes: m.estimatedMinutes || m.estimated_minutes,
            sortOrder: m.sortOrder ?? m.sort_order ?? idx,
            lessons: (m.lessons || []).map((l: any, li: number) => ({
              id: l.id,
              title: l.title || {},
              type: l.type || 'text',
              content: typeof l.content === 'string' ? l.content : JSON.stringify(l.content || ''),
              videoUrl: l.video_url || l.videoUrl,
              durationMinutes: l.durationMinutes || l.duration_minutes,
              sortOrder: l.sortOrder ?? l.sort_order ?? li,
            })),
          })),
        );
      }
    }
  }, [open, editCourse]);

  // Auto-slug from French title
  const handleTitleChange = (val: Record<string, string>) => {
    setForm(prev => ({
      ...prev,
      title: val,
      slug: !isEdit && val.fr ? slugify(val.fr) : prev.slug,
    }));
  };

  // Tags
  const addTag = () => {
    const val = tagInput.trim().toLowerCase();
    if (val && !form.tags.includes(val)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, val] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(x => x !== tag) }));
  };

  // Modules CRUD
  const addModule = () => {
    setModules(prev => [...prev, {
      title: {},
      estimatedMinutes: undefined,
      sortOrder: prev.length,
      lessons: [],
    }]);
  };

  const removeModule = (idx: number) => {
    setModules(prev => prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, sortOrder: i })));
    if (activeModuleIdx >= modules.length - 1) setActiveModuleIdx(Math.max(0, modules.length - 2));
  };

  const updateModule = (idx: number, updates: Partial<ModuleDraft>) => {
    setModules(prev => prev.map((m, i) => i === idx ? { ...m, ...updates } : m));
  };

  const moveModule = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= modules.length) return;
    setModules(prev => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr.map((m, i) => ({ ...m, sortOrder: i }));
    });
  };

  // Lessons CRUD
  const addLesson = (moduleIdx: number) => {
    setModules(prev => prev.map((m, i) =>
      i === moduleIdx ? {
        ...m,
        lessons: [...m.lessons, {
          title: {},
          type: 'text' as const,
          sortOrder: m.lessons.length,
        }],
      } : m,
    ));
  };

  const removeLesson = (moduleIdx: number, lessonIdx: number) => {
    setModules(prev => prev.map((m, i) =>
      i === moduleIdx ? {
        ...m,
        lessons: m.lessons.filter((_, li) => li !== lessonIdx).map((l, li) => ({ ...l, sortOrder: li })),
      } : m,
    ));
  };

  const updateLesson = (moduleIdx: number, lessonIdx: number, updates: Partial<LessonDraft>) => {
    setModules(prev => prev.map((m, i) =>
      i === moduleIdx ? {
        ...m,
        lessons: m.lessons.map((l, li) => li === lessonIdx ? { ...l, ...updates } : l),
      } : m,
    ));
  };

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!token) return;
    setSaving(true);

    try {
      let courseId: string;

      // Step A: Create/update the course
      const coursePayload = {
        title: form.title,
        description: form.description,
        slug: form.slug,
        level: form.level,
        status: form.status,
        estimatedHours: form.estimatedHours || undefined,
        passingScore: form.passingScore,
        tags: form.tags,
      };

      if (isEdit && editCourse?.id) {
        const res: any = await courseApi.update(token, editCourse.id, coursePayload);
        courseId = res.data?.id || editCourse.id;
      } else {
        const res: any = await courseApi.create(token, coursePayload);
        courseId = res.data?.id || res.id;
      }

      // Step B: Create modules (sequential to maintain order)
      for (const mod of modules) {
        const modulePayload = {
          courseId,
          title: mod.title,
          sortOrder: mod.sortOrder,
          estimatedMinutes: mod.estimatedMinutes || undefined,
          isRequired: true,
        };

        let moduleId: string;

        if (mod.id) {
          // Update existing module
          const mRes: any = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/modules/${mod.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              title: mod.title,
              sortOrder: mod.sortOrder,
              estimatedMinutes: mod.estimatedMinutes || undefined,
            }),
          }).then(r => r.json());
          moduleId = mod.id;
        } else {
          const mRes: any = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/modules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(modulePayload),
          }).then(r => r.json());
          moduleId = mRes.data?.id;
        }

        // Step C: Create lessons for this module
        if (moduleId) {
          for (const lesson of mod.lessons) {
            const lessonPayload = {
              moduleId,
              title: lesson.title,
              type: lesson.type,
              content: lesson.content ? { text: lesson.content } : undefined,
              videoUrl: lesson.videoUrl || undefined,
              durationMinutes: lesson.durationMinutes || undefined,
              sortOrder: lesson.sortOrder,
              isRequired: true,
            };

            if (lesson.id) {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/lessons/${lesson.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({
                  title: lesson.title,
                  type: lesson.type,
                  content: lesson.content ? { text: lesson.content } : undefined,
                  videoUrl: lesson.videoUrl || undefined,
                  durationMinutes: lesson.durationMinutes || undefined,
                  sortOrder: lesson.sortOrder,
                }),
              });
            } else {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(lessonPayload),
              });
            }
          }
        }
      }

      toast.success(isEdit ? t('updated') : t('created'));
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [token, form, modules, isEdit, editCourse, onSuccess, onClose, t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!open) return null;

  const canGoNext = step === 0
    ? (form.title.fr && form.slug)
    : step === 1
      ? true
      : true;

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
              'w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl flex flex-col',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
            )}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">
                  {isEdit ? t('editTitle') : t('newTitle')}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {STEP_LABELS.map((label, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <span className={clsx(
                        'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center',
                        i === step
                          ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                          : i < step
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-[var(--text-secondary)]',
                      )}>
                        {i < step ? '\u2713' : i + 1}
                      </span>
                      <span className={clsx(
                        'text-xs',
                        i === step ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-secondary)]',
                      )}>
                        {label}
                      </span>
                      {i < STEP_LABELS.length - 1 && (
                        <ChevronRight className="w-3 h-3 text-[var(--text-secondary)] mx-1" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* STEP 0: Metadata */}
              {step === 0 && (
                <div className="space-y-4">
                  <MultiLangInput
                    label={t('courseTitle')}
                    value={form.title as Record<string, string>}
                    onChange={handleTitleChange}
                    required
                  />

                  <MultiLangInput
                    label={t('description')}
                    value={form.description as Record<string, string>}
                    onChange={val => setForm(prev => ({ ...prev, description: val }))}
                    multiline
                    rows={3}
                  />

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                      {t('slug')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={e => setForm(prev => ({ ...prev, slug: slugify(e.target.value) }))}
                      className={clsx(
                        'w-full px-3 py-2 rounded-lg text-sm',
                        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                        'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                        'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                      )}
                      placeholder="mon-cours-aris"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t_admin('level_col')}</label>
                      <select
                        value={form.level}
                        onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))}
                        className={clsx(
                          'w-full px-3 py-2 rounded-lg text-sm',
                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                          'text-[var(--text-primary)]',
                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                        )}
                      >
                        {LEVEL_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('estimatedHours')}</label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={form.estimatedHours ?? ''}
                        onChange={e => setForm(prev => ({ ...prev, estimatedHours: e.target.value ? Number(e.target.value) : undefined }))}
                        className={clsx(
                          'w-full px-3 py-2 rounded-lg text-sm',
                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                          'text-[var(--text-primary)]',
                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                        )}
                        placeholder="12"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('passingScore')}</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.passingScore}
                      onChange={e => setForm(prev => ({ ...prev, passingScore: Number(e.target.value) }))}
                      className={clsx(
                        'w-full px-3 py-2 rounded-lg text-sm max-w-[120px]',
                        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                        'text-[var(--text-primary)]',
                        'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Tags</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                        className={clsx(
                          'flex-1 px-3 py-2 rounded-lg text-sm',
                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                          'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                        )}
                        placeholder={t('addTagPlaceholder')}
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)] hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        {t('addTag')}
                      </button>
                    </div>
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {form.tags.map(tag => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-navy/10 text-brand-navy dark:bg-brand-gold/20 dark:text-brand-gold"
                          >
                            {tag}
                            <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 1: Modules */}
              {step === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[var(--text-secondary)]">
                      {t('moduleCount', { count: modules.length })}
                    </p>
                    <button
                      type="button"
                      onClick={addModule}
                      className={clsx(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                        'bg-brand-navy text-white hover:bg-brand-navy-deep',
                        'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" /> {t('addModule')}
                    </button>
                  </div>

                  {modules.length === 0 && (
                    <div className="text-center py-8 text-[var(--text-secondary)]">
                      <BookOpen className="w-10 h-10 mx-auto opacity-30 mb-2" />
                      <p className="text-sm">{t('noModules')}</p>
                    </div>
                  )}

                  {modules.map((mod, idx) => (
                    <div
                      key={idx}
                      className={clsx(
                        'rounded-xl p-4 border border-[var(--border)]',
                        'bg-gray-50 dark:bg-gray-800/30',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex flex-col items-center gap-0.5 pt-1">
                          <button
                            type="button"
                            onClick={() => moveModule(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                          </button>
                          <GripVertical className="w-4 h-4 text-[var(--text-secondary)] opacity-40" />
                          <button
                            type="button"
                            onClick={() => moveModule(idx, 1)}
                            disabled={idx === modules.length - 1}
                            className="p-0.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"
                          >
                            <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                          </button>
                        </div>

                        <div className="flex-1 space-y-3">
                          <MultiLangInput
                            label={t('moduleLabel', { index: idx + 1 })}
                            value={mod.title as Record<string, string>}
                            onChange={val => updateModule(idx, { title: val })}
                            required
                          />
                          <div>
                            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('durationMinutes')}</label>
                            <input
                              type="number"
                              min={0}
                              value={mod.estimatedMinutes ?? ''}
                              onChange={e => updateModule(idx, { estimatedMinutes: e.target.value ? Number(e.target.value) : undefined })}
                              className={clsx(
                                'w-24 px-3 py-1.5 rounded-lg text-sm',
                                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                                'text-[var(--text-primary)]',
                                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                              )}
                              placeholder="60"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeModule(idx)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 2: Lessons */}
              {step === 2 && (
                <div className="space-y-4">
                  {modules.length === 0 ? (
                    <div className="text-center py-8 text-[var(--text-secondary)]">
                      <p className="text-sm">{t('noModuleDefined')}</p>
                    </div>
                  ) : (
                    <>
                      {/* Module selector tabs */}
                      <div className="flex gap-1 overflow-x-auto pb-1">
                        {modules.map((mod, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActiveModuleIdx(idx)}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                              activeModuleIdx === idx
                                ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                                : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
                            )}
                          >
                            {t('moduleLabel', { index: idx + 1 })}
                            {(mod.title as any)?.fr && `: ${(mod.title as any).fr.slice(0, 20)}`}
                          </button>
                        ))}
                      </div>

                      {/* Lessons for active module */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-[var(--text-secondary)]">
                            {t('lessonCount', { count: modules[activeModuleIdx]?.lessons.length || 0 })}
                          </p>
                          <button
                            type="button"
                            onClick={() => addLesson(activeModuleIdx)}
                            className={clsx(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                              'bg-brand-navy text-white hover:bg-brand-navy-deep',
                              'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                            )}
                          >
                            <Plus className="w-3.5 h-3.5" /> {t('addLesson')}
                          </button>
                        </div>

                        {(modules[activeModuleIdx]?.lessons || []).map((lesson, li) => {
                          const TypeIcon = LESSON_TYPE_ICONS[lesson.type] || FileText;
                          return (
                            <div
                              key={li}
                              className={clsx(
                                'rounded-xl p-4 border border-[var(--border)]',
                                'bg-gray-50 dark:bg-gray-800/30',
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center shrink-0">
                                  <TypeIcon className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
                                </div>

                                <div className="flex-1 space-y-3">
                                  <MultiLangInput
                                    label={t('lessonLabel', { index: li + 1 })}
                                    value={lesson.title as Record<string, string>}
                                    onChange={val => updateLesson(activeModuleIdx, li, { title: val })}
                                    required
                                  />

                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('type')}</label>
                                      <select
                                        value={lesson.type}
                                        onChange={e => updateLesson(activeModuleIdx, li, { type: e.target.value as any })}
                                        className={clsx(
                                          'w-full px-3 py-1.5 rounded-lg text-sm',
                                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                                          'text-[var(--text-primary)]',
                                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                                        )}
                                      >
                                        <option value="video">{t_lessonTypes('video')}</option>
                                        <option value="text">{t_lessonTypes('text')}</option>
                                        <option value="quiz">{t_lessonTypes('quiz')}</option>
                                        <option value="practical">{t_lessonTypes('practical')}</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('durationMin')}</label>
                                      <input
                                        type="number"
                                        min={0}
                                        value={lesson.durationMinutes ?? ''}
                                        onChange={e => updateLesson(activeModuleIdx, li, { durationMinutes: e.target.value ? Number(e.target.value) : undefined })}
                                        className={clsx(
                                          'w-full px-3 py-1.5 rounded-lg text-sm',
                                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                                          'text-[var(--text-primary)]',
                                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                                        )}
                                        placeholder="15"
                                      />
                                    </div>
                                  </div>

                                  {lesson.type === 'video' && (
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('videoUrl')}</label>
                                      <input
                                        type="url"
                                        value={lesson.videoUrl ?? ''}
                                        onChange={e => updateLesson(activeModuleIdx, li, { videoUrl: e.target.value })}
                                        className={clsx(
                                          'w-full px-3 py-1.5 rounded-lg text-sm',
                                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                                          'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                                        )}
                                        placeholder="https://..."
                                      />
                                    </div>
                                  )}

                                  {(lesson.type === 'text' || lesson.type === 'practical') && (
                                    <div>
                                      <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('content')}</label>
                                      <textarea
                                        value={lesson.content ?? ''}
                                        onChange={e => updateLesson(activeModuleIdx, li, { content: e.target.value })}
                                        rows={3}
                                        className={clsx(
                                          'w-full px-3 py-1.5 rounded-lg text-sm resize-none',
                                          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                                          'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                                          'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                                        )}
                                        placeholder={t('contentPlaceholder')}
                                      />
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeLesson(activeModuleIdx, li)}
                                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)]">
              <div>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep(s => s - 1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <ChevronLeft className="w-4 h-4" /> {t('back')}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {t_common('cancel')}
                </button>
                {step < 2 ? (
                  <button
                    type="button"
                    onClick={() => setStep(s => s + 1)}
                    disabled={!canGoNext}
                    className={clsx(
                      'flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium',
                      'bg-brand-navy text-white hover:bg-brand-navy-deep',
                      'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    {t('next')} <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className={clsx(
                      'flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium',
                      'bg-brand-navy text-white hover:bg-brand-navy-deep',
                      'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isEdit ? t('save') : t('create')}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
