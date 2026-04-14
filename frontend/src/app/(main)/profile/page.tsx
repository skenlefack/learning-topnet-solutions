'use client';
// ============================================================================
// AU-IBAR Learning — Profile Page
// Avatar upload, editable fields, read-only info, save
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Camera, Save, Loader2, Shield, MapPin } from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { profileApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Languages dropdown options
// ---------------------------------------------------------------------------

const LANGUAGE_CODES = ['fr', 'en', 'ar', 'pt'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const { token, user } = useAuth();
  const setAuth = useAuthStore((s) => s.setAuth);
  const t_profile = useTranslations('profile');
  const t_roles = useTranslations('roles');
  const t_languages = useTranslations('languages');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Editable fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'fr' | 'en' | 'ar' | 'pt'>('fr');

  // Avatar
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await profileApi.me(token);
      const data = res.data;
      setProfile(data);
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setPreferredLanguage(data.preferred_language || 'fr');
      setAvatarPreview(data.avatar_url || null);
    } catch {
      toast.error(t_profile('loadError'));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  // Save profile
  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res: any = await profileApi.update(token, {
        firstName,
        lastName,
        preferredLanguage,
      });

      // Update Zustand store so Header reflects changes immediately
      if (user) {
        setAuth(
          {
            ...user,
            firstName,
            lastName,
            preferredLanguage,
          },
          token,
        );
      }

      toast.success(t_profile('updated'));
      setProfile(res.data);
    } catch (err: any) {
      toast.error(err.message || t_profile('saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Upload avatar
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    // Preview
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingAvatar(true);
    try {
      const res: any = await profileApi.uploadAvatar(token, file);
      setAvatarPreview(res.data?.avatar_url || avatarPreview);

      // Update Zustand store
      if (user) {
        setAuth({ ...user, avatarUrl: res.data?.avatar_url }, token);
      }

      toast.success(t_profile('avatarUpdated'));
    } catch (err: any) {
      toast.error(err.message || t_profile('uploadError'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Initials
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : 'AA';


  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto animate-pulse">
        <div className="h-8 w-48 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="rounded-xl p-6 bg-white dark:bg-surface-dark-card border border-[var(--border)]">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-4 w-60 rounded bg-gray-100 dark:bg-gray-800/50" />
            </div>
          </div>
          <div className="mt-8 space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800/50" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-2xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t_profile('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t_profile('subtitle')}
        </p>
      </motion.div>

      {/* Profile card */}
      <motion.div
        variants={fadeUp}
        className={clsx(
          'rounded-xl p-6 border border-[var(--border)]',
          'bg-white dark:bg-surface-dark-card',
        )}
      >
        {/* Avatar section */}
        <div className="flex items-center gap-6 mb-8">
          <div className="relative group">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Avatar"
                className="w-24 h-24 rounded-full object-cover border-2 border-[var(--border)]"
              />
            ) : (
              <div className={clsx(
                'w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold',
                'bg-brand-navy text-white',
              )}>
                {initials}
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className={clsx(
                'absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center',
                'bg-brand-gold text-brand-navy-deep shadow-lg',
                'hover:bg-brand-gold-dark transition-colors',
                'disabled:opacity-50',
              )}
            >
              {uploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {firstName} {lastName}
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              {profile?.email}
            </p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t_profile('firstName')}
              </label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2.5 rounded-lg text-sm',
                  'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                  'text-[var(--text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
                  'focus:border-brand-navy dark:focus:border-brand-gold',
                )}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
                {t_profile('lastName')}
              </label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className={clsx(
                  'w-full px-3 py-2.5 rounded-lg text-sm',
                  'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                  'text-[var(--text-primary)]',
                  'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
                  'focus:border-brand-navy dark:focus:border-brand-gold',
                )}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {t_profile('preferredLanguage')}
            </label>
            <select
              value={preferredLanguage}
              onChange={e => setPreferredLanguage(e.target.value as any)}
              className={clsx(
                'w-full px-3 py-2.5 rounded-lg text-sm',
                'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                'text-[var(--text-primary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
              )}
            >
              {LANGUAGE_CODES.map(code => (
                <option key={code} value={code}>{t_languages(code)}</option>
              ))}
            </select>
          </div>

          {/* Read-only fields */}
          <div className="border-t border-[var(--border)] pt-4 mt-4">
            <h3 className="text-xs font-semibold uppercase text-[var(--text-secondary)] mb-3">
              {t_profile('accountInfo')}
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{t_profile('email')}</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {profile?.email}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-[var(--text-secondary)]">{t_profile('role')}</span>
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                  'bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-brand-gold',
                )}>
                  <Shield className="w-3 h-3" />
                  {t_roles(profile?.role || 'learner')}
                </span>
              </div>
              {profile?.tenant && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">{t_profile('organization')}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
                    <MapPin className="w-3 h-3 text-[var(--text-secondary)]" />
                    {profile.tenant.name}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Save button */}
          <div className="pt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className={clsx(
                'flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium',
                'bg-brand-navy text-white hover:bg-brand-navy-deep',
                'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                'transition-colors disabled:opacity-50',
              )}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {t_profile('save')}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
