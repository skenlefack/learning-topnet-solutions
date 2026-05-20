'use client';
// ============================================================================
// AU-IBAR Learning — CourseForm
// 3-step wizard: Metadata → Modules → Lessons
// Inline view (replaces course list) with back button
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronRight, ChevronLeft, Plus, Trash2, ArrowLeft,
  GripVertical, BookOpen, Video, FileText, HelpCircle, Wrench,
  Loader2, Save, Layers,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { courseApi, categoryApi } from '@/lib/api';
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
  categoryId?: string;
  estimatedHours?: number;
  passingScore: number;
  tags: string[];
  status: string;
}

interface CourseFormProps {
  onBack: () => void;
  onSuccess: () => void;
  editCourse?: any;
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

const inputClass = clsx(
  'w-full px-3 py-2 rounded-lg text-sm',
  'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
  'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
  'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CourseForm({ onBack, onSuccess, editCourse }: CourseFormProps) {
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
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    categoryApi.list().then((res: any) => setCategories(res.data || [])).catch(() => {});
  }, []);

  // Step 2: Modules
  const [modules, setModules] = useState<ModuleDraft[]>([]);

  // Step 3: Active module index for lesson editing
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);

  // Pre-fill in edit mode
  useEffect(() => {
    if (editCourse) {
      setForm({
        title: editCourse.title || {},
        description: editCourse.description || {},
        slug: editCourse.slug || '',
        level: editCourse.level || 'beginner',
        categoryId: editCourse.category_id || undefined,
        estimatedHours: editCourse.estimated_hours ?? undefined,
        passingScore: editCourse.passing_score ?? 70,
        tags: editCourse.tags || [],
        status: editCourse.status || 'draft',
      });

      // Load modules + lessons
      if (token && editCourse.id) {
        courseApi.modules(token, editCourse.id)
          .then((res: any) => {
            const mods = res.data || [];
            setModules(
              mods.map((m: any, idx: number) => ({
                id: m.id,
                title: m.title || {},
                estimatedMinutes: m.estimatedMinutes || m.estimated_minutes,
                sortOrder: m.sortOrder ?? m.sort_order ?? idx,
                lessons: (m.lessons || []).map((l: any, li: number) => ({
                  id: l.id,
                  title: l.title || {},
                  type: l.type || 'text',
                  content: typeof l.content === 'object' ? (l.content?.text || '') : (l.content || ''),
                  videoUrl: l.video_url || l.videoUrl || '',
                  durationMinutes: l.durationMinutes || l.duration_minutes,
                  sortOrder: l.sortOrder ?? l.sort_order ?? li,
                })),
              })),
            );
          })
          .catch(() => {});
      } else if (editCourse.modules && Array.isArray(editCourse.modules)) {
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
              content: typeof l.content === 'object' ? (l.content?.text || '') : (l.content || ''),
              videoUrl: l.video_url || l.videoUrl || '',
              durationMinutes: l.durationMinutes || l.duration_minutes,
              sortOrder: l.sortOrder ?? l.sort_order ?? li,
            })),
          })),
        );
      }
    }
  }, [editCourse, token]);

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
        categoryId: form.categoryId || null,
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

      if (!courseId) throw new Error('Course ID not returned');

      // Step B: Create/update modules (sequential to maintain order)
      for (const mod of modules) {
        let moduleId: string | undefined;

        if (mod.id) {
          await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/modules/${mod.id}`, {
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
            body: JSON.stringify({
              courseId,
              title: mod.title,
              sortOrder: mod.sortOrder,
              estimatedMinutes: mod.estimatedMinutes || undefined,
              isRequired: true,
            }),
          }).then(r => r.json());
          moduleId = mRes.data?.id;
        }

        // Step C: Create/update lessons for this module
        if (moduleId) {
          for (const lesson of mod.lessons) {
            const lessonBody: any = {
              title: lesson.title,
              type: lesson.type,
              content: lesson.content ? { text: lesson.content } : undefined,
              videoUrl: lesson.videoUrl || undefined,
              durationMinutes: lesson.durationMinutes || undefined,
              sortOrder: lesson.sortOrder,
            };

            if (lesson.id) {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/lessons/${lesson.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(lessonBody),
              });
            } else {
              await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/courses/lessons`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ...lessonBody, moduleId, isRequired: true }),
              });
            }
          }
        }
      }

      toast.success(isEdit ? t('updated') : t('created'));
      onSuccess();
      onBack();
    } catch (err: any) {
      toast.error(err.message || t('saveError'));
    } finally {
      setSaving(false);
    }
  }, [token, form, modules, isEdit, editCourse, onSuccess, onBack, t]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canGoNext = step === 0 ? !!(form.title.fr && form.slug) : true;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-5"
    >
      {/* Back + Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t_admin('tabCourses')}
        </button>
        <div className="h-5 w-px bg-[var(--border)]" />
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          {isEdit ? t('editTitle') : t('newTitle')}
        </h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1 bg-white dark:bg-surface-dark-card rounded-xl border border-[var(--border)] p-3">
        {STEP_LABELS.map((label, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { if (i < step || (i === step + 1 && canGoNext)) setStep(i); }}
            className="flex items-center gap-1.5"
          >
            <span className={clsx(
              'w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors',
              i === step
                ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                : i < step
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-[var(--text-secondary)]',
            )}>
              {i < step ? '\u2713' : i + 1}
            </span>
            <span className={clsx(
              'text-sm hidden sm:inline',
              i === step ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]',
            )}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && (
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] mx-2" />
            )}
          </button>
        ))}
      </div>

      {/* Content Card */}
      <form
        className="bg-white dark:bg-surface-dark-card rounded-xl border border-[var(--border)] overflow-hidden"
        onSubmit={e => {
          e.preventDefault();
          if (step === 2) handleSave();
          else if (canGoNext) setStep(s => s + 1);
        }}
      >
        <div className="p-6">
          {/* STEP 0: Metadata */}
          {step === 0 && (
            <div className="space-y-4 max-w-2xl">
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
                  className={inputClass + ' max-w-md'}
                  placeholder="mon-cours-aris"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t_admin('level_col')}</label>
                  <select
                    value={form.level}
                    onChange={e => setForm(prev => ({ ...prev, level: e.target.value }))}
                    className={inputClass}
                  >
                    {LEVEL_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Catégorie</label>
                  <select
                    value={form.categoryId || ''}
                    onChange={e => setForm(prev => ({ ...prev, categoryId: e.target.value || undefined }))}
                    className={inputClass}
                  >
                    <option value="">— Aucune —</option>
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name?.fr || cat.name?.en || cat.slug}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Statut</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(prev => ({ ...prev, status: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="draft">Brouillon</option>
                    <option value="published">Publié</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('estimatedHours')}</label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.estimatedHours ?? ''}
                    onChange={e => setForm(prev => ({ ...prev, estimatedHours: e.target.value ? Number(e.target.value) : undefined }))}
                    className={inputClass}
                    placeholder="12"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">{t('passingScore')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.passingScore}
                    onChange={e => setForm(prev => ({ ...prev, passingScore: Number(e.target.value) }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Tags</label>
                <div className="flex items-center gap-2 max-w-md">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    className={inputClass}
                    placeholder={t('addTagPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)] hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"
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
                          <Trash2 className="w-3 h-3" />
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-brand-navy dark:text-brand-gold" />
                  <span className="text-sm font-medium text-[var(--text-primary)]">
                    {t('moduleCount', { count: modules.length })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={addModule}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                    'bg-brand-navy text-white hover:bg-brand-navy-deep',
                    'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                  )}
                >
                  <Plus className="w-3.5 h-3.5" /> {t('addModule')}
                </button>
              </div>

              {modules.length === 0 && (
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <BookOpen className="w-12 h-12 mx-auto opacity-20 mb-3" />
                  <p className="text-sm">{t('noModules')}</p>
                  <p className="text-xs mt-1">Cliquez sur « {t('addModule')} » pour commencer</p>
                </div>
              )}

              {modules.map((mod, idx) => (
                <div
                  key={idx}
                  className="rounded-xl p-4 border border-[var(--border)] bg-gray-50/50 dark:bg-gray-800/20"
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
                          className={inputClass + ' max-w-[120px]'}
                          placeholder="60"
                        />
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        {mod.lessons.length} leçon{mod.lessons.length !== 1 ? 's' : ''}
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
                <div className="text-center py-12 text-[var(--text-secondary)]">
                  <p className="text-sm">{t('noModuleDefined')}</p>
                </div>
              ) : (
                <>
                  {/* Module selector tabs */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {modules.map((mod, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveModuleIdx(idx)}
                        className={clsx(
                          'px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                          activeModuleIdx === idx
                            ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                            : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)] hover:bg-gray-200 dark:hover:bg-gray-700',
                        )}
                      >
                        {t('moduleLabel', { index: idx + 1 })}
                        {(mod.title as any)?.fr && `: ${(mod.title as any).fr.slice(0, 25)}`}
                        <span className="ml-1.5 opacity-60">({mod.lessons.length})</span>
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
                          'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium',
                          'bg-brand-navy text-white hover:bg-brand-navy-deep',
                          'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                        )}
                      >
                        <Plus className="w-3.5 h-3.5" /> {t('addLesson')}
                      </button>
                    </div>

                    {(modules[activeModuleIdx]?.lessons || []).length === 0 && (
                      <div className="text-center py-8 text-[var(--text-secondary)]">
                        <FileText className="w-10 h-10 mx-auto opacity-20 mb-2" />
                        <p className="text-sm">Aucune leçon dans ce module</p>
                      </div>
                    )}

                    {(modules[activeModuleIdx]?.lessons || []).map((lesson, li) => {
                      const TypeIcon = LESSON_TYPE_ICONS[lesson.type] || FileText;
                      return (
                        <div
                          key={li}
                          className="rounded-xl p-4 border border-[var(--border)] bg-gray-50/50 dark:bg-gray-800/20"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                              <TypeIcon className="w-4.5 h-4.5 text-brand-navy dark:text-brand-gold" />
                            </div>

                            <div className="flex-1 space-y-3">
                              <MultiLangInput
                                label={t('lessonLabel', { index: li + 1 })}
                                value={lesson.title as Record<string, string>}
                                onChange={val => updateLesson(activeModuleIdx, li, { title: val })}
                                required
                              />

                              <div className="grid grid-cols-2 gap-3 max-w-md">
                                <div>
                                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('type')}</label>
                                  <select
                                    value={lesson.type}
                                    onChange={e => updateLesson(activeModuleIdx, li, { type: e.target.value as any })}
                                    className={inputClass}
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
                                    className={inputClass}
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
                                    className={inputClass + ' max-w-lg'}
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
                                    className={inputClass + ' resize-none'}
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] bg-gray-50/50 dark:bg-gray-900/20">
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
              onClick={onBack}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {t_common('cancel')}
            </button>
            {step < 2 ? (
              <button
                type="submit"
                disabled={!canGoNext}
                className={clsx(
                  'flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-medium',
                  'bg-brand-navy text-white hover:bg-brand-navy-deep',
                  'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {t('next')} <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className={clsx(
                  'flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium',
                  'bg-brand-navy text-white hover:bg-brand-navy-deep',
                  'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isEdit ? t('save') : t('create')}
              </button>
            )}
          </div>
        </div>
      </form>
    </motion.div>
  );
}
