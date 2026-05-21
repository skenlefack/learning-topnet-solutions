'use client';
// ============================================================================
// AU-IBAR Learning — Certificate Template Manager (Admin)
// CRUD certificate templates by level with signatories and live preview
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit3, Trash2, X, Loader2, Eye, Award, UserPlus,
  CheckCircle, Copy, Star, Palette,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useConfirm } from './ConfirmDialog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Signatory {
  id: string;
  name: string;
  title: string;
  signatureUrl?: string; // base64 data URL
}

interface CertTemplate {
  id?: string;
  name: string;
  level: string;
  design: {
    style: string; // 'classic' | 'modern' | 'elegant' | 'gold' | 'green'
    borderColor: string;
    accentColor: string;
    logoUrl?: string;
    headerText: string;
    bodyText: string;
    footerText: string;
  };
  signatories: Signatory[];
  is_default: boolean;
  is_active: boolean;
}

const LEVELS = [
  { value: 'beginner', label: 'Débutant', color: '#1A5632' },
  { value: 'intermediate', label: 'Intermédiaire', color: '#B8952E' },
  { value: 'advanced', label: 'Avancé', color: '#930e2d' },
  { value: 'expert', label: 'Expert', color: '#154528' },
];

const PRESET_STYLES = [
  {
    id: 'classic',
    name: 'Classique AU-IBAR',
    borderColor: '#1A5632',
    accentColor: '#C8A951',
    headerText: 'AFRICAN UNION — INTERAFRICAN BUREAU FOR ANIMAL RESOURCES',
    bodyText: 'This is to certify that\n\n{{learnerName}}\n\nhas successfully completed the course\n\n{{courseName}}\n\nwith a score of {{score}}% and is hereby awarded this\n\nCERTIFICATE OF {{level}}',
    footerText: 'AU-IBAR Learning Platform — learning.au-ibar.org',
  },
  {
    id: 'modern',
    name: 'Moderne',
    borderColor: '#0D47A1',
    accentColor: '#42A5F5',
    headerText: 'AU-IBAR LEARNING',
    bodyText: 'Certificate of Achievement\n\nAwarded to\n\n{{learnerName}}\n\nFor successfully completing\n\n{{courseName}}\n\nLevel: {{level}} — Score: {{score}}%',
    footerText: 'Issued on {{date}} — Certificate Nº {{certNumber}}',
  },
  {
    id: 'elegant',
    name: 'Élégant Or',
    borderColor: '#B8952E',
    accentColor: '#1A5632',
    headerText: 'UNION AFRICAINE\nBUREAU INTERAFRICAIN DES RESSOURCES ANIMALES',
    bodyText: 'CERTIFICAT DE FORMATION\n\nDécerné à\n\n{{learnerName}}\n\nPour avoir complété avec succès la formation\n\n{{courseName}}\n\nNiveau : {{level}} — Score : {{score}}%',
    footerText: 'Délivré le {{date}} à Nairobi, Kenya — Nº {{certNumber}}',
  },
  {
    id: 'gold',
    name: 'Prestige Continental',
    borderColor: '#7B1639',
    accentColor: '#C8A951',
    headerText: 'AFRICAN UNION\nAU-IBAR — EXCELLENCE IN CAPACITY BUILDING',
    bodyText: 'CERTIFICATE OF PROFESSIONAL COMPETENCY\n\nThis certifies that\n\n{{learnerName}}\n\nhas demonstrated proficiency in\n\n{{courseName}}\n\nat the {{level}} level with a score of {{score}}%\n\nThis certificate validates the holder\'s competency in the subject matter.',
    footerText: 'AU-IBAR Headquarters, Nairobi — {{date}} — ID: {{certNumber}}',
  },
];

const uid = () => Math.random().toString(36).substring(2, 10);

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20';

// ---------------------------------------------------------------------------
// Certificate Preview
// ---------------------------------------------------------------------------

function CertPreview({ template }: { template: CertTemplate }) {
  const d = template.design;
  const level = LEVELS.find(l => l.value === template.level);

  return (
    <div
      className="relative bg-white rounded-lg shadow-lg overflow-hidden"
      style={{ aspectRatio: '1.414', border: `3px solid ${d.borderColor}` }}
    >
      {/* Inner border */}
      <div className="absolute inset-2 border rounded" style={{ borderColor: d.accentColor, borderWidth: '1px' }} />

      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-16 h-16" style={{ background: `linear-gradient(135deg, ${d.borderColor}20, transparent)` }} />
      <div className="absolute top-0 right-0 w-16 h-16" style={{ background: `linear-gradient(225deg, ${d.borderColor}20, transparent)` }} />
      <div className="absolute bottom-0 left-0 w-16 h-16" style={{ background: `linear-gradient(45deg, ${d.borderColor}20, transparent)` }} />
      <div className="absolute bottom-0 right-0 w-16 h-16" style={{ background: `linear-gradient(315deg, ${d.borderColor}20, transparent)` }} />

      <div className="relative z-10 h-full flex flex-col items-center justify-between p-6 text-center">
        {/* Header */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src="/au-logo.png" alt="" className="w-8 h-8 object-contain" />
            <div className="h-6 w-px" style={{ backgroundColor: d.borderColor }} />
            <span className="text-[7px] font-bold uppercase tracking-wider" style={{ color: d.borderColor }}>
              AU-IBAR Learning
            </span>
          </div>
          <p className="text-[6px] uppercase tracking-[0.2em] text-gray-500 whitespace-pre-line">
            {d.headerText}
          </p>
          <div className="mt-2 h-px w-20 mx-auto" style={{ backgroundColor: d.accentColor }} />
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col items-center justify-center py-2">
          {d.bodyText.split('\n').map((line, i) => {
            const isName = line.includes('{{learnerName}}');
            const isCourse = line.includes('{{courseName}}');
            const isTitle = line.includes('CERTIF') || line.includes('Certificate') || line.includes('CERTIFICAT');
            const display = line
              .replace('{{learnerName}}', 'Jean-Pierre DUPONT')
              .replace('{{courseName}}', 'Prise en main d\'ARIS')
              .replace('{{level}}', level?.label || 'Débutant')
              .replace('{{score}}', '85')
              .replace('{{date}}', '21 mai 2026')
              .replace('{{certNumber}}', 'AU-IBAR-2026-001234');

            if (!display.trim()) return <div key={i} className="h-1" />;
            return (
              <p
                key={i}
                className={clsx(
                  'leading-tight',
                  isTitle && 'text-[8px] font-bold uppercase tracking-widest mt-1',
                  isName && 'text-[10px] font-bold mt-1',
                  isCourse && 'text-[8px] font-semibold italic',
                  !isTitle && !isName && !isCourse && 'text-[6px]',
                )}
                style={{ color: isTitle || isName ? d.borderColor : isCourse ? d.accentColor : '#495057' }}
              >
                {display}
              </p>
            );
          })}
        </div>

        {/* Signatories */}
        {template.signatories.length > 0 && (
          <div className="flex items-end justify-center gap-8 mt-1">
            {template.signatories.map(sig => (
              <div key={sig.id} className="text-center">
                {sig.signatureUrl ? (
                  <img src={sig.signatureUrl} alt="" className="h-4 mx-auto mb-0.5 object-contain" />
                ) : (
                  <div className="h-4 w-12 mx-auto mb-0.5 border-b" style={{ borderColor: d.borderColor }} />
                )}
                <p className="text-[5px] font-bold" style={{ color: d.borderColor }}>{sig.name}</p>
                <p className="text-[4px] text-gray-500">{sig.title}</p>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-1">
          <div className="h-px w-32 mx-auto mb-1" style={{ backgroundColor: d.accentColor }} />
          <p className="text-[4px] text-gray-400">
            {d.footerText
              .replace('{{date}}', '21 mai 2026')
              .replace('{{certNumber}}', 'AU-IBAR-2026-001234')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signatory Editor
// ---------------------------------------------------------------------------

function SignatoryRow({ sig, onChange, onDelete }: { sig: Signatory; onChange: (s: Signatory) => void; onDelete: () => void }) {
  const handleSignature = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange({ ...sig, signatureUrl: ev.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-gray-50/50 dark:bg-gray-800/20">
      <div className="flex-1 grid grid-cols-2 gap-2">
        <input
          value={sig.name}
          onChange={e => onChange({ ...sig, name: e.target.value })}
          placeholder="Nom complet"
          className={inputClass}
        />
        <input
          value={sig.title}
          onChange={e => onChange({ ...sig, title: e.target.value })}
          placeholder="Fonction (ex: Directeur AU-IBAR)"
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2">
        {sig.signatureUrl ? (
          <img src={sig.signatureUrl} alt="" className="h-8 w-16 object-contain rounded border border-[var(--border)]" />
        ) : (
          <label className="px-2 py-1 rounded-lg text-[10px] font-medium border border-dashed border-[var(--border)] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]">
            Signature
            <input type="file" accept="image/*" className="hidden" onChange={handleSignature} />
          </label>
        )}
        <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CertificateManager() {
  const { token } = useAuth();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState<CertTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<CertTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/courses/certificate-templates', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates((data.data || []).map((t: any) => ({
          ...t,
          design: t.design || {},
          signatories: t.signatories || [],
        })));
      }
    } catch {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // New template from preset
  const createFromPreset = (preset: typeof PRESET_STYLES[0], level: string) => {
    const lvl = LEVELS.find(l => l.value === level);
    setEditing({
      name: `${preset.name} — ${lvl?.label || level}`,
      level,
      design: {
        style: preset.id,
        borderColor: preset.borderColor,
        accentColor: preset.accentColor,
        headerText: preset.headerText,
        bodyText: preset.bodyText,
        footerText: preset.footerText,
      },
      signatories: [
        { id: uid(), name: 'Prof. Ahmed A. Bahri', title: 'Director, AU-IBAR', signatureUrl: '' },
        { id: uid(), name: '', title: 'National Coordinator', signatureUrl: '' },
      ],
      is_default: false,
      is_active: true,
    });
    setView('edit');
  };

  const editTemplate = (t: CertTemplate) => {
    setEditing({ ...t });
    setView('edit');
  };

  const handleSave = async () => {
    if (!token || !editing) return;
    setSaving(true);
    try {
      const method = editing.id ? 'PUT' : 'POST';
      const url = editing.id
        ? `/api/courses/certificate-templates/${editing.id}`
        : '/api/courses/certificate-templates';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editing.name,
          level: editing.level,
          design: editing.design,
          signatories: editing.signatories,
          is_default: editing.is_default,
          is_active: editing.is_active,
        }),
      });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      toast.success(editing.id ? 'Template mis à jour' : 'Template créé');
      setView('list');
      setEditing(null);
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t: CertTemplate) => {
    if (!token || !t.id) return;
    const ok = await confirm({
      title: 'Supprimer ce template ?',
      message: `Le template « ${t.name} » sera définitivement supprimé.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!ok) return;
    try {
      await fetch(`/api/courses/certificate-templates/${t.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Template supprimé');
      fetchTemplates();
    } catch { toast.error('Erreur'); }
  };

  // ---- EDIT VIEW ----
  if (view === 'edit' && editing) {
    const d = editing.design;
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('list'); setEditing(null); }} className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            ← Retour
          </button>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {editing.id ? 'Modifier le template' : 'Nouveau template'}
          </h3>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Nom du template</label>
                  <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Niveau</label>
                  <select value={editing.level} onChange={e => setEditing({ ...editing, level: e.target.value })} className={inputClass}>
                    {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Couleur bordure</label>
                  <input type="color" value={d.borderColor} onChange={e => setEditing({ ...editing, design: { ...d, borderColor: e.target.value } })} className="w-full h-9 rounded-lg cursor-pointer border border-[var(--border)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Couleur accent</label>
                  <input type="color" value={d.accentColor} onChange={e => setEditing({ ...editing, design: { ...d, accentColor: e.target.value } })} className="w-full h-9 rounded-lg cursor-pointer border border-[var(--border)]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">En-tête</label>
                <input value={d.headerText} onChange={e => setEditing({ ...editing, design: { ...d, headerText: e.target.value } })} className={inputClass} />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Corps du certificat</label>
                <textarea
                  value={d.bodyText}
                  onChange={e => setEditing({ ...editing, design: { ...d, bodyText: e.target.value } })}
                  rows={8}
                  className={clsx(inputClass, 'resize-none font-mono text-xs')}
                  placeholder="Utilisez {{learnerName}}, {{courseName}}, {{level}}, {{score}}, {{date}}, {{certNumber}}"
                />
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  Variables : {'{{learnerName}}'} {'{{courseName}}'} {'{{level}}'} {'{{score}}'} {'{{date}}'} {'{{certNumber}}'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">Pied de page</label>
                <input value={d.footerText} onChange={e => setEditing({ ...editing, design: { ...d, footerText: e.target.value } })} className={inputClass} />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editing.is_default} onChange={e => setEditing({ ...editing, is_default: e.target.checked })} className="rounded" />
                  <Star className="w-3.5 h-3.5 text-brand-gold" /> Template par défaut
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editing.is_active} onChange={e => setEditing({ ...editing, is_active: e.target.checked })} className="rounded" />
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Actif
                </label>
              </div>
            </div>

            {/* Signatories */}
            <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">Signataires ({editing.signatories.length})</h4>
                <button
                  onClick={() => setEditing({ ...editing, signatories: [...editing.signatories, { id: uid(), name: '', title: '', signatureUrl: '' }] })}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900"
                >
                  <UserPlus className="w-3 h-3" /> Ajouter
                </button>
              </div>
              {editing.signatories.map((sig, i) => (
                <SignatoryRow
                  key={sig.id}
                  sig={sig}
                  onChange={updated => {
                    const sigs = [...editing.signatories];
                    sigs[i] = updated;
                    setEditing({ ...editing, signatories: sigs });
                  }}
                  onDelete={() => setEditing({ ...editing, signatories: editing.signatories.filter((_, j) => j !== i) })}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setView('list'); setEditing(null); }} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving || !editing.name} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 disabled:opacity-40">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {editing.id ? 'Enregistrer' : 'Créer le template'}
              </button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--text-secondary)]">Aperçu en direct</h4>
            <div className="sticky top-20">
              <CertPreview template={editing} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Templates de certificats ({templates.length})</h3>
      </div>

      {/* Preset models */}
      <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-5">
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">Créer depuis un modèle</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRESET_STYLES.map(preset => (
            <div key={preset.id} className="space-y-2">
              <div className="rounded-lg overflow-hidden border border-[var(--border)] aspect-[1.414]" style={{ background: `linear-gradient(135deg, ${preset.borderColor}10, ${preset.accentColor}10)` }}>
                <div className="h-full flex flex-col items-center justify-center p-3 text-center">
                  <div className="w-6 h-6 rounded-full mb-1" style={{ backgroundColor: preset.borderColor + '20' }}>
                    <Award className="w-6 h-6 p-1" style={{ color: preset.borderColor }} />
                  </div>
                  <p className="text-[8px] font-bold" style={{ color: preset.borderColor }}>{preset.name}</p>
                  <div className="h-px w-8 my-1" style={{ backgroundColor: preset.accentColor }} />
                  <p className="text-[6px] text-gray-400">Aperçu</p>
                </div>
              </div>
              <select
                onChange={e => { if (e.target.value) createFromPreset(preset, e.target.value); e.target.value = ''; }}
                className="w-full px-2 py-1.5 rounded-lg text-[10px] bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] cursor-pointer"
                defaultValue=""
              >
                <option value="">Choisir niveau...</option>
                {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Existing templates */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-secondary)]">
          <Award className="w-10 h-10 mx-auto opacity-20 mb-2" />
          <p className="text-sm">Aucun template. Créez-en un depuis les modèles ci-dessus.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => {
            const level = LEVELS.find(l => l.value === t.level);
            return (
              <div key={t.id} className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card overflow-hidden">
                {/* Mini preview */}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/30">
                  <div className="w-full" style={{ maxWidth: '200px', margin: '0 auto' }}>
                    <CertPreview template={t} />
                  </div>
                </div>
                {/* Info */}
                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-[var(--text-primary)] truncate">{t.name}</h4>
                    {t.is_default && <Star className="w-3 h-3 text-brand-gold fill-brand-gold shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white" style={{ backgroundColor: level?.color || '#1A5632' }}>
                      {level?.label || t.level}
                    </span>
                    <span className={clsx('text-[10px]', t.is_active ? 'text-green-500' : 'text-gray-400')}>
                      {t.is_active ? 'Actif' : 'Inactif'}
                    </span>
                    <span className="text-[10px] text-[var(--text-secondary)]">{t.signatories.length} signataire{t.signatories.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    <button onClick={() => editTemplate(t)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]">
                      <Edit3 className="w-3 h-3" /> Modifier
                    </button>
                    <button onClick={() => handleDelete(t)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
