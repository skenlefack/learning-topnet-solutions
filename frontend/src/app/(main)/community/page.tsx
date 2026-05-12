'use client';
// ============================================================================
// AU-IBAR Learning — Community Page
// Full-page layout: hero header, 3 tabs (Forum, Leaderboard, Study Groups)
// ============================================================================
import { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, TrendingUp, Users } from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import ForumTab from './_components/ForumTab';
import LeaderboardTab from './_components/LeaderboardTab';
import StudyGroupsTab from './_components/StudyGroupsTab';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

type CommunityTab = 'forum' | 'leaderboard' | 'groups';

export default function CommunityPage() {
  const t = useTranslations('community');
  const [tab, setTab] = useState<CommunityTab>('forum');

  const TABS: { key: CommunityTab; label: string; icon: typeof MessageCircle }[] = [
    { key: 'forum', label: t('discussions'), icon: MessageCircle },
    { key: 'leaderboard', label: t('leaderboard'), icon: TrendingUp },
    { key: 'groups', label: t('studyGroups'), icon: Users },
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="space-y-0 max-w-7xl mx-auto -mt-4 lg:-mt-6"
    >
      {/* ── Hero header ── */}
      <motion.div
        variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy via-brand-navy to-brand-navy-deep px-6 py-8 lg:px-8 lg:py-10"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-brand-gold/[0.06]" />
          <div className="absolute -left-8 bottom-0 w-48 h-48 rounded-full bg-white/[0.03]" />
        </div>

        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold text-white">{t('title')}</h1>
          <p className="text-sm text-green-100/70 mt-1 max-w-xl">{t('subtitle')}</p>

          {/* Tabs inside hero */}
          <div className="flex gap-2 mt-6">
            {TABS.map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                  tab === item.key
                    ? 'bg-brand-gold text-gray-900'
                    : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/10',
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Tab content ── */}
      <motion.div variants={fadeUp} className="pt-6">
        {tab === 'forum' && <ForumTab />}
        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'groups' && <StudyGroupsTab />}
      </motion.div>
    </motion.div>
  );
}
