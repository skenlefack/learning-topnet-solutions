'use client';
// ============================================================================
// AU-IBAR Learning — Public Course Catalog Detail
// Shows course presentation & program (modules) without authentication
// ============================================================================
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BookOpen, Clock, Users, Award,
  ChevronDown, ChevronUp, Layers, GraduationCap, Lock,
} from 'lucide-react';
import clsx from 'clsx';
import { useTranslations } from 'next-intl';
import { publicApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalText(text: Record<string, string> | string | undefined, lang: string = 'fr'): string {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || Object.values(text)[0] || '';
}

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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CatalogDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const t = useTranslations('catalog');
  const lang = 'fr';

  const [course, setCourse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!id) return;
    publicApi.course(id, { lang })
      .then((res) => setCourse(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa]">
        <div className="max-w-5xl mx-auto px-4 py-12 animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
          <div className="h-64 bg-gray-200 rounded-2xl mb-8" />
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#212529] mb-2">{t('notFound')}</h1>
          <p className="text-[#6c757d] mb-6">{t('notFoundDesc')}</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t('backToHome')}
          </Link>
        </div>
      </div>
    );
  }

  const title = getLocalText(course.title, lang);
  const description = getLocalText(course.description, lang);
  const descriptionHtml = course.metadata?.descriptionHtml || '';
  const color = LEVEL_COLORS[course.level] || '#1A5632';
  const modules = course.modules || [];
  const totalLessons = modules.reduce((sum: number, m: any) => sum + (m.lesson_count || 0), 0);
  const totalMinutes = modules.reduce((sum: number, m: any) => sum + (m.estimated_minutes || 0), 0);

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-[#1A5632] via-[#C8A951] to-[#930e2d]" />

      {/* Navbar minimal */}
      <nav className="bg-white border-b border-[#dee2e6]/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-3">
            <Image src="/au-logo.png" alt="AU-IBAR" width={32} height={32} className="w-8 h-8 object-contain" />
            <div>
              <span className="text-sm font-bold text-[#930e2d]">AU-IBAR</span>
              <span className="text-sm font-bold text-[#1A5632] ml-1">Learning</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={`/?redirect=/courses/${course.id}&mode=register`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-[#1A5632] text-[#1A5632] hover:bg-[#1A5632]/5 transition-colors"
            >
              {t('signup')}
            </Link>
            <Link
              href={`/?redirect=/courses/${course.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] transition-colors"
            >
              {t('login')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}f2, ${color}cc)` }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-white/[0.04]" />
          <div className="absolute -left-10 bottom-0 w-60 h-60 rounded-full bg-[#C8A951]/[0.06]" />
        </div>

        {/* Course image — faded on the right */}
        {course.thumbnail_url && (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 lg:w-2/5 pointer-events-none select-none hidden md:block">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-transparent" style={{ background: `linear-gradient(to right, ${color}f2 0%, transparent 100%)` }} />
            <Image
              src={course.thumbnail_url}
              alt=""
              width={600}
              height={400}
              className="w-full h-full object-cover opacity-20"
              aria-hidden="true"
            />
          </div>
        )}
        {!course.thumbnail_url && (
          <div className="absolute right-0 top-0 bottom-0 w-1/3 lg:w-2/5 pointer-events-none select-none hidden md:flex items-center justify-center">
            <Image
              src="/au-logo.png"
              alt=""
              width={200}
              height={200}
              className="w-48 h-48 object-contain opacity-10"
              aria-hidden="true"
            />
          </div>
        )}

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-white/70 hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {t('backToHome')}
          </Link>

          <div className="flex items-start gap-2 mb-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/20 text-white">
              {LEVEL_LABELS[course.level] || course.level}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-4 max-w-3xl">
            {title}
          </h1>

          {description && (
            <p className="text-white/80 text-sm sm:text-base max-w-2xl leading-relaxed mb-6">
              {description}
            </p>
          )}

          {/* Meta stats */}
          <div className="flex flex-wrap gap-6 text-white/90 text-sm">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              <span>{modules.length} modules</span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              <span>{totalLessons} {t('lessons')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{course.estimated_hours ? `${course.estimated_hours}h` : `${Math.round(totalMinutes / 60)}h`}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>{(course.enrollment_count || 0).toLocaleString('fr-FR')} {t('enrolled')}</span>
            </div>
            {course.passing_score && (
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" />
                <span>{t('passingScore')}: {course.passing_score}%</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column (2/3) — Summary + Prerequisites + Program */}
          <div className="lg:col-span-2 space-y-8">

            {/* Summary */}
            {(descriptionHtml || description) && (
              <div>
                <h2 className="text-base font-bold text-[#212529] mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#1A5632]" />
                  {t('summary')}
                </h2>
                {descriptionHtml ? (
                  <div
                    className="prose prose-sm max-w-none text-[#495057] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: descriptionHtml }}
                  />
                ) : (
                  <p className="text-sm text-[#495057] leading-relaxed">{description}</p>
                )}
                {course.tags && course.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {course.tags.map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#f8f9fa] text-[#495057] border border-[#dee2e6]/60"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prerequisites */}
            <div>
              <h2 className="text-base font-bold text-[#212529] mb-3 flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#B8952E]" />
                {t('prerequisites')}
              </h2>
              {course.prerequisites && course.prerequisites.length > 0 ? (
                <ul className="space-y-2">
                  {course.prerequisites.map((prereq: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-[#495057]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#B8952E] mt-1.5 shrink-0" />
                      {prereq}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#6c757d] italic">
                  {t('noPrerequisites')}
                </p>
              )}
            </div>

            {/* Program */}
            <div>
            <h2 className="text-lg font-bold text-[#212529] mb-5 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#1A5632]" />
              {t('program')}
            </h2>

            <div className="space-y-3">
              {modules.map((mod: any, idx: number) => {
                const isExpanded = expandedModules.has(mod.id);
                const modTitle = getLocalText(mod.title, lang);
                const modDesc = getLocalText(mod.description, lang);

                return (
                  <motion.div
                    key={mod.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="rounded-xl bg-white border border-[#dee2e6]/60 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleModule(mod.id)}
                      className="w-full flex items-center gap-4 p-4 text-left hover:bg-[#f8f9fa] transition-colors"
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[#212529] truncate">
                          {modTitle}
                        </h3>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-[#6c757d]">
                          <span>{mod.lesson_count} {t('lessons')}</span>
                          {mod.estimated_minutes && (
                            <span>{mod.estimated_minutes} min</span>
                          )}
                          {mod.is_required === false && (
                            <span className="text-[#B8952E]">{t('optional')}</span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#6c757d] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#6c757d] shrink-0" />
                      )}
                    </button>

                    {isExpanded && modDesc && (
                      <div className="px-4 pb-4 pt-0 ml-12">
                        <p className="text-xs text-[#6c757d] leading-relaxed">{modDesc}</p>
                        <div className="mt-3 flex items-center gap-2 text-xs text-[#adb5bd]">
                          <Lock className="w-3.5 h-3.5" />
                          <span>{t('loginToAccess')}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
            </div>
          </div>

          {/* CTA Sidebar — Right (1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Enroll CTA */}
              <div className="rounded-xl bg-white border border-[#dee2e6]/60 p-6 text-center">
                <GraduationCap className="w-10 h-10 text-[#1A5632] mx-auto mb-3" />
                <h3 className="text-sm font-bold text-[#212529] mb-2">
                  {t('enrollTitle')}
                </h3>
                <p className="text-xs text-[#6c757d] mb-5 leading-relaxed">
                  {t('enrollDesc')}
                </p>
                <Link
                  href={`/?redirect=/courses/${course.id}&mode=register`}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold bg-[#1A5632] text-white hover:bg-[#154528] transition-colors"
                >
                  {t('enrollCTA')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href={`/?redirect=/courses/${course.id}`}
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-[#6c757d] hover:text-[#1A5632] transition-colors"
                >
                  {t('login')}
                </Link>
              </div>

              {/* Course info */}
              <div className="rounded-xl bg-white border border-[#dee2e6]/60 p-5">
                <h4 className="text-xs font-bold text-[#212529] uppercase tracking-wide mb-3">
                  {t('courseInfo')}
                </h4>
                <dl className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#6c757d]">{t('level')}</dt>
                    <dd className="font-medium text-[#212529]">{LEVEL_LABELS[course.level] || course.level}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6c757d]">{t('duration')}</dt>
                    <dd className="font-medium text-[#212529]">{course.estimated_hours || Math.round(totalMinutes / 60)}h</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6c757d]">Modules</dt>
                    <dd className="font-medium text-[#212529]">{modules.length}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6c757d]">{t('lessons')}</dt>
                    <dd className="font-medium text-[#212529]">{totalLessons}</dd>
                  </div>
                  {course.passing_score && (
                    <div className="flex justify-between">
                      <dt className="text-[#6c757d]">{t('passingScore')}</dt>
                      <dd className="font-medium text-[#212529]">{course.passing_score}%</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Certification badge */}
              <div className="rounded-xl bg-gradient-to-br from-[#1A5632]/5 to-[#C8A951]/5 border border-[#1A5632]/10 p-5 text-center">
                <Award className="w-8 h-8 text-[#C8A951] mx-auto mb-2" />
                <p className="text-xs text-[#495057] leading-relaxed">
                  {t('certificationBadge')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#af9c63] py-5">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-white/90">
          &copy; {new Date().getFullYear()} AU-IBAR &mdash; African Union Interafrican Bureau for Animal Resources
        </div>
      </footer>
    </div>
  );
}
