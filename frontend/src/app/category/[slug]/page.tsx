'use client';
// ============================================================================
// AU-IBAR Learning — Category Page (Public)
// Lists courses for a category + right sidebar with other categories,
// latest courses, and popular courses
// ============================================================================
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Clock, Users, Play, ArrowRight, Loader2,
  ChevronRight, TrendingUp,
} from 'lucide-react';
import clsx from 'clsx';
import { publicApi, categoryApi } from '@/lib/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: '#1A5632', intermediate: '#B8952E', advanced: '#930e2d', expert: '#154528',
};
const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé', expert: 'Expert',
};

// ---------------------------------------------------------------------------
// Course Card
// ---------------------------------------------------------------------------

function CourseCard({ course }: { course: any }) {
  const color = LEVEL_COLORS[course.level] || '#1A5632';
  const title = getLocalText(course.title, 'fr');

  return (
    <Link href={`/catalog/${course.slug || course.id}`}>
      <div className="rounded-xl overflow-hidden bg-white border border-[#dee2e6]/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group">
        {/* Image full width */}
        <div className="relative aspect-[16/9] overflow-hidden">
          {course.thumbnail_url ? (
            <Image src={course.thumbnail_url} alt={title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}20, ${color}08)` }}>
              <Image src="/au-logo.png" alt="" width={48} height={48} className="opacity-20" />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-medium text-white shadow-sm" style={{ backgroundColor: color }}>
              {LEVEL_LABELS[course.level] || course.level}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-4">
          <h3 className="text-sm font-semibold text-[#212529] mb-2 line-clamp-2 group-hover:text-[#1A5632] transition-colors">{title}</h3>
          <p className="text-xs text-[#6c757d] line-clamp-2 mb-3">{getLocalText(course.description, 'fr')}</p>
          <div className="flex items-center gap-3 text-xs text-[#6c757d]">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {course.estimated_hours || '—'}h</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {(course.enrollment_count || 0).toLocaleString('fr-FR')}</span>
            <span className="flex items-center gap-1"><BookOpen className="w-3.5 h-3.5" /> {course.module_count || 0} mod.</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Sidebar: small course card
// ---------------------------------------------------------------------------

function SmallCourseCard({ course }: { course: any }) {
  const color = LEVEL_COLORS[course.level] || '#1A5632';
  const title = getLocalText(course.title, 'fr');

  return (
    <Link href={`/catalog/${course.slug || course.id}`} className="flex items-start gap-3 group">
      <div className="w-16 h-12 rounded-lg overflow-hidden shrink-0 relative">
        {course.thumbnail_url ? (
          <Image src={course.thumbnail_url} alt="" fill className="object-cover" />
        ) : (
          <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${color}25, ${color}10)` }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#212529] line-clamp-2 group-hover:text-[#1A5632] transition-colors">{title}</p>
        <p className="text-[10px] text-[#6c757d] mt-0.5">{course.estimated_hours || '—'}h &bull; {LEVEL_LABELS[course.level] || ''}</p>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [category, setCategory] = useState<any>(null);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Fetch all categories
        const catRes: any = await categoryApi.list();
        const cats = catRes.data || [];
        setAllCategories(cats);

        // Find current category by slug or id
        const current = cats.find((c: any) => c.slug === slug || c.id === slug);
        setCategory(current);

        // Fetch all courses
        const coursesRes: any = await publicApi.courses({ limit: 100 });
        const all = coursesRes.data || [];
        setAllCourses(all);

        // Filter courses by category
        if (current) {
          setCourses(all.filter((c: any) => c.category_id === current.id));
        }
      } catch {}
      finally { setLoading(false); }
    })();
  }, [slug]);

  // Derived data for sidebar
  const latestCourses = [...allCourses].sort((a, b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  ).slice(0, 5);

  const popularCourses = [...allCourses].sort((a, b) =>
    (b.enrollment_count || 0) - (a.enrollment_count || 0)
  ).slice(0, 5);

  const otherCategories = allCategories.filter(c => c.id !== category?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#efece7] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A5632]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#efece7]">
      {/* Top accent */}
      <div className="h-1 bg-gradient-to-r from-[#1A5632] via-[#C8A951] to-[#930e2d]" />

      {/* Header */}
      <header className="bg-white border-b border-[#dee2e6]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/au-logo.png" alt="AU-IBAR" width={36} height={36} className="w-9 h-9 object-contain" />
              <div>
                <span className="text-sm font-bold text-[#930e2d]">AU-IBAR</span>
                <span className="text-sm font-bold text-[#1A5632] ml-1">Learning</span>
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero banner */}
      {category && (
        <div className="relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${category.color || '#1A5632'}15, ${category.color || '#1A5632'}05)` }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-[#6c757d] hover:text-[#1A5632] mb-4 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Retour à l'accueil
            </Link>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: (category.color || '#1A5632') + '20' }}>
                <BookOpen className="w-7 h-7" style={{ color: category.color || '#1A5632' }} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold text-[#212529]">{getLocalText(category.name, 'fr')}</h1>
                {category.description && (
                  <p className="text-sm text-[#6c757d] mt-1">{getLocalText(category.description, 'fr')}</p>
                )}
                <p className="text-xs text-[#adb5bd] mt-1">{courses.length} cours disponible{courses.length > 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Course grid */}
          <div className="flex-1">
            {courses.length === 0 ? (
              <div className="text-center py-16">
                <BookOpen className="w-14 h-14 mx-auto text-[#dee2e6] mb-4" />
                <p className="text-[#6c757d]">Aucun cours dans cette catégorie pour le moment.</p>
                <Link href="/" className="text-sm text-[#1A5632] hover:underline mt-2 inline-block">
                  Voir tous les cours
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {courses.map(course => (
                  <CourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <aside className="w-full lg:w-80 shrink-0 space-y-6">
            {/* Other categories */}
            {otherCategories.length > 0 && (
              <div className="rounded-xl bg-white border border-[#dee2e6]/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#dee2e6]/60 bg-[#f8f9fa]">
                  <h3 className="text-xs font-semibold text-[#495057] uppercase tracking-wider">Catégories</h3>
                </div>
                <div className="divide-y divide-[#dee2e6]/40">
                  {otherCategories.map(cat => (
                    <Link key={cat.id} href={`/category/${cat.slug || cat.id}`}>
                      <div className="flex items-center gap-3 px-4 py-3 hover:bg-[#f8f9fa] transition-colors group">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (cat.color || '#1A5632') + '15' }}>
                          <BookOpen className="w-4 h-4" style={{ color: cat.color || '#1A5632' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#212529] group-hover:text-[#1A5632] transition-colors truncate">{getLocalText(cat.name, 'fr')}</p>
                          <p className="text-[10px] text-[#adb5bd]">{cat.course_count || 0} cours</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-[#adb5bd] group-hover:text-[#1A5632]" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Latest courses */}
            {latestCourses.length > 0 && (
              <div className="rounded-xl bg-white border border-[#dee2e6]/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#dee2e6]/60 bg-[#f8f9fa]">
                  <h3 className="text-xs font-semibold text-[#495057] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Derniers cours publiés
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {latestCourses.map(course => (
                    <SmallCourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            )}

            {/* Popular courses */}
            {popularCourses.length > 0 && (
              <div className="rounded-xl bg-white border border-[#dee2e6]/60 overflow-hidden">
                <div className="px-4 py-3 border-b border-[#dee2e6]/60 bg-[#f8f9fa]">
                  <h3 className="text-xs font-semibold text-[#495057] uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Cours populaires
                  </h3>
                </div>
                <div className="p-4 space-y-4">
                  {popularCourses.map(course => (
                    <SmallCourseCard key={course.id} course={course} />
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#af9c63] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between text-xs text-white/90">
          <p>&copy; {new Date().getFullYear()} AU-IBAR — African Union Interafrican Bureau for Animal Resources</p>
          <div className="h-1 w-24 rounded bg-gradient-to-r from-[#1A5632] via-[#C8A951] to-[#930e2d]" />
        </div>
      </footer>
    </div>
  );
}
