'use client';
// ============================================================================
// AU-IBAR Learning — StudyGroupsTab
// Grid of study groups: join, create, leave
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Plus, UserPlus, UserMinus, X, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { communityApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalizedText(text: Record<string, string> | string | undefined, lang: string = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StudyGroupsTab() {
  const { token } = useAuth();
  const { language } = useAuthStore();
  const t = useTranslations('studyGroups');
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [maxMembers, setMaxMembers] = useState(20);
  const [creating, setCreating] = useState(false);

  const fetchGroups = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await communityApi.listGroups(token, { limit: 50 });
      setGroups(res.data || []);
    } catch {
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const handleCreate = async () => {
    if (!token || !groupName.trim()) return;
    setCreating(true);
    try {
      await communityApi.createGroup(token, {
        name: { fr: groupName },
        description: groupDesc ? { fr: groupDesc } : undefined,
        maxMembers,
        isPublic: true,
        tags: [],
      });
      toast.success(t('created'));
      setShowCreate(false);
      setGroupName('');
      setGroupDesc('');
      fetchGroups();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (groupId: string) => {
    if (!token) return;
    try {
      await communityApi.joinGroup(token, groupId);
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, is_member: true, member_count: (g.member_count || 0) + 1 } : g,
      ));
      toast.success(t('joined'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const handleLeave = async (groupId: string) => {
    if (!token) return;
    try {
      await communityApi.leaveGroup(token, groupId);
      setGroups(prev => prev.map(g =>
        g.id === groupId ? { ...g, is_member: false, member_count: Math.max(0, (g.member_count || 1) - 1) } : g,
      ));
      toast.success(t('left'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
  };

  const inputClass = clsx(
    'w-full px-3 py-2 rounded-lg text-sm',
    'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
    'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
    'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-brand-navy text-white hover:bg-brand-navy-deep',
            'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
          )}
        >
          <Plus className="w-4 h-4" /> {t('createBtn')}
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={clsx(
              'rounded-xl p-5 border border-[var(--border)]',
              'bg-white dark:bg-surface-dark-card',
            )}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('newGroup')}</h3>
              <button onClick={() => setShowCreate(false)} className="text-[var(--text-secondary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder={t('namePlaceholder')}
                className={inputClass}
              />
              <textarea
                value={groupDesc}
                onChange={e => setGroupDesc(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={2}
                className={clsx(inputClass, 'resize-none')}
              />
              <div className="flex items-center gap-3">
                <div>
                  <label className="block text-xs text-[var(--text-secondary)] mb-1">{t('maxMembers')}</label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={maxMembers}
                    onChange={e => setMaxMembers(Number(e.target.value))}
                    className={clsx(inputClass, 'w-20')}
                  />
                </div>
                <button
                  onClick={handleCreate}
                  disabled={creating || !groupName.trim()}
                  className={clsx(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium mt-4',
                    'bg-brand-navy text-white hover:bg-brand-navy-deep',
                    'dark:bg-brand-gold dark:text-gray-900',
                    'disabled:opacity-40',
                  )}
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t('create')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className={clsx(
          'rounded-xl p-8 text-center',
          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
        )}>
          <Users className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-30 mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">{t('none')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.map(group => (
            <div
              key={group.id}
              className={clsx(
                'rounded-xl p-4 border border-[var(--border)]',
                'bg-white dark:bg-surface-dark-card',
                group.is_member && 'ring-2 ring-brand-navy/20 dark:ring-brand-gold/20',
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                    group.is_member
                      ? 'bg-brand-navy/10 dark:bg-brand-gold/20'
                      : 'bg-gray-100 dark:bg-gray-800',
                  )}>
                    <Users className={clsx(
                      'w-5 h-5',
                      group.is_member
                        ? 'text-brand-navy dark:text-brand-gold'
                        : 'text-[var(--text-secondary)]',
                    )} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                      {getLocalizedText(group.name, language)}
                    </h4>
                    {group.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                        {getLocalizedText(group.description, language)}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {t('memberCount', { count: group.member_count || 0, max: group.max_members || 20 })}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {t('createdBy', { name: `${group.creator_first_name} ${group.creator_last_name}` })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                {group.is_member ? (
                  <button
                    onClick={() => handleLeave(group.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <UserMinus className="w-3.5 h-3.5" /> {t('leave')}
                  </button>
                ) : (
                  <button
                    onClick={() => handleJoin(group.id)}
                    disabled={(group.member_count || 0) >= (group.max_members || 20)}
                    className={clsx(
                      'flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium',
                      'bg-brand-navy/10 text-brand-navy hover:bg-brand-navy/20',
                      'dark:bg-brand-gold/20 dark:text-brand-gold dark:hover:bg-brand-gold/30',
                      'disabled:opacity-40 disabled:cursor-not-allowed',
                    )}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> {t('join')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
