'use client';
// ============================================================================
// Topnet Solutions Academy — Register Page
// ============================================================================
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, Lock, Loader2, ArrowRight, AlertTriangle, User, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';

export default function RegisterPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/learning/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(t('emailExists'));
        } else {
          setError(data.error || t('registerError'));
        }
        setLoading(false);
        return;
      }

      setAuth(data.user, data.token);
      document.cookie = `topnet-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      toast.success(t('registerSuccess'));
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
      <div className="hidden lg:flex lg:w-[45%] relative bg-gradient-to-br from-[#00B341] via-[#009930] to-[#0D0670] items-center justify-center p-12 overflow-hidden">
        {/* Decorative */}
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/[0.04]" />
        <div className="absolute -left-10 bottom-20 w-72 h-72 rounded-full bg-[#1B0CB3]/[0.08]" />
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
            Rejoignez Topnet Solutions Academy
          </h1>
          <p className="text-white/60 leading-relaxed text-sm">
            Creez votre compte gratuit et accedez a des formations
            professionnelles certifiantes en IT, Digital et Management.
          </p>

          {/* Features list */}
          <div className="mt-8 space-y-3 text-left max-w-xs mx-auto">
            {[
              'Acces a tout le catalogue de formations',
              'Certifications reconnues par les employeurs',
              'Tests de niveau gratuits',
              'Suivi de progression personnalise',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-white/80 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <ArrowRight className="w-3 h-3 text-white" />
                </div>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Register form */}
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
            <div className="h-1.5 bg-gradient-to-r from-[#00B341] via-[#1B0CB3] to-[#A09060]" />

            <div className="p-8 sm:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#212529] mb-2">{t('registerTitle')}</h2>
                <p className="text-sm text-[#6c757d]">{t('registerSubtitle')}</p>
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

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-semibold text-[#495057] mb-2">{t('firstName')}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#adb5bd]" />
                      <input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder={t('firstNamePlaceholder')}
                        required
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-[#f8f9fb] border border-gray-200 text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#00B341]/20 focus:border-[#00B341] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-semibold text-[#495057] mb-2">{t('lastName')}</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#adb5bd]" />
                      <input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder={t('lastNamePlaceholder')}
                        required
                        className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-[#f8f9fb] border border-gray-200 text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#00B341]/20 focus:border-[#00B341] focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-sm font-semibold text-[#495057] mb-2">{t('email')}</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#adb5bd]" />
                    <input
                      id="reg-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('emailPlaceholder')}
                      required
                      className="w-full pl-12 pr-4 py-3.5 rounded-xl text-sm bg-[#f8f9fb] border border-gray-200 text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#00B341]/20 focus:border-[#00B341] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-sm font-semibold text-[#495057] mb-2">{t('password')}</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#adb5bd]" />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('newPasswordPlaceholder')}
                      required
                      minLength={8}
                      className="w-full pl-12 pr-12 py-3.5 rounded-xl text-sm bg-[#f8f9fb] border border-gray-200 text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#00B341]/20 focus:border-[#00B341] focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[#adb5bd] hover:text-[#495057] transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#adb5bd] mt-1.5">Minimum 8 caracteres</p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold bg-[#00B341] text-white hover:bg-[#009930] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#00B341]/20"
                >
                  {loading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />{t('registering')}</>
                  ) : (
                    <><>{t('registerSubmit')}</><ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <span className="text-sm text-[#6c757d]">{t('hasAccount')} </span>
                <Link href={`/login${searchParams.get('redirect') ? '?redirect=' + encodeURIComponent(searchParams.get('redirect')!) : ''}`} className="text-sm font-bold text-[#1B0CB3] hover:underline">
                  {t('signinLink')}
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
