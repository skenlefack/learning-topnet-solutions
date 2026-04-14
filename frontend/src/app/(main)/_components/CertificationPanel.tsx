'use client';
// ============================================================================
// AU-IBAR Learning — Certification Panel
// Sidebar panel showing certification progress & issued certificates
// ============================================================================
import Link from 'next/link';
import clsx from 'clsx';
import { Award, CheckCircle, Clock, Lock, ExternalLink } from 'lucide-react';

interface CertificationPanelProps {
  certifications: any[];
  enrollments: any[];
  isLoading: boolean;
}

const CERT_LEVELS = [
  { key: 'foundation', label: 'Foundation', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { key: 'intermediate', label: 'Intermediate', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'advanced', label: 'Advanced', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'expert', label: 'Expert', color: 'text-brand-gold', bg: 'bg-brand-gold-pale dark:bg-yellow-900/20' },
];

export default function CertificationPanel({ certifications, enrollments, isLoading }: CertificationPanelProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4 space-y-3">
        <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  const certMap = new Map<string, any>();
  certifications.forEach((c: any) => {
    const level = c.level ?? c.certLevel ?? c.cert_level;
    if (level) certMap.set(level, c);
  });

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Award className="w-4 h-4 text-brand-gold" />
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Certifications ARIS</h3>
      </div>

      <div className="space-y-2">
        {CERT_LEVELS.map((level, idx) => {
          const cert = certMap.get(level.key);
          const status = cert?.status;
          const isIssued = status === 'issued' || status === 'passed';
          const isInProgress = status === 'in_progress' || status === 'pending';
          const prevLevel = idx > 0 ? CERT_LEVELS[idx - 1] : null;
          const prevCert = prevLevel ? certMap.get(prevLevel.key) : null;
          const prevDone = !prevLevel || prevCert?.status === 'issued' || prevCert?.status === 'passed';
          const isLocked = idx > 0 && !prevDone && !isIssued && !isInProgress;

          return (
            <div
              key={level.key}
              className={clsx(
                'flex items-center gap-3 p-2.5 rounded-lg transition-colors',
                isLocked ? 'opacity-50' : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40',
              )}
            >
              <div
                className={clsx(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                  isIssued ? 'bg-emerald-100 dark:bg-emerald-900/30' : level.bg,
                )}
              >
                {isIssued ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : isLocked ? (
                  <Lock className="w-4 h-4 text-gray-400" />
                ) : isInProgress ? (
                  <Clock className="w-4 h-4 text-brand-gold" />
                ) : (
                  <Award className={clsx('w-4 h-4', level.color)} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  'text-xs font-medium',
                  isLocked ? 'text-gray-400 dark:text-gray-600' : 'text-[var(--text-primary)]',
                )}>
                  {level.label}
                </p>
                {isIssued ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <CheckCircle className="w-2.5 h-2.5" /> Obtenue
                  </span>
                ) : (
                  <p className="text-[10px] text-[var(--text-secondary)]">
                    {isInProgress
                      ? 'En cours'
                      : isLocked
                        ? 'Verrouillée'
                        : 'Disponible'}
                  </p>
                )}
              </div>
              {isIssued && cert?.issuedAt && (
                <span className="text-[10px] text-[var(--text-secondary)] flex-shrink-0">
                  {new Date(cert.issuedAt).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-2 border-t border-[var(--border)] space-y-2">
        {certifications.length > 0 && (
          <p className="text-[10px] text-[var(--text-secondary)] text-center">
            {certifications.filter((c: any) => c.status === 'issued' || c.status === 'passed').length} / {CERT_LEVELS.length} certifications obtenues
          </p>
        )}
        <Link
          href="/certificates"
          className="flex items-center justify-center gap-1 text-[11px] font-semibold text-brand-gold hover:text-brand-gold-dark transition-colors"
        >
          Vérifier un certificat <ExternalLink className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
