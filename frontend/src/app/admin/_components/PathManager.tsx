'use client';
// ============================================================================
// Topnet Solutions Academy — Learning Path Manager (Admin)
// CRUD for multi-course learning paths (parcours de formation)
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, X, Loader2, GripVertical, BookOpen, Route, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { pathApi, courseApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from './ConfirmDialog';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

export default function PathManager() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const confirm = useConfirm();
  const [paths, setPaths] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form
  const [titleFr, setTitleFr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descFr, setDescFr] = useState('');
  const [slug, setSlug] = useState('');
  const [hours, setHours] = useState('');
  const [published, setPublished] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add course modal
  const [showAddCourse, setShowAddCourse] = useState<string | null>(null);

  const fetchPaths = useCallback(async () => {
    if (!token) return;
    try {
      const res: any = await pathApi.list(token);
      setPaths(res.data || []);
    } catch { setPaths([]); }
    finally { setLoading(false); }
  }, [token]);

  const fetchCourses = useCallback(async () => {
    if (!token) return;
    try {
      const res: any = await courseApi.list(token, { limit: 100 });
      setCourses(res.data || []);
    } catch { setCourses([]); }
  }, [token]);

  useEffect(() => { fetchPaths(); fetchCourses(); }, [fetchPaths, fetchCourses]);

  const resetForm = () => {
    setTitleFr(''); setTitleEn(''); setDescFr(''); setSlug(''); setHours(''); setPublished(false);
    setEditing(null); setShowForm(false);
  };

  const openEdit = (p: any) => {
    setEditing(p);
    setTitleFr(getLocalText(p.title, 'fr'));
    setTitleEn(getLocalText(p.title, 'en'));
    setDescFr(getLocalText(p.description, 'fr'));
    setSlug(p.slug);
    setHours(p.estimated_hours?.toString() || '');
    setPublished(p.is_published);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!token || !titleFr.trim()) return;
    setSaving(true);
    const payload = {
      title: { fr: titleFr, en: titleEn || titleFr },
      description: descFr ? { fr: descFr } : undefined,
      slug: slug || titleFr.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      estimatedHours: hours ? parseFloat(hours) : undefined,
      isPublished: published,
    };
    try {
      if (editing) {
        await pathApi.update(token, editing.id, payload);
        toast.success('Parcours mis à jour');
      } else {
        await pathApi.create(token, payload);
        toast.success('Parcours créé');
      }
      resetForm(); fetchPaths();
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!token) return;
    const ok = await confirm({
      title: 'Supprimer ce parcours ?',
      message: `Le parcours « ${name} » et ses associations seront supprimés.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await pathApi.delete(token, id);
      toast.success('Parcours supprimé'); fetchPaths();
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
  };

  const handleAddCourse = async (pathId: string, courseId: string) => {
    if (!token) return;
    try {
      await pathApi.addCourse(token, pathId, { courseId, sortOrder: 99 });
      toast.success('Cours ajouté');
      setShowAddCourse(null);
      // Refresh path detail
      const res: any = await pathApi.get(token, pathId);
      setPaths(prev => prev.map(p => p.id === pathId ? { ...p, ...res.data } : p));
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
  };

  const handleRemoveCourse = async (pathId: string, courseId: string) => {
    if (!token) return;
    try {
      await pathApi.removeCourse(token, pathId, courseId);
      toast.success('Cours retiré');
      const res: any = await pathApi.get(token, pathId);
      setPaths(prev => prev.map(p => p.id === pathId ? { ...p, ...res.data } : p));
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
  };

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    if (!token) return;
    // Fetch detail with courses
    try {
      const res: any = await pathApi.get(token, id);
      setPaths(prev => prev.map(p => p.id === id ? { ...p, ...res.data } : p));
      setExpanded(id);
    } catch { setExpanded(id); }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20';

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Parcours de formation ({paths.length})</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900">
          <Plus className="w-3.5 h-3.5" /> Nouveau parcours
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{editing ? 'Modifier le parcours' : 'Nouveau parcours'}</h4>
            <button onClick={resetForm}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={titleFr} onChange={e => setTitleFr(e.target.value)} placeholder="Titre (FR)" className={inputClass} />
            <input value={titleEn} onChange={e => setTitleEn(e.target.value)} placeholder="Title (EN)" className={inputClass} />
          </div>
          <textarea value={descFr} onChange={e => setDescFr(e.target.value)} placeholder="Description (FR)" rows={2} className={clsx(inputClass, 'resize-none')} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug-url" className={inputClass} />
            <input type="number" value={hours} onChange={e => setHours(e.target.value)} placeholder="Durée (h)" className={inputClass} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} className="rounded" />
              Publié
            </label>
          </div>
          <button onClick={handleSave} disabled={saving || !titleFr.trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand-navy text-white hover:bg-brand-navy-deep disabled:opacity-40">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      )}

      {/* Paths list */}
      <div className="space-y-3">
        {paths.map(path => (
          <div key={path.id} className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card overflow-hidden">
            {/* Path header */}
            <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/30" onClick={() => toggleExpand(path.id)}>
              <div className="w-10 h-10 rounded-lg bg-brand-navy/10 dark:bg-brand-gold/20 flex items-center justify-center shrink-0">
                <Route className="w-5 h-5 text-brand-navy dark:text-brand-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{getLocalText(path.title)}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {path.course_count || 0} cours &bull; {path.estimated_hours || '—'}h
                  &bull; {path.is_published ? <span className="text-emerald-500">Publié</span> : <span className="text-amber-500">Brouillon</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={e => { e.stopPropagation(); openEdit(path); }} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Edit3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /></button>
                <button onClick={e => { e.stopPropagation(); handleDelete(path.id, getLocalText(path.title)); }} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                {expanded === path.id ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
              </div>
            </div>

            {/* Expanded: courses list */}
            {expanded === path.id && (
              <div className="border-t border-[var(--border)] p-4 space-y-2">
                {(path.courses || []).map((c: any, i: number) => (
                  <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                    <span className="w-6 h-6 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <BookOpen className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
                    <span className="flex-1 text-sm text-[var(--text-primary)] truncate">{getLocalText(c.title)}</span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{c.level} &bull; {c.estimated_hours || '—'}h</span>
                    <button onClick={() => handleRemoveCourse(path.id, c.id)} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3 h-3 text-red-400" /></button>
                  </div>
                ))}

                {/* Add course */}
                {showAddCourse === path.id ? (
                  <div className="p-2 rounded-lg border border-dashed border-[var(--border)] space-y-2">
                    <p className="text-xs font-medium text-[var(--text-secondary)]">Ajouter un cours :</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {courses.filter(c => !(path.courses || []).some((pc: any) => pc.id === c.id)).map(c => (
                        <button key={c.id} onClick={() => handleAddCourse(path.id, c.id)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-sm hover:bg-brand-navy/5 dark:hover:bg-brand-gold/10">
                          <BookOpen className="w-3.5 h-3.5 text-brand-navy dark:text-brand-gold shrink-0" />
                          <span className="truncate">{getLocalText(c.title)}</span>
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setShowAddCourse(null)} className="text-xs text-[var(--text-secondary)] hover:underline">Annuler</button>
                  </div>
                ) : (
                  <button onClick={() => setShowAddCourse(path.id)} className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg border border-dashed border-[var(--border)] text-xs text-[var(--text-secondary)] hover:border-brand-navy hover:text-brand-navy dark:hover:border-brand-gold dark:hover:text-brand-gold">
                    <Plus className="w-3.5 h-3.5" /> Ajouter un cours
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {paths.length === 0 && (
          <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
            Aucun parcours créé. Cliquez sur "Nouveau parcours" pour commencer.
          </div>
        )}
      </div>
    </div>
  );
}
