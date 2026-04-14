'use client';
// ============================================================================
// Admin — User Form Modal (Create / Edit)
// ============================================================================
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editUser?: any;
}

export default function UserFormModal({ open, onClose, onSuccess, editUser }: Props) {
  const { token } = useAuth();
  const isEdit = !!editUser;
  const t = useTranslations('admin.userForm');
  const t_roles = useTranslations('roles');
  const t_languages = useTranslations('languages');
  const t_common = useTranslations('common');

  const ROLES = [
    { value: 'learner', label: t_roles('learner') },
    { value: 'trainer', label: t_roles('trainer') },
    { value: 'admin_country', label: t_roles('admin_country') },
    { value: 'admin_rec', label: t_roles('admin_rec') },
    { value: 'admin_continental', label: t_roles('admin_continental') },
  ];

  const LANGUAGES = [
    { value: 'en', label: t_languages('en') },
    { value: 'fr', label: t_languages('fr') },
    { value: 'ar', label: t_languages('ar') },
    { value: 'pt', label: t_languages('pt') },
  ];

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('learner');
  const [tenantId, setTenantId] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tenant cascading selects
  const [tenants, setTenants] = useState<any[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<'continental' | 'rec' | 'country'>('country');
  const [selectedRec, setSelectedRec] = useState('');

  // Load tenants on open
  useEffect(() => {
    if (!open || !token) return;
    adminApi.tenants(token)
      .then((res: any) => setTenants(res.data || []))
      .catch(() => setTenants([]));
  }, [open, token]);

  // Populate form when editing
  useEffect(() => {
    if (editUser) {
      setFirstName(editUser.first_name || '');
      setLastName(editUser.last_name || '');
      setEmail(editUser.email || '');
      setRole(editUser.role || 'learner');
      setTenantId(editUser.tenant_id || '');
      setPreferredLanguage(editUser.preferred_language || 'en');
      setIsActive(editUser.is_active ?? true);
    } else {
      setFirstName('');
      setLastName('');
      setEmail('');
      setRole('learner');
      setTenantId('');
      setPreferredLanguage('en');
      setIsActive(true);
      setSelectedLevel('country');
      setSelectedRec('');
    }
  }, [editUser, open]);

  const continentalTenants = tenants.filter(tn => tn.level === 'continental');
  const recTenants = tenants.filter(tn => tn.level === 'rec');
  const countryTenants = tenants.filter(tn =>
    tn.level === 'country' && (!selectedRec || tn.parent_id === selectedRec),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !tenantId) {
      toast.error(t('allFieldsRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        role,
        tenant_id: tenantId,
        preferred_language: preferredLanguage,
        is_active: isActive,
      };

      if (isEdit) {
        await adminApi.updateUser(token, editUser.id, payload);
        toast.success(t('updated'));
      } else {
        await adminApi.createUser(token, payload);
        toast.success(t('created'));
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputClass = clsx(
    'w-full px-3 py-2 rounded-lg text-sm',
    'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
    'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
    'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={clsx(
        'relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl p-6',
        'bg-white dark:bg-surface-dark-card border border-[var(--border)] shadow-xl',
      )}>
        <button onClick={onClose} className="absolute top-4 right-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">
          {isEdit ? t('editTitle') : t('newTitle')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('firstName')}</label>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className={inputClass} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('lastName')}</label>
              <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className={inputClass} required />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} required disabled={isEdit} />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('role')}</label>
            <select value={role} onChange={e => setRole(e.target.value)} className={inputClass}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Tenant — cascading selects */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">{t('tenant')}</label>

            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setSelectedLevel('continental')}
                className={clsx('px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  selectedLevel === 'continental' ? 'bg-brand-navy text-white border-brand-navy dark:bg-brand-gold dark:text-gray-900' : 'border-[var(--border)] text-[var(--text-secondary)]'
                )}>{t('continental')}</button>
              <button type="button" onClick={() => setSelectedLevel('rec')}
                className={clsx('px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  selectedLevel === 'rec' ? 'bg-brand-navy text-white border-brand-navy dark:bg-brand-gold dark:text-gray-900' : 'border-[var(--border)] text-[var(--text-secondary)]'
                )}>{t('rec')}</button>
              <button type="button" onClick={() => setSelectedLevel('country')}
                className={clsx('px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  selectedLevel === 'country' ? 'bg-brand-navy text-white border-brand-navy dark:bg-brand-gold dark:text-gray-900' : 'border-[var(--border)] text-[var(--text-secondary)]'
                )}>{t('country')}</button>
            </div>

            {selectedLevel === 'continental' && (
              <select value={tenantId} onChange={e => setTenantId(e.target.value)} className={inputClass}>
                <option value="">{t('selectContinental')}</option>
                {continentalTenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name}</option>)}
              </select>
            )}

            {selectedLevel === 'rec' && (
              <select value={tenantId} onChange={e => setTenantId(e.target.value)} className={inputClass}>
                <option value="">{t('selectRec')}</option>
                {recTenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name}</option>)}
              </select>
            )}

            {selectedLevel === 'country' && (
              <>
                <select value={selectedRec} onChange={e => { setSelectedRec(e.target.value); setTenantId(''); }} className={inputClass}>
                  <option value="">{t('allRecs')}</option>
                  {recTenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name}</option>)}
                </select>
                <select value={tenantId} onChange={e => setTenantId(e.target.value)} className={inputClass}>
                  <option value="">{t('selectCountry')}</option>
                  {countryTenants.map(tn => <option key={tn.id} value={tn.id}>{tn.name} ({tn.code})</option>)}
                </select>
              </>
            )}
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">{t('preferredLanguage')}</label>
            <select value={preferredLanguage} onChange={e => setPreferredLanguage(e.target.value)} className={inputClass}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
            <span className="text-sm text-[var(--text-primary)]">{t('active')}</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800">
              {t_common('cancel')}
            </button>
            <button type="submit" disabled={saving}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors',
                'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                'disabled:opacity-40',
              )}>
              {saving ? t('saving') : isEdit ? t('update') : t_common('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
