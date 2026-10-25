'use client';
// ============================================================================
// Topnet Solutions Academy — Login Page
// ============================================================================
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/learning/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t('invalidCredentials'));
        setLoading(false);
        return;
      }

      setAuth(data.user, data.token);
      document.cookie = `topnet-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      toast.success(t('welcome', { name: data.user.firstName }));
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.replace(redirect);
    } catch {
      toast.error(t('networkError'));
      setError(t('networkError'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — Branding panel */}
      <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-[#1B0CB3] via-[#0D0670] to-[#1B0CB3] items-center justify-center p-12 overflow-hidden">
        {/* Decorative */}
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/[0.04]" />
        <div className="absolute -left-10 bottom-20 w-72 h-72 rounded-full bg-[#00B341]/[0.08]" />
        <div className="absolute right-10 bottom-10 w-48 h-48 rounded-full bg-white/[0.03]" />

        <div className="relative z-10 max-w-md text-center">
          <Image
            src="/logo-topnet.jpg"
            alt="Topnet Solutions"
            width={200}
            height={200}
            className="w-[200px] h-auto mx-auto mb-8 object-contain rounded-xl shadow-2xl"
          />
          <h1 className="text-3xl font-bold text-white mb-4">
            Bienvenue sur Topnet Solutions Academy
          </h1>
          <p className="text-white/60 leading-relaxed text-sm">
            Votre plateforme de formation professionnelle certifiante.
            Developpez vos competences IT, Digital et Management.
          </p>

          {/* Slider images preview */}
          <div className="flex gap-2 mt-8 justify-center">
            {['/slider2.jpg', '/slider3.jpg', '/slider4.jpg'].map((src, i) => (
              <div key={i} className="w-20 h-14 rounded-lg overflow-hidden opacity-60">
                <Image src={src} alt="" width={80} height={56} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-[#f8f9fb]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/logo-topnet.jpg"
              alt="Topnet Solutions"
              width={160}
              height={160}
              className="w-[160px] h-auto object-contain"
            />
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-[0_4px_30px_rgba(0,0,0,0.08)] border border-gray-100 overflow-hidden">
            {/* Top accent */}
            <div className="h-1.5 bg-gradient-to-r from-[#1B0CB3] via-[#00B341] to-[#A09060]" />

            <div className="p-8 sm:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#212529] mb-2">{t('title')}</h2>
                <p className="text-sm text-[#6c757d]">{t('subtitle')}</p>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2.5 p-3.5 mb-6 rounded-xl bg-red-50 border border-red-100"
                >
                  <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </motion.div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-[#495057] mb-2">{t('email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#adb5bd]" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      required
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-[#f8f9fb] border border-gray-200 text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#1B0CB3]/20 focus:border-[#1B0CB3] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-[#495057] mb-2">{t('password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#adb5bd]" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl text-sm bg-[#f8f9fb] border border-gray-200 text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#1B0CB3]/20 focus:border-[#1B0CB3] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#adb5bd] hover:text-[#495057] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[#1B0CB3] focus:ring-[#1B0CB3]/30" />
                    <span className="text-xs text-[#6c757d]">Se souvenir de moi</span>
                  </label>
                  <Link href="/forgot-password" className="text-xs font-semibold text-[#1B0CB3] hover:underline">
                    {t('forgotPassword')}
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold bg-[#1B0CB3] text-white hover:bg-[#0D0670] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#1B0CB3]/20"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t('submitting')}</>
                  ) : (
                    <>{t('submit')}<ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <span className="text-sm text-[#6c757d]">{t('noAccount')} </span>
                <Link href={`/register${searchParams.get('redirect') ? '?redirect=' + encodeURIComponent(searchParams.get('redirect')!) : ''}`} className="text-sm font-bold text-[#1B0CB3] hover:underline">
                  {t('signup')}
                </Link>
              </div>
            </div>
          </div>

          <p className="text-center text-[10px] text-[#adb5bd] mt-6">
            Topnet Solutions &copy; {new Date().getFullYear()} — Tous droits reserves
          </p>
        </motion.div>
      </div>
    </div>
  );
}
