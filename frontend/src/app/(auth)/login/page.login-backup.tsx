'use client';
// ============================================================================
// AU-IBAR Learning — Login Page
// Modern full-screen layout with animal watermark & floating circles
// ============================================================================
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Loader2, Mail, Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useAuthStore } from '@/lib/store';

// ---------------------------------------------------------------------------
// Floating circles decoration
// ---------------------------------------------------------------------------
function FloatingCircles() {
  const circles = [
    { w: 320, x: '-5%', y: '10%', color: 'bg-[#1A5632]/[0.04]', delay: 0 },
    { w: 240, x: '70%', y: '-8%', color: 'bg-[#C8A951]/[0.06]', delay: 0.5 },
    { w: 400, x: '60%', y: '55%', color: 'bg-[#1A5632]/[0.03]', delay: 1 },
    { w: 180, x: '25%', y: '70%', color: 'bg-[#C8A951]/[0.05]', delay: 1.5 },
    { w: 140, x: '85%', y: '30%', color: 'bg-[#1A5632]/[0.05]', delay: 0.8 },
    { w: 260, x: '-8%', y: '50%', color: 'bg-[#C8A951]/[0.04]', delay: 1.2 },
    { w: 100, x: '45%', y: '15%', color: 'bg-[#1A5632]/[0.06]', delay: 0.3 },
    { w: 200, x: '15%', y: '85%', color: 'bg-[#C8A951]/[0.05]', delay: 1.8 },
  ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {circles.map((c, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: c.delay, ease: 'easeOut' }}
          className={clsx('absolute rounded-full', c.color)}
          style={{
            width: c.w,
            height: c.w,
            left: c.x,
            top: c.y,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Login form
// ---------------------------------------------------------------------------
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      setAuth(data.user, data.token);
      document.cookie = `aris-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      toast.success(`Bienvenue, ${data.user.firstName} !`);
      const redirect = searchParams.get('redirect') || '/';
      router.replace(redirect);
    } catch {
      toast.error('Erreur réseau. Veuillez réessayer.');
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden">
      {/* ── Full-screen background ── */}
      <div className="absolute inset-0 bg-[#efece7]" />

      {/* ── Floating decorative circles ── */}
      <FloatingCircles />

      {/* ── Animal watermark (filigrane) across full background ── */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none">
        <Image
          src="/bd-bottom.png"
          alt=""
          width={1920}
          height={400}
          className="w-full h-auto object-cover opacity-[0.08]"
          priority
          aria-hidden="true"
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          {/* Logo + Branding */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center justify-center mb-5">
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Image
                  src="/au-logo.png"
                  alt="AU-IBAR"
                  width={72}
                  height={72}
                  className="w-[72px] h-[72px] object-contain drop-shadow-lg"
                  priority
                />
              </motion.div>
            </div>
            <h1 className="text-3xl lg:text-4xl font-sans font-bold text-[#930e2d] tracking-tight">
              AU-IBAR Learning
            </h1>
            <p className="mt-2 text-sm text-[#6c757d] mx-auto leading-relaxed whitespace-nowrap">
              Plateforme de formation en ligne de l&apos;Union Africaine
            </p>
          </motion.div>

          {/* Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className={clsx(
              'rounded-2xl p-8',
              'bg-white/80 backdrop-blur-xl',
              'border border-[#dee2e6]/60',
              'shadow-[0_1rem_3rem_rgba(0,0,0,0.08)]',
            )}
          >
            <h2 className="text-xl font-semibold text-[#212529] mb-1">
              Connexion
            </h2>
            <p className="text-sm text-[#6c757d] mb-7">
              Connectez-vous &agrave; votre espace de formation
            </p>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-[#dc3545]/5 border border-[#dc3545]/20"
              >
                <AlertTriangle className="w-4 h-4 text-[#dc3545] shrink-0" />
                <p className="text-sm text-[#dc3545]">{error}</p>
              </motion.div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#495057] mb-1.5">
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@organisation.org"
                    required
                    className={clsx(
                      'w-full pl-11 pr-4 py-3 rounded-lg text-sm',
                      'bg-white border border-[#ced4da]',
                      'text-[#212529] placeholder:text-[#adb5bd]',
                      'focus:outline-none focus:ring-2 focus:ring-[rgba(26,86,50,0.25)]',
                      'focus:border-[#1A5632]',
                      'transition-all duration-200',
                    )}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#495057] mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className={clsx(
                      'w-full pl-11 pr-4 py-3 rounded-lg text-sm',
                      'bg-white border border-[#ced4da]',
                      'text-[#212529] placeholder:text-[#adb5bd]',
                      'focus:outline-none focus:ring-2 focus:ring-[rgba(26,86,50,0.25)]',
                      'focus:border-[#1A5632]',
                      'transition-all duration-200',
                    )}
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className={clsx(
                  'w-full py-3 rounded-lg text-sm font-semibold',
                  'bg-[#1A5632] text-white',
                  'hover:bg-[#154528] hover:shadow-[0_0.5rem_1rem_rgba(0,0,0,0.15)]',
                  'focus:outline-none focus:ring-2 focus:ring-[rgba(26,86,50,0.25)] focus:ring-offset-2',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                  'transition-all duration-200',
                  'flex items-center justify-center gap-2',
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Connexion en cours...
                  </>
                ) : (
                  <>
                    Se connecter
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-8 text-center text-xs text-[#adb5bd]"
          >
            &copy; {new Date().getFullYear()} AU-IBAR &mdash; African Union InterAfrican Bureau for Animal Resources
          </motion.p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#efece7]">
          <Loader2 className="w-8 h-8 animate-spin text-[#1A5632]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
