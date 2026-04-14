'use client';
// ============================================================================
// AU-IBAR Learning — NotificationDropdown
// Bell icon with unread count badge, dropdown with scrollable notification list
// Uses SWR-style polling every 30s for unread count
// ============================================================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, BookOpen, Award, Video, Info } from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/lib/store';
import { notificationApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalizedText(text: Record<string, string> | string | undefined, lang: string = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'A l\'instant';
  if (mins < 60) return `Il y a ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  enrollment: BookOpen,
  certification: Award,
  live_started: Video,
  system: Info,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function NotificationDropdown() {
  const { token, language } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Poll unread count every 30s
  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const res: any = await notificationApi.unreadCount(token);
      setUnreadCount(res.data?.count || 0);
    } catch {
      // silently fail
    }
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Fetch notifications when dropdown opens
  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await notificationApi.list(token, { limit: 20 });
      setNotifications(res.data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    try {
      await notificationApi.markRead(token, id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    if (!token) return;
    try {
      await notificationApi.markAllRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-surface-dark-card">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'absolute right-0 top-full mt-1 w-80 rounded-xl shadow-lg overflow-hidden',
              'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 text-xs text-brand-navy dark:text-brand-gold hover:underline"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tout lire
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-secondary)]">
                  Aucune notification
                </div>
              ) : (
                notifications.map(notif => {
                  const Icon = TYPE_ICONS[notif.type] || Bell;
                  return (
                    <button
                      key={notif.id}
                      onClick={() => { if (!notif.is_read) handleMarkRead(notif.id); }}
                      className={clsx(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                        'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                        !notif.is_read && 'bg-brand-navy/5 dark:bg-brand-gold/5',
                      )}
                    >
                      <div className={clsx(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        !notif.is_read
                          ? 'bg-brand-navy/10 dark:bg-brand-gold/20'
                          : 'bg-gray-100 dark:bg-gray-800',
                      )}>
                        <Icon className={clsx(
                          'w-4 h-4',
                          !notif.is_read
                            ? 'text-brand-navy dark:text-brand-gold'
                            : 'text-[var(--text-secondary)]',
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={clsx(
                          'text-xs leading-snug',
                          !notif.is_read
                            ? 'font-semibold text-[var(--text-primary)]'
                            : 'text-[var(--text-secondary)]',
                        )}>
                          {getLocalizedText(notif.title, language)}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate">
                          {getLocalizedText(notif.body, language)}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 opacity-60">
                          {notif.created_at ? timeAgo(notif.created_at) : ''}
                        </p>
                      </div>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand-navy dark:bg-brand-gold shrink-0 mt-2" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
