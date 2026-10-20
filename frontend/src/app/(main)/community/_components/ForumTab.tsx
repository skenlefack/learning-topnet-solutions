'use client';
// ============================================================================
// Topnet Solutions Academy — ForumTab
// Discussions list with categories, new post modal, nested replies
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MessageCircle, Plus, ThumbsUp, ChevronRight,
  Send, X, Loader2,
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

function timeAgo(dateStr: string, t_time: (key: string, values?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t_time('instant');
  if (mins < 60) return t_time('minutes', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t_time('hours', { count: hours });
  const days = Math.floor(hours / 24);
  return t_time('days', { count: days });
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ForumTab() {
  const { token } = useAuth();
  const { language } = useAuthStore();
  const t = useTranslations('forum');
  const t_time = useTranslations('timeAgo');

  const CATEGORIES = [
    { value: '', label: t('allCategories') },
    { value: 'general', label: t('general') },
    { value: 'questions', label: t('questions') },
    { value: 'resources', label: t('resources') },
    { value: 'announcements', label: t('announcements') },
  ];
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [showNewPost, setShowNewPost] = useState(false);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, any[]>>({});

  // New post form
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [posting, setPosting] = useState(false);

  // Reply form
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await communityApi.listPosts(token, { category: category || undefined, limit: 30 });
      setPosts(res.data || []);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token, category]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const handleCreatePost = async () => {
    if (!token || !newBody.trim()) return;
    setPosting(true);
    try {
      await communityApi.createPost(token, {
        title: newTitle ? { fr: newTitle } : undefined,
        body: { fr: newBody },
        category: newCategory,
      });
      toast.success(t('postCreated'));
      setShowNewPost(false);
      setNewTitle('');
      setNewBody('');
      fetchPosts();
    } catch (err: any) {
      toast.error(err.message || t('error'));
    } finally {
      setPosting(false);
    }
  };

  const handleUpvote = async (postId: string) => {
    if (!token) return;
    try {
      const res: any = await communityApi.upvote(token, postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, upvotes: res.data?.upvotes ?? p.upvotes + 1 } : p));
    } catch { /* ignore */ }
  };

  const handleExpand = async (postId: string) => {
    if (expandedPost === postId) {
      setExpandedPost(null);
      return;
    }
    setExpandedPost(postId);
    if (!replies[postId] && token) {
      try {
        const res: any = await communityApi.listReplies(token, postId);
        setReplies(prev => ({ ...prev, [postId]: res.data || [] }));
      } catch { /* ignore */ }
    }
  };

  const handleReply = async (postId: string) => {
    if (!token || !replyText.trim()) return;
    try {
      await communityApi.createPost(token, {
        body: { fr: replyText },
        parentId: postId,
        category: 'general',
      });
      setReplyText('');
      setReplyingTo(null);
      // Refresh replies
      const res: any = await communityApi.listReplies(token, postId);
      setReplies(prev => ({ ...prev, [postId]: res.data || [] }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, reply_count: (p.reply_count || 0) + 1 } : p));
    } catch (err: any) {
      toast.error(err.message || t('error'));
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors',
                category === c.value
                  ? 'bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900'
                  : 'text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewPost(true)}
          className={clsx(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium',
            'bg-brand-navy text-white hover:bg-brand-navy-deep',
            'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
          )}
        >
          <Plus className="w-4 h-4" /> {t('newDiscussion')}
        </button>
      </div>

      {/* New post form */}
      {showNewPost && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={clsx(
            'rounded-xl p-5 border border-[var(--border)]',
            'bg-white dark:bg-surface-dark-card',
          )}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">{t('newDiscussion')}</h3>
            <button onClick={() => setShowNewPost(false)} className="text-[var(--text-secondary)]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className={clsx(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
              )}
            />
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder={t('messagePlaceholder')}
              rows={3}
              className={clsx(
                'w-full px-3 py-2 rounded-lg text-sm resize-none',
                'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
              )}
            />
            <div className="flex items-center justify-between">
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs',
                  'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                  'text-[var(--text-primary)]',
                )}
              >
                {CATEGORIES.filter(c => c.value).map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <button
                onClick={handleCreatePost}
                disabled={posting || !newBody.trim()}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium',
                  'bg-brand-navy text-white hover:bg-brand-navy-deep',
                  'dark:bg-brand-gold dark:text-gray-900',
                  'disabled:opacity-40',
                )}
              >
                {posting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {t('publish')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Posts list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className={clsx(
          'rounded-xl p-8 text-center',
          'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
        )}>
          <MessageCircle className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-30 mb-2" />
          <p className="text-sm text-[var(--text-secondary)]">{t('noDiscussions')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <div
              key={post.id}
              className={clsx(
                'rounded-xl border border-[var(--border)] overflow-hidden',
                'bg-white dark:bg-surface-dark-card',
              )}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-brand-navy text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                    {(post.author_first_name?.[0] || '')}{(post.author_last_name?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)]">
                        {post.author_first_name} {post.author_last_name}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 dark:bg-gray-800 text-[var(--text-secondary)]">
                        {post.category}
                      </span>
                      <span className="text-[10px] text-[var(--text-secondary)]">
                        {post.created_at ? timeAgo(post.created_at, t_time) : ''}
                      </span>
                    </div>
                    {post.title && (
                      <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-1">
                        {getLocalizedText(post.title, language)}
                      </h4>
                    )}
                    <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-3">
                      {getLocalizedText(post.body, language)}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      <button
                        onClick={() => handleUpvote(post.id)}
                        className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-brand-navy dark:hover:text-brand-gold"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> {post.upvotes || 0}
                      </button>
                      <button
                        onClick={() => handleExpand(post.id)}
                        className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-brand-navy dark:hover:text-brand-gold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" /> {post.reply_count || 0} {t('replies')}
                        <ChevronRight className={clsx(
                          'w-3 h-3 transition-transform',
                          expandedPost === post.id && 'rotate-90',
                        )} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Replies */}
              {expandedPost === post.id && (
                <div className="border-t border-[var(--border)] bg-gray-50/50 dark:bg-gray-800/20">
                  {(replies[post.id] || []).map(r => (
                    <div key={r.id} className="px-4 py-3 border-b border-[var(--border)] last:border-b-0 ml-8">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-primary)]">
                          {r.author_first_name} {r.author_last_name}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {r.created_at ? timeAgo(r.created_at, t_time) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {getLocalizedText(r.body, language)}
                      </p>
                    </div>
                  ))}

                  {/* Reply input */}
                  <div className="px-4 py-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={replyingTo === post.id ? replyText : ''}
                      onFocus={() => setReplyingTo(post.id)}
                      onChange={e => { setReplyingTo(post.id); setReplyText(e.target.value); }}
                      onKeyDown={e => { if (e.key === 'Enter' && replyText.trim()) handleReply(post.id); }}
                      placeholder={t('replyPlaceholder')}
                      className={clsx(
                        'flex-1 px-3 py-1.5 rounded-lg text-xs',
                        'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                        'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                        'focus:outline-none focus:ring-2 focus:ring-brand-navy/20',
                      )}
                    />
                    <button
                      onClick={() => handleReply(post.id)}
                      disabled={!replyText.trim() || replyingTo !== post.id}
                      className="p-1.5 rounded-lg bg-brand-navy text-white dark:bg-brand-gold dark:text-gray-900 disabled:opacity-40"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
