import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  const t = useTranslations('errors');

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[var(--bg-primary)] relative overflow-hidden">
      {/* Watermark logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-[0.04] dark:opacity-[0.03]">
        <Image
          src="/logo-topnet.jpg"
          alt=""
          width={400}
          height={400}
          className="w-[24rem] h-[24rem] object-contain"
        />
      </div>

      <div className="relative z-10 text-center max-w-md">
        {/* Large 404 number */}
        <h1 className="font-display text-[8rem] leading-none tracking-tight bg-gradient-to-br from-brand-navy via-brand-navy to-brand-gold bg-clip-text text-transparent dark:from-white dark:via-brand-gold dark:to-brand-gold">
          404
        </h1>

        <h2 className="text-2xl font-bold text-[var(--text-primary)] mt-2">
          {t('notFound')}
        </h2>

        <p className="text-[var(--text-secondary)] mt-3 leading-relaxed">
          {t('notFoundDesc')}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 justify-center px-6 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-brand-navy to-brand-navy-deep hover:from-brand-navy-deep hover:to-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-navy/50 focus:ring-offset-2 transition-all duration-200 dark:from-brand-gold dark:to-brand-gold-dark dark:text-gray-900 dark:hover:from-brand-gold-dark dark:hover:to-brand-gold"
          >
            <Home className="w-4 h-4" />
            {t('goHome')}
          </Link>
        </div>

        {/* Search suggestion */}
        <div className="mt-8 p-4 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <Search className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm">{t('searchSuggestion')}</p>
          </div>
        </div>

        <p className="mt-12 text-xs text-[var(--text-secondary)]/60">
          Topnet Solutions Academy
        </p>
      </div>
    </div>
  );
}
