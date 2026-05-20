'use client';
// ============================================================================
// AU-IBAR Learning — Category Manager (Admin)
// CRUD for course categories with icons and colors
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, X, Loader2 } from 'lucide-react';
import { icons } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { categoryApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import MultiLangInput from './MultiLangInput';
import IconPicker from './IconPicker';
import ColorPicker from './ColorPicker';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

export default function CategoryManager() {
  const { token } = useAuth();
  const t = useTranslations('admin');
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState<Record<string, string>>({});
  const [description, setDescription] = useState<Record<string, string>>({});
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('BookOpen');
  const [color, setColor] = useState('#1A5632');
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res: any = await categoryApi.list();
      setCategories(res.data || []);
    } catch { setCategories([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const resetForm = () => {
    setName({}); setDescription({}); setSlug(''); setIcon('BookOpen'); setColor('#1A5632');
    setEditing(null); setShowForm(false);
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    const n = typeof cat.name === 'object' && cat.name ? cat.name : { fr: getLocalText(cat.name, 'fr') };
    const d = typeof cat.description === 'object' && cat.description ? cat.description : {};
    setName(n);
    setDescription(d);
    setSlug(cat.slug);
    setIcon(cat.icon || 'BookOpen');
    setColor(cat.color || '#1A5632');
    setShowForm(true);
  };

  const handleSave = async () => {
    const nameFr = (name.fr || '').trim();
    if (!token || !nameFr) return;
    setSaving(true);
    // Filter out empty lang values
    const cleanName: Record<string, string> = {};
    for (const [k, v] of Object.entries(name)) { if (v?.trim()) cleanName[k] = v.trim(); }
    const cleanDesc: Record<string, string> = {};
    for (const [k, v] of Object.entries(description)) { if (v?.trim()) cleanDesc[k] = v.trim(); }
    const payload = {
      name: cleanName,
      description: Object.keys(cleanDesc).length > 0 ? cleanDesc : undefined,
      slug: slug || nameFr.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      icon, color,
    };
    try {
      if (editing) {
        await categoryApi.update(token, editing.id, payload);
        toast.success('Catégorie mise à jour');
      } else {
        await categoryApi.create(token, payload);
        toast.success('Catégorie créée');
      }
      resetForm();
      fetchCategories();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token || !confirm('Supprimer cette catégorie ?')) return;
    try {
      await categoryApi.delete(token, id);
      toast.success('Catégorie supprimée');
      fetchCategories();
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20';

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('tabCategories') || 'Catégories'} ({categories.length})</h3>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900">
          <Plus className="w-3.5 h-3.5" /> Nouvelle
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">{editing ? 'Modifier' : 'Nouvelle catégorie'}</h4>
            <button onClick={resetForm}><X className="w-4 h-4 text-[var(--text-secondary)]" /></button>
          </div>
          <MultiLangInput value={name} onChange={setName} label={t('categoryName') || 'Nom'} placeholder="Nom" required />
          <MultiLangInput value={description} onChange={setDescription} label="Description" placeholder="Description" multiline rows={2} />
          <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="slug-url" className={inputClass} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Icône</label>
              <IconPicker value={icon} onChange={setIcon} color={color} />
            </div>
            <div>
              <label className="text-xs text-[var(--text-secondary)] mb-1.5 block">Couleur</label>
              <ColorPicker value={color} onChange={setColor} />
            </div>
          </div>
          <button onClick={handleSave} disabled={saving || !(name.fr || '').trim()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-brand-navy text-white hover:bg-brand-navy-deep disabled:opacity-40">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {editing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card hover:shadow-sm transition-shadow">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}15` }}>
              {(() => { const I = icons[cat.icon as keyof typeof icons]; return I ? <I className="w-5 h-5" style={{ color: cat.color }} /> : null; })()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">{getLocalText(cat.name)}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{cat.course_count || 0} cours &bull; {cat.slug}</p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(cat)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><Edit3 className="w-3.5 h-3.5 text-[var(--text-secondary)]" /></button>
              <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
