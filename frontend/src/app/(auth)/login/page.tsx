'use client';
// ============================================================================
// AU-IBAR Learning — Landing Page (Public Home)
// Full e-learning homepage: navbar, hero slider, search, categories, courses,
// login/register modal, footer — design aligned with au-ibar.org
// ============================================================================
import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2, Mail, Lock, AlertTriangle, ArrowRight, Search,
  ChevronLeft, ChevronRight, X, Menu, Play, Users, BookOpen,
  Award, Globe, Heart, ShieldCheck, Microscope, Leaf, Fish,
  TrendingUp, Boxes, Bug, Beef, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { publicApi, categoryApi } from '@/lib/api';

// ═══════════════════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════════════════

const SLIDE_BGS = [
  'from-[#1A5632] via-[#144126] to-[#0e591a]',
  'from-[#154528] via-[#1A5632] to-[#0e591a]',
  'from-[#0e591a] via-[#1A5632] to-[#154528]',
  'from-[#144126] via-[#0e591a] to-[#1A5632]',
  'from-[#1A5632] via-[#154528] to-[#144126]',
];

const CATEGORIES_DATA = [
  { key: 'animalHealth', icon: ShieldCheck, count: 12, color: '#1A5632' },
  { key: 'epidemiology', icon: Microscope, count: 8, color: '#930e2d' },
  { key: 'animalProduction', icon: Beef, count: 10, color: '#B8952E' },
  { key: 'fisheries', icon: Fish, count: 7, color: '#0e591a' },
  { key: 'tradeMarketing', icon: TrendingUp, count: 6, color: '#154528' },
  { key: 'animalWelfare', icon: Heart, count: 5, color: '#930e2d' },
  { key: 'geneticResources', icon: Boxes, count: 4, color: '#1A5632' },
  { key: 'beekeeping', icon: Bug, count: 3, color: '#B8952E' },
  { key: 'environment', icon: Leaf, count: 6, color: '#0e591a' },
];

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#1A5632',
  intermediate: '#B8952E',
  advanced: '#930e2d',
  expert: '#154528',
};

const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant',
  intermediate: 'Intermédiaire',
  advanced: 'Avancé',
  expert: 'Expert',
};

// Fallback courses when API is unavailable (matches seed data)
const FALLBACK_COURSES = [
  { id: '1', slug: 'surveillance-epidemiologique', title: { fr: 'Surveillance épidémiologique', en: 'Epidemiological Surveillance' }, level: 'beginner', estimated_hours: 12, module_count: 8, enrollment_count: 245, tags: ['surveillance', 'epidemiologie'] },
  { id: '2', slug: 'surveillance-ppr', title: { fr: 'Surveillance et contrôle de la PPR', en: 'PPR Surveillance and Control' }, level: 'intermediate', estimated_hours: 40, module_count: 5, enrollment_count: 187, tags: ['sante-animale', 'ppr'] },
  { id: '3', slug: 'aquaculture-durable', title: { fr: 'Aquaculture durable en Afrique', en: 'Sustainable Aquaculture in Africa' }, level: 'beginner', estimated_hours: 30, module_count: 4, enrollment_count: 312, tags: ['peche', 'aquaculture'] },
  { id: '4', slug: 'normes-sps-commerce', title: { fr: 'Normes SPS et commerce régional africain', en: 'SPS Standards and African Trade' }, level: 'advanced', estimated_hours: 45, module_count: 5, enrollment_count: 98, tags: ['commerce', 'sps'] },
  { id: '5', slug: 'ressources-genetiques', title: { fr: 'Conservation des ressources génétiques animales', en: 'Animal Genetic Resources Conservation' }, level: 'intermediate', estimated_hours: 35, module_count: 4, enrollment_count: 156, tags: ['genetique', 'biodiversite'] },
  { id: '6', slug: 'apiculture-sante-abeilles', title: { fr: 'Apiculture et santé des abeilles en Afrique', en: 'Beekeeping and Bee Health in Africa' }, level: 'beginner', estimated_hours: 25, module_count: 4, enrollment_count: 423, tags: ['apiculture', 'abeilles'] },
];

const NAV_LINKS = [
  { key: 'home', href: '#' },
  { key: 'courses', href: '#courses' },
  { key: 'categories', href: '#categories' },
  { key: 'about', href: '#about' },
];

// ═══════════════════════════════════════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════════════════════════════════════

function Navbar({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const t_nav = useTranslations('landingNav');
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  return (
    <>
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#1A5632] via-[#C8A951] to-[#930e2d]" />

      <nav
        className={clsx(
          'sticky top-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-white/95 backdrop-blur-md shadow-[0_2px_15px_rgba(0,0,0,0.06)]'
            : 'bg-white',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Image src="/au-logo.png" alt="AU-IBAR" width={40} height={40} className="w-10 h-10 object-contain" />
              <div>
                <span className="text-lg font-bold text-[#930e2d]">AU-IBAR</span>
                <span className="text-lg font-bold text-[#1A5632] ml-1">Learning</span>
              </div>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.key}
                  href={link.href}
                  className="text-sm font-medium text-[#495057] hover:text-[#1A5632] transition-colors"
                >
                  {t_nav(link.key)}
                </a>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={onSignup}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold border border-[#1A5632] text-[#1A5632] hover:bg-[#1A5632]/5 transition-colors"
              >
                {t_nav('signup')}
              </button>
              <button
                onClick={onLogin}
                className="hidden sm:inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] transition-colors"
              >
                {t_nav('login')}
              </button>
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5 text-[#495057]" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden border-t border-[#dee2e6] overflow-hidden bg-white"
            >
              <div className="px-4 py-4 space-y-2">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.key}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-lg text-sm font-medium text-[#495057] hover:bg-[#f8f9fa]"
                  >
                    {t_nav(link.key)}
                  </a>
                ))}
                <button
                  onClick={() => { setMobileOpen(false); onSignup(); }}
                  className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold border border-[#1A5632] text-[#1A5632]"
                >
                  {t_nav('signup')}
                </button>
                <button
                  onClick={() => { setMobileOpen(false); onLogin(); }}
                  className="w-full mt-2 py-2.5 rounded-lg text-sm font-semibold bg-[#1A5632] text-white"
                >
                  {t_nav('login')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HERO SLIDER
// ═══════════════════════════════════════════════════════════════════════════

function HeroSlider({ onLogin, onSignup }: { onLogin: () => void; onSignup: () => void }) {
  const t_hero = useTranslations('hero');
  const [current, setCurrent] = useState(0);

  const SLIDES = [
    { title: t_hero('slide1Title'), subtitle: t_hero('slide1Subtitle'), cta: t_hero('slide1CTA'), bg: SLIDE_BGS[0] },
    { title: t_hero('slide2Title'), subtitle: t_hero('slide2Subtitle'), cta: t_hero('slide2CTA'), bg: SLIDE_BGS[1] },
    { title: t_hero('slide3Title'), subtitle: t_hero('slide3Subtitle'), cta: t_hero('slide3CTA'), bg: SLIDE_BGS[2] },
    { title: t_hero('slide4Title'), subtitle: t_hero('slide4Subtitle'), cta: t_hero('slide4CTA'), bg: SLIDE_BGS[3] },
    { title: t_hero('slide5Title'), subtitle: t_hero('slide5Subtitle'), cta: t_hero('slide5CTA'), bg: SLIDE_BGS[4] },
  ];

  const next = useCallback(() => setCurrent((c) => (c + 1) % SLIDE_BGS.length), []);
  const prev = useCallback(() => setCurrent((c) => (c - 1 + SLIDE_BGS.length) % SLIDE_BGS.length), []);

  useEffect(() => {
    const timer = setInterval(next, 6000);
    return () => clearInterval(timer);
  }, [next]);

  return (
    <section className="relative overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className={clsx('relative bg-gradient-to-br', SLIDES[current].bg)}
        >
          {/* Decorative circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-white/[0.04]" />
            <div className="absolute -left-10 bottom-0 w-72 h-72 rounded-full bg-[#C8A951]/[0.06]" />
            <div className="absolute right-1/3 bottom-10 w-48 h-48 rounded-full bg-white/[0.03]" />
          </div>

          {/* Animal watermark */}
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none">
            <Image
              src="/bd-bottom.png"
              alt=""
              width={1920}
              height={300}
              className="w-full h-auto object-cover opacity-[0.05]"
              aria-hidden="true"
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="max-w-3xl"
            >
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
                {SLIDES[current].title}
              </h2>
              <p className="text-lg text-white/70 mb-8 max-w-2xl leading-relaxed">
                {SLIDES[current].subtitle}
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={onLogin}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-[#C8A951] text-[#212529] hover:bg-[#B8952E] transition-colors"
                >
                  {SLIDES[current].cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={onSignup}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
                >
                  {t_hero('freeSignup')}
                </button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slider controls */}
      <button
        onClick={prev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={next}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {SLIDE_BGS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={clsx(
              'h-2 rounded-full transition-all duration-300',
              i === current ? 'w-8 bg-[#C8A951]' : 'w-2 bg-white/40 hover:bg-white/60',
            )}
          />
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH BAR
// ═══════════════════════════════════════════════════════════════════════════

function SearchSection() {
  const t_sections = useTranslations('sections');
  const [query, setQuery] = useState('');

  return (
    <section className="relative -mt-8 z-30 max-w-3xl mx-auto px-4">
      <div className="bg-white rounded-2xl shadow-[0_1rem_3rem_rgba(0,0,0,0.1)] p-2">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-[#adb5bd] ml-4 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t_sections('searchPlaceholder')}
            className="flex-1 py-3.5 text-sm text-[#212529] placeholder:text-[#adb5bd] focus:outline-none bg-transparent"
          />
          <button className="px-6 py-3 rounded-xl text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] transition-colors shrink-0">
            {t_sections('search')}
          </button>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS BAR
// ═══════════════════════════════════════════════════════════════════════════

function StatsBar() {
  const t_stats = useTranslations('stats');
  const [data, setData] = useState<{ courses: number; enrollments: number; certifications: number; countries: number } | null>(null);

  useEffect(() => {
    publicApi.stats()
      .then((res) => setData(res.data))
      .catch(() => setData({ courses: 12, enrollments: 850, certifications: 45, countries: 55 }));
  }, []);

  const stats = [
    { icon: BookOpen, value: data?.courses ?? '—', label: t_stats('coursesLabel') },
    { icon: Users, value: data?.enrollments ?? '—', label: t_stats('learnersLabel') },
    { icon: Globe, value: data?.countries ?? 55, label: t_stats('statesLabel') },
    { icon: Award, value: data?.certifications ?? '—', label: t_stats('certificatesLabel') },
  ];

  return (
    <section className="py-12 bg-white border-y border-[#dee2e6]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <s.icon className="w-8 h-8 text-[#1A5632] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[#212529]">
                {typeof s.value === 'number' ? s.value.toLocaleString('fr-FR') : s.value}
              </div>
              <div className="text-sm font-semibold text-[#6c757d] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

function CategoriesSection() {
  const t_sections = useTranslations('sections');
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    categoryApi.list()
      .then((res: any) => setCategories(res.data || []))
      .catch(() => {});
  }, []);

  return (
    <section id="categories" className="py-16 bg-[#f8f9fa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl lg:text-3xl font-bold text-[#212529] mb-3">
            {t_sections('categoriesTitle')}
          </h2>
          <p className="text-[#6c757d] max-w-2xl mx-auto">
            {t_sections('categoriesDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <motion.button
              key={cat.id}
              whileHover={{ y: -3 }}
              className="flex items-center gap-4 p-5 rounded-xl bg-white border border-[#dee2e6]/60 hover:shadow-[0_0.5rem_1rem_rgba(0,0,0,0.08)] transition-shadow text-left group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: (cat.color || '#1A5632') + '15' }}
              >
                <BookOpen className="w-6 h-6" style={{ color: cat.color || '#1A5632' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-[#212529] group-hover:text-[#1A5632] transition-colors">
                  {getLocalText(cat.name, 'fr')}
                </div>
                <div className="text-xs text-[#6c757d] mt-0.5">
                  {cat.course_count || 0} {t_sections('coursesAvailable')}
                </div>
                {cat.description && (
                  <div className="text-xs text-[#adb5bd] mt-1 line-clamp-1">
                    {getLocalText(cat.description, 'fr')}
                  </div>
                )}
              </div>
              <ArrowRight className="w-4 h-4 text-[#adb5bd] group-hover:text-[#1A5632] transition-colors shrink-0" />
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// COURSES
// ═══════════════════════════════════════════════════════════════════════════

function getLocalText(text: Record<string, string> | string | undefined, lang: string = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}

function CoursesSection({ onLogin }: { onLogin: () => void }) {
  const t_sections = useTranslations('sections');
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicApi.courses({ limit: 6, lang: 'fr' })
      .then((res) => {
        const items = res.data || [];
        setCourses(items.length > 0 ? items : FALLBACK_COURSES);
      })
      .catch(() => setCourses(FALLBACK_COURSES))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="courses" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold text-[#212529] mb-3">
              {t_sections('latestCourses')}
            </h2>
            <p className="text-[#6c757d]">
              {t_sections('expertDeveloped')}
            </p>
          </div>
          <button className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[#1A5632] hover:text-[#154528]">
            {t_sections('seeAll')} <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl overflow-hidden bg-white border border-[#dee2e6]/60 animate-pulse">
                <div className="h-40 bg-gray-100" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                  <div className="h-9 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => {
              const color = LEVEL_COLORS[course.level] || '#1A5632';
              const title = getLocalText(course.title, 'fr');
              const tags = course.tags || [];
              const category = tags[0] || course.level;

              return (
                <motion.div
                  key={course.id}
                  whileHover={{ y: -4 }}
                  className="rounded-xl overflow-hidden bg-white border border-[#dee2e6]/60 hover:shadow-[0_0.5rem_1rem_rgba(0,0,0,0.1)] transition-all group"
                >
                  {/* Course header */}
                  <Link href={`/catalog/${course.slug || course.id}`}>
                    <div
                      className="h-40 relative flex items-center justify-center cursor-pointer"
                      style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)` }}
                    >
                      <Image
                        src={course.thumbnail_url || '/au-logo.png'}
                        alt={title}
                        width={64}
                        height={64}
                        className="w-16 h-16 object-contain opacity-30"
                      />
                      <div className="absolute top-3 left-3">
                        <span
                          className="px-2.5 py-1 rounded-md text-xs font-medium text-white"
                          style={{ backgroundColor: color }}
                        >
                          {category}
                        </span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/90 text-[#495057]">
                          {LEVEL_LABELS[course.level] || course.level}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Course body */}
                  <div className="p-5">
                    <Link href={`/catalog/${course.slug || course.id}`}>
                      <h3 className="text-sm font-semibold text-[#212529] mb-3 line-clamp-2 group-hover:text-[#1A5632] transition-colors cursor-pointer">
                        {title}
                      </h3>
                    </Link>
                    <div className="flex items-center gap-4 text-xs text-[#6c757d] mb-4">
                      <span className="flex items-center gap-1">
                        <Play className="w-3.5 h-3.5" /> {course.estimated_hours ? `${course.estimated_hours}h` : '—'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> {(course.enrollment_count || 0).toLocaleString('fr-FR')}
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> {course.module_count || 0} modules
                      </span>
                    </div>
                    <button
                      onClick={onLogin}
                      className="w-full py-2.5 rounded-lg text-xs font-semibold border border-[#1A5632] text-[#1A5632] hover:bg-[#1A5632] hover:text-white transition-colors"
                    >
                      {t_sections('enrollCourse')}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <div className="sm:hidden mt-8 text-center">
          <button className="inline-flex items-center gap-2 text-sm font-semibold text-[#1A5632]">
            {t_sections('seeAll')} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ABOUT / CTA
// ═══════════════════════════════════════════════════════════════════════════

function AboutSection({ onLogin }: { onLogin: () => void }) {
  const t_about = useTranslations('about');
  return (
    <section id="about" className="py-16 bg-gradient-to-br from-[#1A5632] via-[#154528] to-[#144126] relative overflow-hidden">
      {/* Decorative */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -right-20 top-10 w-80 h-80 rounded-full bg-[#C8A951]/[0.06]" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 rounded-full bg-white/[0.03]" />
      </div>
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none select-none">
        <Image
          src="/bd-bottom.png"
          alt=""
          width={1920}
          height={300}
          className="w-full h-auto object-cover opacity-[0.04]"
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <Image src="/au-logo.png" alt="AU-IBAR" width={56} height={56} className="w-14 h-14 mx-auto mb-6 object-contain" />
          <h2 className="text-2xl lg:text-3xl font-bold text-white mb-4">
            {t_about('title')}
          </h2>
          <p className="text-white/70 leading-relaxed mb-8">
            {t_about('description')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold bg-[#C8A951] text-[#212529] hover:bg-[#B8952E] transition-colors"
            >
              {t_about('startNow')}
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="https://www.au-ibar.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold border border-white/30 text-white hover:bg-white/10 transition-colors"
            >
              {t_about('visitWebsite')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════════════════════════════════════

function Footer() {
  const t_footer = useTranslations('footer');
  const t_cat = useTranslations('categories');
  return (
    <footer>
      {/* ── Upper zone: links + filigranes ── */}
      <div className="relative bg-[#efece7] overflow-hidden">
        {/* Filigrane left */}
        <div className="absolute left-0 top-0 bottom-0 w-64 sm:w-80 lg:w-[400px] pointer-events-none select-none overflow-hidden">
          <Image
            src="/filigrane-left.png"
            alt=""
            width={600}
            height={800}
            className="w-full h-auto object-cover object-top opacity-60"
            aria-hidden="true"
          />
        </div>
        {/* Filigrane right */}
        <div className="absolute right-0 top-0 bottom-0 w-56 sm:w-72 lg:w-[350px] pointer-events-none select-none overflow-hidden">
          <Image
            src="/filigrane-right.png"
            alt=""
            width={600}
            height={800}
            className="w-full h-auto object-cover object-top opacity-60"
            aria-hidden="true"
          />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <Image src="/au-logo.png" alt="AU-IBAR" width={36} height={36} className="w-9 h-9 object-contain" />
                <div>
                  <span className="text-sm font-bold text-[#930e2d]">AU-IBAR</span>
                  <span className="text-sm font-bold text-[#1A5632] ml-1">Learning</span>
                </div>
              </div>
              <p className="text-xs leading-relaxed text-[#6c757d]">
                {t_footer('brandDescription')}
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm font-semibold text-[#212529] mb-4">{t_footer('programs')}</h4>
              <ul className="space-y-2 text-xs text-[#6c757d]">
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_cat('animalHealth')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_cat('animalProduction')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_cat('tradeMarketing')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_cat('fisheries')}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#212529] mb-4">{t_footer('resources')}</h4>
              <ul className="space-y-2 text-xs text-[#6c757d]">
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_footer('helpCenter')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_footer('privacyPolicy')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_footer('termsOfUse')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">{t_footer('accessibility')}</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-[#212529] mb-4">{t_footer('usefulLinks')}</h4>
              <ul className="space-y-2 text-xs text-[#6c757d]">
                <li><a href="https://www.au-ibar.org" target="_blank" rel="noopener noreferrer" className="hover:text-[#1A5632] transition-colors">au-ibar.org</a></li>
                <li><a href="https://au.int" target="_blank" rel="noopener noreferrer" className="hover:text-[#1A5632] transition-colors">{t_footer('africanUnion')}</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">AAGRIS</a></li>
                <li><a href="#" className="hover:text-[#1A5632] transition-colors">ARIS</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Lower zone: copyright ── */}
      <div className="bg-[#af9c63]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/90">
          <p>&copy; {new Date().getFullYear()} AU-IBAR &mdash; {t_footer('copyright')}</p>
          <div className="h-1 w-24 rounded bg-gradient-to-r from-[#1A5632] via-[#C8A951] to-[#930e2d]" />
        </div>
      </div>
    </footer>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGIN MODAL
// ═══════════════════════════════════════════════════════════════════════════

function LoginModal({ open, onClose, initialMode }: { open: boolean; onClose: () => void; initialMode?: 'login' | 'register' }) {
  const t_login = useTranslations('login');
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  // Modes: 'login' | 'register' | 'forgot' | 'reset'
  const resetToken = searchParams.get('reset');
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(resetToken ? 'reset' : (initialMode || 'login'));

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-open modal if reset token in URL
  useEffect(() => {
    if (resetToken) setMode('reset');
  }, [resetToken]);

  // Sync initialMode when modal opens
  useEffect(() => {
    if (open && initialMode && !resetToken) {
      setMode(initialMode);
      setError(null);
      setSuccess(null);
    }
  }, [open, initialMode, resetToken]);

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
        setError(data.error || t_login('invalidCredentials'));
        setLoading(false);
        return;
      }

      setAuth(data.user, data.token);
      document.cookie = `aris-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      toast.success(t_login('welcome', { name: data.user.firstName }));
      const redirect = searchParams.get('redirect') || '/';
      router.replace(redirect);
    } catch {
      toast.error(t_login('networkError'));
      setError(t_login('networkError'));
      setLoading(false);
    }
  };

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
          setError(t_login('emailExists'));
        } else {
          setError(data.error || t_login('registerError'));
        }
        setLoading(false);
        return;
      }

      setAuth(data.user, data.token);
      document.cookie = `aris-token=${data.token}; path=/; max-age=${60 * 60 * 24}; samesite=lax`;
      toast.success(t_login('registerSuccess'));
      const redirect = searchParams.get('redirect') || '/';
      router.replace(redirect);
    } catch {
      toast.error(t_login('networkError'));
      setError(t_login('networkError'));
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await fetch('/api/learning/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSuccess(t_login('resetEmailSent'));
    } catch {
      setError(t_login('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch('/api/learning/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t_login('resetFailed'));
      } else {
        setSuccess(t_login('resetSuccess'));
        setTimeout(() => { setMode('login'); setSuccess(null); }, 2000);
      }
    } catch {
      setError(t_login('networkError'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-11 pr-4 py-3 rounded-lg text-sm bg-white border border-[#ced4da] text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[rgba(26,86,50,0.25)] focus:border-[#1A5632] transition-all";

  const isOpen = open || mode === 'reset';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={mode !== 'reset' ? onClose : undefined} />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_1rem_3rem_rgba(0,0,0,0.15)] overflow-hidden"
          >
            {/* Modal top accent */}
            <div className="h-1 bg-gradient-to-r from-[#1A5632] via-[#C8A951] to-[#930e2d]" />

            <button
              onClick={() => { if (mode === 'forgot') { setMode('login'); setError(null); setSuccess(null); } else onClose(); }}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-[#f8f9fa] transition-colors z-10"
            >
              <X className="w-4 h-4 text-[#6c757d]" />
            </button>

            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <Image src="/au-logo.png" alt="AU-IBAR" width={40} height={40} className="w-10 h-10 object-contain" />
                <div>
                  <h2 className="text-lg font-bold text-[#212529]">
                    {mode === 'register' ? t_login('registerTitle') : mode === 'forgot' ? t_login('forgotTitle') : mode === 'reset' ? t_login('resetTitle') : t_login('title')}
                  </h2>
                  <p className="text-xs text-[#6c757d]">
                    {mode === 'register' ? t_login('registerSubtitle') : mode === 'forgot' ? t_login('forgotSubtitle') : mode === 'reset' ? t_login('resetSubtitle') : t_login('subtitle')}
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-[#dc3545]/5 border border-[#dc3545]/20">
                  <AlertTriangle className="w-4 h-4 text-[#dc3545] shrink-0" />
                  <p className="text-sm text-[#dc3545]">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 mb-5 rounded-lg bg-[#1A5632]/5 border border-[#1A5632]/20">
                  <Mail className="w-4 h-4 text-[#1A5632] shrink-0" />
                  <p className="text-sm text-[#1A5632]">{success}</p>
                </div>
              )}

              {/* LOGIN FORM */}
              {mode === 'login' && (
                <>
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label htmlFor="modal-email" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('email')}</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                        <input id="modal-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t_login('emailPlaceholder')} required className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="modal-password" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('password')}</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                        <input id="modal-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className={inputClass} />
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t_login('submitting')}</> : <>{t_login('submit')}<ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                  <button onClick={() => { setMode('forgot'); setError(null); setSuccess(null); }} className="mt-3 w-full text-center text-xs text-[#1A5632] font-semibold hover:underline">
                    {t_login('forgotPassword')}
                  </button>
                  <div className="mt-4 pt-4 border-t border-[#dee2e6]/60 text-center">
                    <span className="text-xs text-[#6c757d]">{t_login('noAccount')} </span>
                    <button onClick={() => { setMode('register'); setError(null); setSuccess(null); }} className="text-xs text-[#1A5632] font-semibold hover:underline">
                      {t_login('signup')}
                    </button>
                  </div>
                </>
              )}

              {/* REGISTER FORM */}
              {mode === 'register' && (
                <>
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="reg-firstName" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('firstName')}</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                          <input id="reg-firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t_login('firstNamePlaceholder')} required className={inputClass} />
                        </div>
                      </div>
                      <div>
                        <label htmlFor="reg-lastName" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('lastName')}</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                          <input id="reg-lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t_login('lastNamePlaceholder')} required className={inputClass} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-email" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('email')}</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                        <input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t_login('emailPlaceholder')} required className={inputClass} />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-password" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('password')}</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                        <input id="reg-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t_login('newPasswordPlaceholder')} required minLength={8} className={inputClass} />
                      </div>
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                      {loading ? <><Loader2 className="w-4 h-4 animate-spin" />{t_login('registering')}</> : <>{t_login('registerSubmit')}<ArrowRight className="w-4 h-4" /></>}
                    </button>
                  </form>
                  <div className="mt-4 pt-4 border-t border-[#dee2e6]/60 text-center">
                    <span className="text-xs text-[#6c757d]">{t_login('hasAccount')} </span>
                    <button onClick={() => { setMode('login'); setError(null); setSuccess(null); }} className="text-xs text-[#1A5632] font-semibold hover:underline">
                      {t_login('signinLink')}
                    </button>
                  </div>
                </>
              )}

              {/* FORGOT PASSWORD FORM */}
              {mode === 'forgot' && !success && (
                <form onSubmit={handleForgot} className="space-y-4">
                  <div>
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('email')}</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                      <input id="forgot-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t_login('emailPlaceholder')} required className={inputClass} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /></> : <>{t_login('sendResetLink')}<ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button type="button" onClick={() => { setMode('login'); setError(null); }} className="w-full text-center text-xs text-[#6c757d] hover:underline">
                    {t_login('backToLogin')}
                  </button>
                </form>
              )}

              {/* RESET PASSWORD FORM */}
              {mode === 'reset' && !success && (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label htmlFor="new-password" className="block text-sm font-medium text-[#495057] mb-1.5">{t_login('newPassword')}</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#adb5bd]" />
                      <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t_login('newPasswordPlaceholder')} required minLength={8} className={inputClass} />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-3 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] disabled:opacity-60 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /></> : <>{t_login('resetPassword')}<ArrowRight className="w-4 h-4" /></>}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

function LandingPage() {
  const searchParams = useSearchParams();
  const urlMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const hasRedirect = !!searchParams.get('redirect') || !!searchParams.get('reset');

  const [loginOpen, setLoginOpen] = useState(hasRedirect);
  const [modalMode, setModalMode] = useState<'login' | 'register'>(urlMode);
  const openLogin = useCallback(() => { setModalMode('login'); setLoginOpen(true); }, []);
  const openSignup = useCallback(() => { setModalMode('register'); setLoginOpen(true); }, []);

  return (
    <div className="min-h-screen bg-[#efece7]">
      <Navbar onLogin={openLogin} onSignup={openSignup} />
      <HeroSlider onLogin={openLogin} onSignup={openSignup} />
      <SearchSection />
      <StatsBar />
      <CategoriesSection />
      <CoursesSection onLogin={openLogin} />
      <AboutSection onLogin={openLogin} />
      <Footer />
      <Suspense fallback={null}>
        <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} initialMode={modalMode} />
      </Suspense>
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
      <LandingPage />
    </Suspense>
  );
}
