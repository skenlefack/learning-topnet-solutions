'use client';
// ============================================================================
// AU-IBAR Learning — Community Page
// 3 tabs: Forum, Classement, Groupes d'etude
// ============================================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, TrendingUp, Users } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import ForumTab from './_components/ForumTab';
import LeaderboardTab from './_components/LeaderboardTab';
import StudyGroupsTab from './_components/StudyGroupsTab';

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
// Component
// ---------------------------------------------------------------------------

type CommunityTab = 'forum' | 'leaderboard' | 'groups';

const useTabs = (t: ReturnType<typeof useTranslations>): { key: CommunityTab; label: string; icon: typeof MessageCircle }[] => [
  { key: 'forum', label: t('discussions'), icon: MessageCircle },
  { key: 'leaderboard', label: t('leaderboard'), icon: TrendingUp },
  { key: 'groups', label: t('studyGroups'), icon: Users },
];

export default function CommunityPage() {
  const t = useTranslations('community');
  const TABS = useTabs(t);
  const [tab, setTab] = useState<CommunityTab>('forum');

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t('title')}</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {t('subtitle')}
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={fadeUp} className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px">
        {TABS.map(item => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === item.key
                ? 'border-brand-navy dark:border-brand-gold text-brand-navy dark:text-brand-gold'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </button>
        ))}
      </motion.div>

      {/* Tab content */}
      <motion.div variants={fadeUp}>
        {tab === 'forum' && <ForumTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'groups' && <StudyGroupsTab />}
      </motion.div>
    </motion.div>
  );
}
