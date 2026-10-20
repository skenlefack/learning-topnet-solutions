'use client';
// ============================================================================
// Topnet Solutions Academy — Certifications Page
// My certifications grid + certificate verification (number or QR code)
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award, Download, Share2, Search, Camera,
  CheckCircle2, XCircle, AlertTriangle, Clock,
  Sprout, BookMarked, Target, Crown, Copy, Linkedin,
  Loader2, X, Lock, Unlock,
} from 'lucide-react';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { assessmentApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const containerVariants = { hidden: {}, visible: { transition: { staggerChildren: 0.08 } } };
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
};

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

interface Certification {
  id: string;
  course_id: string;
  course_title?: Record<string, string>;
  level: string;
  status: 'pending' | 'issued' | 'revoked' | 'expired';
  certificate_number: string;
  pdf_url?: string;
  qr_code_data?: string;
  issued_at?: string;
  expires_at?: string;
}

interface VerifyResult {
  valid: boolean;
  status: string;
  certificate_number?: string;
  holder_name?: string;
  course_title?: Record<string, string>;
  level?: string;
  issued_at?: string;
  expires_at?: string;
}

const LEVEL_CONFIG: Record<string, { key: string; icon: typeof Sprout; color: string; bg: string }> = {
  beginner: { key: 'beginner', icon: Sprout, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  intermediate: { key: 'intermediate', icon: BookMarked, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  advanced: { key: 'advanced', icon: Target, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  expert: { key: 'expert', icon: Crown, color: 'text-brand-gold', bg: 'bg-brand-gold-pale dark:bg-yellow-900/20' },
};

const CERT_LEVELS = [
  { key: 'beginner', icon: Sprout, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', status: 'certified' as const },
  { key: 'intermediate', icon: BookMarked, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', status: 'unlocked' as const },
  { key: 'advanced', icon: Target, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', status: 'locked' as const },
  { key: 'expert', icon: Crown, color: 'text-brand-gold', bg: 'bg-brand-gold-pale dark:bg-yellow-900/20', status: 'locked' as const },
];

const VERIFY_URL_BASE = 'https://learning.topnet-solutions.com/verify/';

function getLocalizedText(text: Record<string, string> | string | undefined): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text.fr || text.en || Object.values(text)[0] || '';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CertificatesPage() {
  const { token } = useAuth();
  const t_cert = useTranslations('certificates');
  const t_levels = useTranslations('levels');
  const t_verify = useTranslations('verify');
  const [certs, setCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);

  // Verification state
  const [verifyInput, setVerifyInput] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [shareOpen, setShareOpen] = useState<string | null>(null);

  // Fetch certifications
  useEffect(() => {
    if (!token) return;
    assessmentApi.certifications(token)
      .then((res: any) => setCerts(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  // Download PDF
  const handleDownload = useCallback((cert: Certification) => {
    if (cert.pdf_url) {
      const a = document.createElement('a');
      a.href = cert.pdf_url;
      a.download = `ARIS-Certificate-${cert.certificate_number}.pdf`;
      a.target = '_blank';
      a.click();
    } else {
      toast.error(t_cert('pdfNotAvailable'));
    }
  }, []);

  // Share
  const handleCopyLink = useCallback((certNumber: string) => {
    navigator.clipboard.writeText(`${VERIFY_URL_BASE}${certNumber}`);
    toast.success(t_cert('linkCopied'));
    setShareOpen(null);
  }, []);

  const handleShareLinkedIn = useCallback((cert: Certification) => {
    const url = encodeURIComponent(`${VERIFY_URL_BASE}${cert.certificate_number}`);
    const title = encodeURIComponent(`Topnet Solutions Academy - Certification ${t_levels(LEVEL_CONFIG[cert.level]?.key || cert.level)}`);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}&title=${title}`, '_blank');
    setShareOpen(null);
  }, []);

  // Verify certificate
  const handleVerify = useCallback(async (input?: string) => {
    const num = (input || verifyInput).trim();
    if (!num) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const res: any = await assessmentApi.verify(num);
      setVerifyResult(res.data || res);
    } catch {
      setVerifyResult({ valid: false, status: 'not_found' });
    } finally {
      setVerifyLoading(false);
    }
  }, [verifyInput]);

  // QR scanner result
  const handleQrResult = useCallback((data: string) => {
    setShowQrScanner(false);
    const match = data.match(/verify\/([A-Z0-9-]+)/i);
    const certNum = match ? match[1] : data;
    setVerifyInput(certNum);
    handleVerify(certNum);
  }, [handleVerify]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{t_cert('myTitle')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {t_cert('subtitle')}
        </p>
      </motion.div>

      {/* ====== CERTIFICATION PATHWAY ====== */}
      <motion.div variants={fadeUp}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t_cert('pathway')}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {CERT_LEVELS.map((level, idx) => {
            const Icon = level.icon;
            const StatusIcon = level.status === 'certified' ? CheckCircle2 : level.status === 'unlocked' ? Unlock : Lock;
            return (
              <div
                key={level.key}
                className={clsx(
                  'relative rounded-xl p-4',
                  'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                  level.status === 'locked' && 'opacity-50',
                )}
              >
                {idx < CERT_LEVELS.length - 1 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] z-10">
                    &rarr;
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center', level.bg)}>
                    <Icon className={clsx('w-5 h-5', level.color)} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{t_levels(level.key)}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] capitalize flex items-center gap-1">
                      <StatusIcon className={clsx('w-3 h-3',
                        level.status === 'certified' ? 'text-brand-gold' :
                        level.status === 'unlocked' ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'
                      )} />
                      {level.status === 'certified' ? t_cert('certified') : level.status === 'unlocked' ? t_cert('inProgress') : t_cert('locked')}
                    </p>
                  </div>
                </div>
                {level.status === 'certified' && (
                  <div className="h-1.5 rounded-full bg-brand-gold" />
                )}
                {level.status === 'unlocked' && (
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full w-1/3 rounded-full bg-brand-navy dark:bg-brand-gold" />
                  </div>
                )}
                {level.status === 'locked' && (
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800" />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ====== CERTIFICATIONS GRID ====== */}
      <motion.div variants={fadeUp}>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">{t_cert('obtained')}</h2>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-5 animate-pulse">
                <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="h-4 w-1/2 bg-gray-100 dark:bg-gray-800 rounded mb-2" />
                <div className="h-4 w-1/3 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            ))}
          </div>
        ) : certs.length === 0 ? (
          <div className="text-center py-16 rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]">
            <Award className="w-14 h-14 mx-auto text-brand-gold/40 mb-4" />
            <p className="font-medium text-[var(--text-primary)]">{t_cert('none')}</p>
            <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
              {t_cert('noneDesc')}
            </p>
            <a
              href="/courses"
              className={clsx(
                'inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                'bg-brand-navy text-white hover:bg-brand-navy-deep',
                'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
              )}
            >
              {t_cert('browseCatalog')}
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certs.map(cert => {
              const level = LEVEL_CONFIG[cert.level] || LEVEL_CONFIG.beginner;
              const LevelIcon = level.icon;
              const isExpired = cert.status === 'expired';
              const isRevoked = cert.status === 'revoked';

              return (
                <div
                  key={cert.id}
                  className={clsx(
                    'card-hover rounded-xl overflow-hidden',
                    'bg-white dark:bg-surface-dark-card',
                    'border border-[var(--border)]',
                    (isExpired || isRevoked) && 'opacity-70',
                  )}
                >
                  {/* Top accent */}
                  <div className="h-1.5" style={{
                    background: cert.level === 'expert' ? '#00B341' : cert.level === 'advanced' ? '#a855f7' : cert.level === 'intermediate' ? '#3b82f6' : '#22c55e',
                  }} />

                  <div className="p-5 space-y-4">
                    {/* Level badge + status */}
                    <div className="flex items-start justify-between">
                      <div className={clsx('flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold', level.bg, level.color)}>
                        <LevelIcon className="w-4 h-4" />
                        {t_levels(level.key)}
                      </div>
                      {cert.status === 'issued' && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {t_cert('valid')}
                        </span>
                      )}
                      {isExpired && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                          <Clock className="w-3.5 h-3.5" /> {t_cert('expired')}
                        </span>
                      )}
                      {isRevoked && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
                          <XCircle className="w-3.5 h-3.5" /> {t_cert('revoked')}
                        </span>
                      )}
                    </div>

                    {/* Course title */}
                    {cert.course_title && (
                      <h3 className="font-semibold text-[var(--text-primary)] line-clamp-2">
                        {getLocalizedText(cert.course_title)}
                      </h3>
                    )}

                    {/* Certificate number */}
                    <div className="text-xs text-[var(--text-secondary)] font-mono">
                      {t_cert('number')} {cert.certificate_number}
                    </div>

                    {/* Dates */}
                    <div className="flex gap-4 text-xs text-[var(--text-secondary)]">
                      {cert.issued_at && (
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider mb-0.5">{t_cert('issuedAt')}</span>
                          <span className="font-medium text-[var(--text-primary)]">
                            {format(parseISO(cert.issued_at), 'd MMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      )}
                      {cert.expires_at && (
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider mb-0.5">{t_cert('expiresAt')}</span>
                          <span className={clsx('font-medium', isExpired ? 'text-red-500' : 'text-[var(--text-primary)]')}>
                            {format(parseISO(cert.expires_at), 'd MMM yyyy', { locale: fr })}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* QR code */}
                    {cert.qr_code_data && (
                      <div className="flex justify-center py-2">
                        <QRCodeSVG
                          value={cert.qr_code_data || `${VERIFY_URL_BASE}${cert.certificate_number}`}
                          size={80}
                          level="M"
                          className="dark:bg-white dark:p-1 dark:rounded"
                        />
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDownload(cert)}
                        className={clsx(
                          'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors',
                          'bg-brand-navy text-white hover:bg-brand-navy-deep',
                          'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
                        )}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {t_cert('downloadPDF')}
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setShareOpen(shareOpen === cert.id ? null : cert.id)}
                          className={clsx(
                            'p-2 rounded-lg text-[var(--text-secondary)] transition-colors',
                            'hover:bg-gray-100 dark:hover:bg-gray-800',
                            'border border-[var(--border)]',
                          )}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {shareOpen === cert.id && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className={clsx(
                                'absolute right-0 bottom-full mb-1 w-44 py-1 rounded-lg shadow-lg z-10',
                                'bg-white dark:bg-surface-dark-card border border-[var(--border)]',
                              )}
                            >
                              <button
                                onClick={() => handleShareLinkedIn(cert)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 text-[var(--text-primary)]"
                              >
                                <Linkedin className="w-4 h-4 text-blue-600" />
                                LinkedIn
                              </button>
                              <button
                                onClick={() => handleCopyLink(cert.certificate_number)}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 text-[var(--text-primary)]"
                              >
                                <Copy className="w-4 h-4" />
                                {t_cert('copyLink')}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* ====== VERIFICATION SECTION ====== */}
      <motion.div
        variants={fadeUp}
        className={clsx(
          'rounded-xl p-6',
          'bg-white dark:bg-surface-dark-card',
          'border border-[var(--border)]',
        )}
      >
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
          {t_cert('verifyTitle')}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          {t_cert('verifySubtitle')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={verifyInput}
              onChange={e => setVerifyInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder={t_cert('verifyPlaceholder')}
              className={clsx(
                'w-full pl-10 pr-4 py-2.5 rounded-lg text-sm',
                'bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]',
                'text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]',
                'focus:outline-none focus:ring-2 focus:ring-brand-navy/20 dark:focus:ring-brand-gold/20',
              )}
            />
          </div>

          <button
            onClick={() => handleVerify()}
            disabled={verifyLoading || !verifyInput.trim()}
            className={clsx(
              'flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'bg-brand-navy text-white hover:bg-brand-navy-deep disabled:opacity-50',
              'dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark',
            )}
          >
            {verifyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {t_cert('verify')}
          </button>

          <button
            onClick={() => setShowQrScanner(true)}
            className={clsx(
              'flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors',
              'border border-[var(--border)] text-[var(--text-primary)]',
              'hover:bg-gray-50 dark:hover:bg-gray-800',
            )}
          >
            <Camera className="w-4 h-4" />
            {t_cert('scanQR')}
          </button>
        </div>

        {/* Verify result */}
        <AnimatePresence mode="wait">
          {verifyResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div className={clsx(
                'rounded-lg p-4 border',
                verifyResult.valid && verifyResult.status === 'issued'
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : verifyResult.status === 'expired'
                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
              )}>
                <div className="flex items-start gap-3">
                  {verifyResult.valid && verifyResult.status === 'issued' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                  ) : verifyResult.status === 'expired' ? (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}

                  <div className="min-w-0">
                    <h4 className={clsx(
                      'font-semibold text-sm',
                      verifyResult.valid && verifyResult.status === 'issued' ? 'text-green-800 dark:text-green-300'
                        : verifyResult.status === 'expired' ? 'text-amber-800 dark:text-amber-300'
                          : 'text-red-800 dark:text-red-300',
                    )}>
                      {verifyResult.valid && verifyResult.status === 'issued' && t_verify('valid')}
                      {verifyResult.status === 'expired' && t_verify('expired')}
                      {verifyResult.status === 'revoked' && t_verify('revoked')}
                      {verifyResult.status === 'not_found' && t_verify('notFound')}
                    </h4>

                    {verifyResult.holder_name && (
                      <p className="text-sm text-[var(--text-primary)] mt-1">
                        {t_verify('holder')} <strong>{verifyResult.holder_name}</strong>
                      </p>
                    )}
                    {verifyResult.course_title && (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t_verify('course')} {getLocalizedText(verifyResult.course_title)}
                      </p>
                    )}
                    {verifyResult.level && (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t_verify('level')} {t_levels(LEVEL_CONFIG[verifyResult.level]?.key || verifyResult.level)}
                      </p>
                    )}
                    {verifyResult.issued_at && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {t_cert('issuedAt')} {format(parseISO(verifyResult.issued_at), 'd MMMM yyyy', { locale: fr })}
                        {verifyResult.expires_at && ` — ${t_cert('expiresAt')} ${format(parseISO(verifyResult.expires_at), 'd MMMM yyyy', { locale: fr })}`}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ====== QR SCANNER MODAL ====== */}
      <AnimatePresence>
        {showQrScanner && (
          <QrScannerModal
            onResult={handleQrResult}
            onClose={() => setShowQrScanner(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// QR Scanner Modal (lazy camera access)
// ---------------------------------------------------------------------------

function QrScannerModal({ onResult, onClose }: { onResult: (data: string) => void; onClose: () => void }) {
  const t_qr = useTranslations('qrScanner');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });

        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        if ('BarcodeDetector' in window) {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const scan = async () => {
            if (!active || !videoRef.current || !scanning) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                onResult(barcodes[0].rawValue);
                return;
              }
            } catch {
              // Detection failed, try again
            }
            requestAnimationFrame(scan);
          };
          requestAnimationFrame(scan);
        } else {
          setError(t_qr('notSupported'));
        }
      } catch {
        setError(t_qr('cameraError'));
      }
    })();

    return () => {
      active = false;
      setScanning(false);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onResult, scanning, t_qr]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className={clsx(
          'w-full max-w-sm rounded-2xl overflow-hidden',
          'bg-white dark:bg-surface-dark-card',
          'border border-[var(--border)]',
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--text-primary)]">{t_qr('title')}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>

        <div className="relative aspect-square bg-black">
          {error ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="text-center">
                <Camera className="w-8 h-8 mx-auto text-gray-500 mb-2" />
                <p className="text-sm text-gray-400">{error}</p>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-xl relative">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-brand-gold rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-brand-gold rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-brand-gold rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-brand-gold rounded-br-lg" />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-4 text-center">
          <p className="text-xs text-[var(--text-secondary)]">
            {t_qr('instruction')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
