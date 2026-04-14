import Link from 'next/link';
import { LayoutDashboard, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function MainNotFound() {
  const t = useTranslations('errors');

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="text-center max-w-md">
        {/* Large 404 */}
        <h1 className="font-display text-[6rem] leading-none tracking-tight bg-gradient-to-br from-brand-navy to-brand-gold bg-clip-text text-transparent dark:from-white dark:to-brand-gold">
          404
        </h1>

        <h2 className="text-xl font-bold text-[var(--text-primary)] mt-2">
          {t('notFound')}
        </h2>

        <p className="text-[var(--text-secondary)] mt-3 leading-relaxed text-sm">
          {t('notFoundDesc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 justify-center px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-brand-navy hover:bg-brand-navy-deep focus:outline-none focus:ring-2 focus:ring-brand-navy/50 focus:ring-offset-2 transition-all duration-200 dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark dark:focus:ring-brand-gold/50"
          >
            <LayoutDashboard className="w-4 h-4" />
            {t('returnDashboard')}
          </Link>
        </div>

        {/* Search suggestion */}
        <div className="mt-6 p-4 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Search className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{t('searchSuggestion')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
