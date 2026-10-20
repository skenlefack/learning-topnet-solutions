'use client';
// ============================================================================
// Topnet Solutions Academy — Public Path Detail Page
// Shows path info, courses, certification requirements, enroll CTA
// ============================================================================
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Clock, Award, Users, ChevronRight,
  Loader2, CheckCircle2, Lock, Target, Shield,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function t(text: any, lang = 'fr') {
  if (!text) return '';
  if (typeof text === 'string') return text;
  return text[lang] || text.fr || text.en || '';
}

const LEVEL_META: Record<string, { color: string; label: string; badge: string; icon: string; prerequisite: string }> = {
  debutant: { color: '#1B0CB3', label: 'Débutant', badge: 'Foundation Certificate', icon: '🌱', prerequisite: '' },
  intermediaire: { color: '#0D47A1', label: 'Intermédiaire', badge: 'Practitioner Certificate', icon: '📘', prerequisite: 'Certificat Débutant requis' },
  avance: { color: '#1B0CB3', label: 'Avancé', badge: 'Senior Specialist Certificate', icon: '🎯', prerequisite: 'Certificat Intermédiaire requis' },
  expert: { color: '#A09060', label: 'Expert', badge: 'Master Certificate', icon: '👑', prerequisite: 'Certificat Avancé requis' },
};

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#1B0CB3', intermediate: '#009930', advanced: '#1B0CB3', expert: '#0D0670',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PathDetailPage() {
  const { id: slug } = useParams<{ id: string }>();
  const [path, setPath] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/paths/${slug}`)
      .then(r => r.json())
      .then(res => setPath(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#efece7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B0CB3]" />
      </div>
    );
  }

  if (!path) {
    return (
      <div className="min-h-screen bg-[#efece7] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#6c757d]">Parcours non trouvé</p>
          <Link href="/" className="text-sm text-[#1B0CB3] hover:underline mt-2 inline-block">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  const title = t(path.title);
  const desc = t(path.description);
  const tags = path.tags || [];
  const lvlKey = tags.find((tg: string) => LEVEL_META[tg]) || 'debutant';
  const meta = LEVEL_META[lvlKey];
  const courses = path.courses || [];

  return (
    <div className="min-h-screen bg-[#efece7]">
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-[#1B0CB3] via-[#00B341] to-[#1B0CB3]" />

      {/* Header */}
      <header className="bg-white border-b border-[#dee2e6]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-topnet.jpg" alt="Topnet Solutions" width={130} height={130} className="w-[130px] h-auto object-contain" />
            <div>
              <span className="text-sm font-bold text-[#1B0CB3]">Topnet Solutions</span>
              <span className="text-sm font-bold text-[#1B0CB3] ml-1">Academy</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
          </Link>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shrink-0">
              {meta.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white uppercase tracking-wider">
                  {meta.badge}
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-3">{title}</h1>
              <p className="text-white/70 text-sm max-w-2xl leading-relaxed">{desc}</p>
              <div className="flex items-center gap-5 mt-4 text-sm text-white/60">
                <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" /> {courses.length} cours</span>
                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {path.estimated_hours || '—'}h</span>
                <span className="flex items-center gap-1.5"><Target className="w-4 h-4" /> {path.passing_score || 70}% requis</span>
                <span className="flex items-center gap-1.5"><Award className="w-4 h-4" /> Certificat inclus</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Course list */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold text-[#212529] flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: meta.color }} />
              Programme du parcours
            </h2>

            {courses.map((pc: any, i: number) => {
              const course = pc.course || pc;
              const cTitle = t(course.title);
              const cDesc = t(course.description);
              const cColor = LEVEL_COLORS[course.level] || '#1B0CB3';

              return (
                <div key={course.id || i} className="flex items-start gap-4 p-5 rounded-xl bg-white border border-[#dee2e6]/60 hover:shadow-md transition-shadow group">
                  {/* Step number */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                    style={{ backgroundColor: meta.color }}
                  >
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-[#212529] group-hover:text-[#1B0CB3] transition-colors">
                        {cTitle}
                      </h3>
                      {pc.is_required && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white bg-red-500">Obligatoire</span>
                      )}
                    </div>
                    <p className="text-xs text-[#6c757d] line-clamp-2 mb-2">{cDesc}</p>
                    <div className="flex items-center gap-3 text-[10px] text-[#adb5bd]">
                      <span className="px-1.5 py-0.5 rounded text-white text-[9px] font-medium" style={{ backgroundColor: cColor }}>
                        {course.level}
                      </span>
                      <span>{course.estimated_hours || '—'}h</span>
                      <span>{course.module_count || 0} modules</span>
                    </div>
                  </div>

                  <Link href={`/catalog/${course.slug || course.id}`} className="shrink-0">
                    <ChevronRight className="w-5 h-5 text-[#adb5bd] group-hover:text-[#1B0CB3] transition-colors" />
                  </Link>
                </div>
              );
            })}

            {/* Exam info */}
            <div className="p-5 rounded-xl border-2 border-dashed border-[#dee2e6] bg-[#f8f9fa] text-center">
              <Shield className="w-8 h-8 mx-auto text-[#adb5bd] mb-2" />
              <h3 className="text-sm font-semibold text-[#212529] mb-1">Examen final du parcours</h3>
              <p className="text-xs text-[#6c757d] max-w-md mx-auto">
                Après avoir complété tous les cours, passez l'examen final ({path.passing_score || 70}% requis).
                La réussite déclenche automatiquement la génération de votre certificat {meta.badge}.
              </p>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-5">
            {/* Enroll CTA */}
            <div className="rounded-xl bg-white border border-[#dee2e6]/60 p-5 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-3xl" style={{ backgroundColor: meta.color + '15' }}>
                {meta.icon}
              </div>
              <div>
                <p className="text-lg font-bold text-[#212529]">{meta.badge}</p>
                <p className="text-xs text-[#6c757d] mt-1">{courses.length} cours &bull; {path.estimated_hours}h &bull; Certificat officiel</p>
              </div>
              <Link
                href={`/?redirect=/courses&mode=register`}
                className="block w-full py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: meta.color }}
              >
                S'inscrire au parcours
              </Link>
              <Link
                href={`/?redirect=/courses`}
                className="block w-full py-2.5 rounded-xl text-sm font-medium text-[#495057] border border-[#dee2e6] hover:bg-[#f8f9fa] transition-colors"
              >
                Se connecter
              </Link>
            </div>

            {/* Prerequisite */}
            {meta.prerequisite && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
                <Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Prérequis</p>
                  <p className="text-xs text-amber-700 mt-0.5">{meta.prerequisite}</p>
                </div>
              </div>
            )}

            {/* What you'll get */}
            <div className="rounded-xl bg-white border border-[#dee2e6]/60 p-5 space-y-3">
              <h4 className="text-xs font-semibold text-[#495057] uppercase tracking-wider">Ce que vous obtiendrez</h4>
              {[
                { icon: Award, text: `Certificat ${meta.badge} officiel Topnet Solutions` },
                { icon: CheckCircle2, text: 'Certificat vérifiable avec QR code' },
                { icon: BookOpen, text: `${courses.length} cours complets avec exercices pratiques` },
                { icon: Target, text: 'Examen final de validation des compétences' },
                ...(meta.prerequisite ? [{ icon: ChevronRight, text: 'Débloque le niveau supérieur' }] : []),
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <item.icon className="w-4 h-4 shrink-0" style={{ color: meta.color }} />
                  <span className="text-xs text-[#495057]">{item.text}</span>
                </div>
              ))}
            </div>

            {/* Certification levels */}
            <div className="rounded-xl bg-white border border-[#dee2e6]/60 p-5 space-y-3">
              <h4 className="text-xs font-semibold text-[#495057] uppercase tracking-wider">Tous les niveaux</h4>
              {Object.entries(LEVEL_META).map(([key, lm]) => (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-2.5 rounded-lg ${key === lvlKey ? 'bg-gray-50 ring-1 ring-gray-200' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm" style={{ backgroundColor: lm.color + '15' }}>
                    {lm.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#212529]">{lm.label}</p>
                    <p className="text-[10px] text-[#adb5bd]">{lm.badge}</p>
                  </div>
                  {key === lvlKey && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: lm.color }}>
                      Actuel
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#af9c63] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between text-xs text-white/90">
          <p>&copy; {new Date().getFullYear()} Topnet Solutions — Tous droits réservés</p>
          <div className="h-1 w-24 rounded bg-gradient-to-r from-[#1B0CB3] via-[#00B341] to-[#1B0CB3]" />
        </div>
      </footer>
    </div>
  );
}
