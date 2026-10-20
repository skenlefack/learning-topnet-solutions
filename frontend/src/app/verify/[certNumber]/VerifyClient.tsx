'use client';

import { motion } from 'framer-motion';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ShieldQuestion,
  Calendar,
  User,
  BookOpen,
  Award,
  ExternalLink,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import Image from 'next/image';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CertData {
  certificate_number: string;
  status: string;
  level: string;
  issued_at: string;
  expires_at: string;
  first_name: string;
  last_name: string;
  course_title: Record<string, string> | string;
  qr_code_data?: string;
  pdf_url?: string;
}

interface Props {
  cert: CertData | null;
  certNumber: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTitle(text: Record<string, string> | string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.en || text.fr || Object.values(text)[0] || '';
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
};

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

type VerifyStatus = 'valid' | 'expired' | 'revoked' | 'not_found';

function getStatus(cert: CertData | null): VerifyStatus {
  if (!cert) return 'not_found';
  if (cert.status === 'revoked') return 'revoked';
  if (cert.expires_at && new Date(cert.expires_at) < new Date()) return 'expired';
  if (cert.status === 'issued') return 'valid';
  return 'not_found';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function VerifyClient({ cert, certNumber }: Props) {
  const t = useTranslations('verify');
  const t_levels = useTranslations('levels');

  const STATUS_CONFIG: Record<
    VerifyStatus,
    {
      icon: typeof ShieldCheck;
      label: string;
      description: string;
      bgClass: string;
      iconClass: string;
      borderClass: string;
    }
  > = {
    valid: {
      icon: ShieldCheck,
      label: t('valid'),
      description: t('validDesc'),
      bgClass: 'bg-green-50 dark:bg-green-900/20',
      iconClass: 'text-green-600 dark:text-green-400',
      borderClass: 'border-green-200 dark:border-green-800',
    },
    expired: {
      icon: ShieldAlert,
      label: t('expired'),
      description: t('expiredDesc'),
      bgClass: 'bg-amber-50 dark:bg-amber-900/20',
      iconClass: 'text-amber-600 dark:text-amber-400',
      borderClass: 'border-amber-200 dark:border-amber-800',
    },
    revoked: {
      icon: ShieldX,
      label: t('revoked'),
      description: t('revokedDesc'),
      bgClass: 'bg-red-50 dark:bg-red-900/20',
      iconClass: 'text-red-600 dark:text-red-400',
      borderClass: 'border-red-200 dark:border-red-800',
    },
    not_found: {
      icon: ShieldQuestion,
      label: t('notFound'),
      description: t('notFoundDesc'),
      bgClass: 'bg-gray-50 dark:bg-gray-800/50',
      iconClass: 'text-gray-400 dark:text-gray-500',
      borderClass: 'border-gray-200 dark:border-gray-700',
    },
  };

  const status = getStatus(cert);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;
  const verifyUrl =
    typeof window !== 'undefined'
      ? window.location.href
      : `https://learning.topnet-solutions.com/verify/${certNumber}`;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      {/* Header */}
      <motion.div
        custom={0}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="flex items-center justify-center gap-3 mb-8"
      >
        <Image
          src="/logo-topnet.jpg"
          alt="Topnet Solutions"
          width={130}
          height={130}
          className="w-[130px] h-auto object-contain"
        />
        <div className="leading-none">
          <span className="font-display text-xl text-brand-navy dark:text-white tracking-tight">
            Topnet Solutions
          </span>
          <span className="block text-[10px] font-semibold tracking-[0.2em] text-brand-gold uppercase mt-0.5">
            Learning
          </span>
        </div>
      </motion.div>

      {/* Status banner */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className={clsx(
          'rounded-2xl border p-6 sm:p-8 text-center mb-6',
          config.bgClass,
          config.borderClass,
        )}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        >
          <StatusIcon className={clsx('w-16 h-16 mx-auto mb-4', config.iconClass)} />
        </motion.div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
          {config.label}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          {config.description}
        </p>
        <div className="mt-3 inline-block px-3 py-1 rounded-full bg-white/60 dark:bg-black/20 text-xs font-mono text-[var(--text-secondary)]">
          {certNumber}
        </div>
      </motion.div>

      {/* Certificate details (only if found) */}
      {cert && status !== 'not_found' && (
        <motion.div
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className={clsx(
            'rounded-2xl border border-[var(--border)] p-6 sm:p-8 mb-6',
            'bg-white dark:bg-surface-dark-card',
          )}
        >
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-5">
            {t('detailsTitle')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Holder */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-navy/5 dark:bg-brand-navy/20 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)] tracking-wider">
                  {t('holder')}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {cert.first_name} {cert.last_name}
                </p>
              </div>
            </div>

            {/* Course */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-navy/5 dark:bg-brand-navy/20 flex items-center justify-center shrink-0">
                <BookOpen className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)] tracking-wider">
                  {t('course')}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {getTitle(cert.course_title)}
                </p>
              </div>
            </div>

            {/* Level */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-gold/10 dark:bg-brand-gold/20 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)] tracking-wider">
                  {t('level')}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {t_levels(cert.level as any) || cert.level}
                </p>
              </div>
            </div>

            {/* Issued */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-navy/5 dark:bg-brand-navy/20 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)] tracking-wider">
                  {t('issuedAt')}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {new Date(cert.issued_at).toLocaleDateString('en', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Expires */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-navy/5 dark:bg-brand-navy/20 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)] tracking-wider">
                  {t('expiresAt')}
                </p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {new Date(cert.expires_at).toLocaleDateString('en', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-start gap-3">
              <div className={clsx(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                status === 'valid' && 'bg-green-50 dark:bg-green-900/20',
                status === 'expired' && 'bg-amber-50 dark:bg-amber-900/20',
                status === 'revoked' && 'bg-red-50 dark:bg-red-900/20',
              )}>
                <StatusIcon className={clsx('w-4 h-4', config.iconClass)} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--text-secondary)] tracking-wider">
                  {t('statusLabel')}
                </p>
                <p className={clsx('text-sm font-medium', config.iconClass)}>
                  {config.label}
                </p>
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="mt-6 pt-6 border-t border-[var(--border)] flex flex-col items-center gap-3">
            <QRCodeSVG
              value={verifyUrl}
              size={120}
              level="M"
              bgColor="transparent"
              fgColor="currentColor"
              className="text-[var(--text-primary)]"
            />
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t('scanLabel')}
            </p>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <motion.div
        custom={3}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="text-center space-y-3"
      >
        <a
          href="https://learning.topnet-solutions.com"
          className="inline-flex items-center gap-1.5 text-sm text-brand-navy dark:text-brand-gold hover:underline"
        >
          {t('visitLink')}
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <p className="text-[10px] text-[var(--text-secondary)]">
          {t('footerCopyright')} &copy; {new Date().getFullYear()}
        </p>
      </motion.div>
    </div>
  );
}
