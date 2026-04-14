'use client';
// ============================================================================
// AU-IBAR Learning — Live Sessions Panel
// Upcoming / in-progress live sessions sidebar panel
// ============================================================================
import clsx from 'clsx';
import { Video, Calendar, Radio } from 'lucide-react';

interface LivePanelProps {
  sessions: any[];
  isLoading: boolean;
}

export default function LivePanel({ sessions, isLoading }: LivePanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4 space-y-3">
        <div className="h-5 w-28 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const sorted = [...sessions].sort((a: any, b: any) => {
    const aLive = a.status === 'live' ? 0 : 1;
    const bLive = b.status === 'live' ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    return new Date(a.startTime ?? a.start_time).getTime() - new Date(b.startTime ?? b.start_time).getTime();
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Video className="w-4 h-4 text-brand-gold" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sessions live</h3>
      </div>

      {sorted.length === 0 ? (
        <div className="py-6 text-center">
          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Video className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Aucune session programmée
          </p>
          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 opacity-70">
            Les prochaines sessions apparaîtront ici
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.slice(0, 4).map((session: any) => (
            <SessionItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

function SessionItem({ session }: { session: any }) {
  const isLive = session.status === 'live';
  const title = typeof session.title === 'object'
    ? (session.title.fr || session.title.en || Object.values(session.title)[0])
    : (session.title ?? session.name ?? 'Session');
  const startTime = session.startTime ?? session.start_time;
  const formattedTime = startTime
    ? new Date(startTime).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
        isLive
          ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30'
          : 'bg-gray-50 dark:bg-gray-800/40 hover:bg-gray-100 dark:hover:bg-gray-800/60',
      )}
    >
      <div
        className={clsx(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          isLive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-brand-navy/5 dark:bg-green-900/20',
        )}
      >
        {isLive ? (
          <Radio className="w-4 h-4 text-red-500 animate-pulse" />
        ) : (
          <Calendar className="w-4 h-4 text-brand-navy dark:text-green-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{title}</p>
        <p className="text-[10px] text-[var(--text-secondary)]">
          {isLive ? (
            <span className="text-red-500 font-semibold">En direct</span>
          ) : (
            formattedTime
          )}
        </p>
      </div>
      {isLive && (
        <button className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors flex-shrink-0">
          Rejoindre
        </button>
      )}
    </div>
  );
}
