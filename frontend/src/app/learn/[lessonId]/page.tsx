'use client';
// ============================================================================
// Topnet Solutions Academy — Lesson Player (immersive)
// Video (HLS / heartbeat / resume / auto-complete), Text (scroll tracking),
// Quiz (one-at-a-time, timer, feedback), Replay, prev/next, module sidebar
// ============================================================================
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Play,
  FileText,
  HelpCircle,
  Wrench,
  RotateCcw,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { lessonApi, learningApi, courseApi } from '@/lib/api';
import { t, formatDuration } from '@/lib/utils';
import { useTranslations } from 'next-intl';

import DocumentViewer from '../_components/DocumentViewer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuizQuestion {
  id: string;
  text: Record<string, string> | string;
  options: { id: string; text: Record<string, string> | string; isCorrect?: boolean }[];
  explanation?: Record<string, string> | string;
  timeLimit?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEARTBEAT_INTERVAL = 30_000; // 30s
const AUTO_COMPLETE_THRESHOLD = 0.9; // 90%

const TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  video: Play,
  text: FileText,
  quiz: HelpCircle,
  practical: Wrench,
  replay: RotateCcw,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LessonPlayerPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const t_lesson = useTranslations('lesson');
  const t_quiz = useTranslations('quiz');
  const t_video = useTranslations('video');

  // Fetch lesson context (lesson + module + course + enrollment + progress + nav)
  const { data: ctxRes, isLoading, mutate: mutateCtx } = useSWR(
    token && lessonId ? ['lesson-ctx', lessonId] : null,
    () => lessonApi.context(token!, lessonId),
  );

  const ctx = (ctxRes as any)?.data ?? ctxRes ?? null;
  const lesson = ctx?.lesson;
  const mod = ctx?.module;
  const course = ctx?.course;
  const enrollment = ctx?.enrollment;
  const progress = ctx?.progress;
  const prevId: string | null = ctx?.prev ?? null;
  const nextId: string | null = ctx?.next ?? null;

  // Fetch all modules for sidebar navigation
  const courseId = course?.id ?? lesson?.course_id;
  const { data: modulesRes } = useSWR(
    token && courseId ? ['modules-nav', courseId] : null,
    () => courseApi.modules(token!, courseId),
  );
  const allModules: any[] = (modulesRes as any)?.data ?? [];

  // Mark lesson complete
  const markComplete = useCallback(async () => {
    if (!token || !enrollment || !lesson) return;
    try {
      await learningApi.updateProgress(token, {
        lessonId: lesson.id,
        enrollmentId: enrollment.id,
        isCompleted: true,
      });
      mutateCtx();
    } catch { /* ignore */ }
  }, [token, enrollment, lesson, mutateCtx]);

  // ---- Loading / Error states ----

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-navy dark:text-brand-gold" />
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-30 mb-3" />
          <p className="text-[var(--text-secondary)]">{t_lesson('notFound')}</p>
          <Link href="/courses" className="text-sm text-brand-navy dark:text-brand-gold mt-2 inline-block hover:underline">
            {t_lesson('backToCourses')}
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = progress?.is_completed;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      {/* Top bar */}
      <header
        className={clsx(
          'sticky top-0 z-40 h-12 flex items-center justify-between px-4',
          'bg-white/90 dark:bg-surface-dark-card/90 glass border-b border-[var(--border)]',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/dashboard" className="shrink-0">
            <img src="/logo-topnet.jpg" alt="Topnet Solutions" className="w-[120px] h-auto object-contain" />
          </Link>
          <Link
            href={courseId ? `/courses/${courseId}` : '/courses'}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-secondary)] truncate">
              {t(course?.title, language)}
            </p>
            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
              {t(lesson.title, language)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Prev / Next */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => prevId && router.push(`/learn/${prevId}`)}
              disabled={!prevId}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                prevId
                  ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
              )}
              title={t_lesson('previous')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => nextId && router.push(`/learn/${nextId}`)}
              disabled={!nextId}
              className={clsx(
                'p-1.5 rounded-lg transition-colors',
                nextId
                  ? 'hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]'
                  : 'text-gray-300 dark:text-gray-600 cursor-not-allowed',
              )}
              title={t_lesson('next')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Module sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--text-secondary)]"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Content area */}
      <div className="flex-1 flex relative">
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 space-y-4">
            {/* Completion badge */}
            {isCompleted && (
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 rounded-lg px-4 py-2">
                <CheckCircle2 className="w-4 h-4" />
                {t_lesson('completed')}
              </div>
            )}

            {/* Render by type */}
            {lesson.type === 'video' && (
              <VideoPlayer
                lesson={lesson}
                progress={progress}
                enrollment={enrollment}
                token={token!}
                onComplete={markComplete}
              />
            )}
            {lesson.type === 'replay' && (
              <VideoPlayer
                lesson={lesson}
                progress={progress}
                enrollment={enrollment}
                token={token!}
                onComplete={markComplete}
              />
            )}
            {lesson.type === 'text' && lesson.content?.documentUrl && (
              <DocumentViewer
                url={lesson.content.documentUrl}
                pdfPreviewUrl={lesson.content.pdfPreviewUrl}
                mimeType={lesson.content.documentType}
                filename={lesson.content.documentName}
                onProgress={(p: number) => { if (p >= 90 && !isCompleted) markComplete(); }}
              />
            )}
            {lesson.type === 'text' && !lesson.content?.documentUrl && (
              <TextRenderer
                lesson={lesson}
                lang={language}
                progress={progress}
                enrollment={enrollment}
                token={token!}
                onComplete={markComplete}
              />
            )}
            {lesson.type === 'quiz' && (
              <QuizEngine
                lesson={lesson}
                lang={language}
                progress={progress}
                enrollment={enrollment}
                token={token!}
                onComplete={markComplete}
              />
            )}
            {lesson.type === 'practical' && (
              <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-6">
                <h2 className="text-lg font-semibold mb-3">{t(lesson.title, language)}</h2>
                <div className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)]">
                  <p>{t(lesson.content?.description ?? lesson.content?.body, language)}</p>
                </div>
                {!isCompleted && (
                  <button
                    onClick={markComplete}
                    className="mt-4 px-6 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark"
                  >
                    {t_lesson('markCompleted')}
                  </button>
                )}
              </div>
            )}

            {/* Next lesson CTA */}
            {isCompleted && nextId && (
              <div className="flex justify-end pt-2">
                <Link
                  href={`/learn/${nextId}`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark transition-colors"
                >
                  {t_lesson('next')}
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </main>

        {/* Module sidebar overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/30 lg:hidden"
                onClick={() => setSidebarOpen(false)}
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className={clsx(
                  'fixed right-0 top-12 bottom-0 z-50 w-72 overflow-y-auto',
                  'bg-white dark:bg-surface-dark-card border-l border-[var(--border)]',
                  'lg:static lg:z-auto lg:border-l',
                )}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      {t_lesson('modules')}
                    </h3>
                    <button
                      onClick={() => setSidebarOpen(false)}
                      className="lg:hidden p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <X className="w-4 h-4 text-[var(--text-secondary)]" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {allModules
                      .sort((a: any, b: any) => a.sort_order - b.sort_order)
                      .map((m: any) => {
                        const lessons = [...(m.lessons ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
                        return (
                          <div key={m.id}>
                            <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5 px-1">
                              {t(m.title, language)}
                            </p>
                            <div className="space-y-0.5">
                              {lessons.map((l: any) => {
                                const isActive = l.id === lessonId;
                                const Icon = TYPE_ICONS[l.type] || FileText;
                                return (
                                  <Link
                                    key={l.id}
                                    href={`/learn/${l.id}`}
                                    onClick={() => setSidebarOpen(false)}
                                    className={clsx(
                                      'flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors',
                                      isActive
                                        ? 'bg-brand-navy/5 dark:bg-brand-navy/20 text-brand-navy dark:text-white font-medium'
                                        : 'text-[var(--text-secondary)] hover:bg-gray-50 dark:hover:bg-gray-800/50',
                                    )}
                                  >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate flex-1">{t(l.title, language)}</span>
                                    {l.duration_minutes && (
                                      <span className="text-[10px] shrink-0">{l.duration_minutes}m</span>
                                    )}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ===========================================================================
// VIDEO PLAYER — HLS, heartbeat, resume, auto-complete at 90%
// ===========================================================================

function VideoPlayer({
  lesson,
  progress,
  enrollment,
  token,
  onComplete,
}: {
  lesson: any;
  progress: any;
  enrollment: any;
  token: string;
  onComplete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const completedRef = useRef(false);
  const language = useAuthStore((s) => s.language);

  const videoUrl = lesson.video_url || lesson.content?.videoUrl || '';
  const resumeAt = progress?.last_position_seconds ?? 0;

  // Initialize HLS if needed
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    let hls: any = null;

    if (videoUrl.includes('.m3u8')) {
      // Dynamic import of hls.js
      import('hls.js')
        .then((Hls) => {
          const HlsClass = Hls.default || Hls;
          if (HlsClass.isSupported()) {
            hls = new HlsClass();
            hls.loadSource(videoUrl);
            hls.attachMedia(video);
            hls.on(HlsClass.Events.MANIFEST_PARSED, () => {
              if (resumeAt > 0) video.currentTime = resumeAt;
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoUrl;
            video.addEventListener('loadedmetadata', () => {
              if (resumeAt > 0) video.currentTime = resumeAt;
            }, { once: true });
          }
        })
        .catch(() => {
          // hls.js not installed — fallback to native
          video.src = videoUrl;
          video.addEventListener('loadedmetadata', () => {
            if (resumeAt > 0) video.currentTime = resumeAt;
          }, { once: true });
        });
    } else {
      video.src = videoUrl;
      video.addEventListener('loadedmetadata', () => {
        if (resumeAt > 0) video.currentTime = resumeAt;
      }, { once: true });
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [videoUrl, resumeAt]);

  // 30s heartbeat
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enrollment) return;

    heartbeatRef.current = setInterval(() => {
      if (video.paused || video.ended) return;
      learningApi.videoHeartbeat(token, {
        lessonId: lesson.id,
        enrollmentId: enrollment.id,
        position: Math.floor(video.currentTime),
        duration: Math.floor(video.duration || 0),
      }).catch(() => {});
    }, HEARTBEAT_INTERVAL);

    return () => clearInterval(heartbeatRef.current);
  }, [token, lesson.id, enrollment]);

  // Auto-complete at 90%
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (completedRef.current || !video.duration) return;
      if (video.currentTime / video.duration >= AUTO_COMPLETE_THRESHOLD) {
        completedRef.current = true;
        onComplete();
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [onComplete]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          controlsList="nodownload"
        />
      </div>
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        {t(lesson.title, language)}
      </h2>
      {lesson.content?.description && (
        <p className="text-sm text-[var(--text-secondary)]">
          {t(lesson.content.description, language)}
        </p>
      )}
    </div>
  );
}

// ===========================================================================
// TEXT RENDERER — scroll progress tracking
// ===========================================================================

function TextRenderer({
  lesson,
  lang,
  progress,
  enrollment,
  token,
  onComplete,
}: {
  lesson: any;
  lang: string;
  progress: any;
  enrollment: any;
  token: string;
  onComplete: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);
  const t_lesson = useTranslations('lesson');

  const body = t(lesson.content?.body ?? lesson.content?.html ?? lesson.content, lang);

  // Scroll tracking — mark complete when scrolled to 90%
  useEffect(() => {
    const el = containerRef.current;
    if (!el || completedRef.current || progress?.is_completed) return;

    const handleScroll = () => {
      if (completedRef.current) return;
      const scrollPct = (el.scrollTop + el.clientHeight) / el.scrollHeight;
      if (scrollPct >= AUTO_COMPLETE_THRESHOLD) {
        completedRef.current = true;
        onComplete();
      }
    };

    el.addEventListener('scroll', handleScroll);
    // Also check if content fits without scrolling
    if (el.scrollHeight <= el.clientHeight) {
      completedRef.current = true;
      onComplete();
    }
    return () => el.removeEventListener('scroll', handleScroll);
  }, [onComplete, progress]);

  return (
    <div
      className={clsx(
        'rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)]',
        'p-6 lg:p-8 max-h-[calc(100vh-7rem)] overflow-y-auto',
      )}
      ref={containerRef}
    >
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
        {t(lesson.title, lang)}
      </h2>
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-primary)] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: body }}
      />
      {!progress?.is_completed && (
        <button
          onClick={onComplete}
          className="mt-6 px-6 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark"
        >
          {t_lesson('markAsRead')}
        </button>
      )}
    </div>
  );
}

// ===========================================================================
// QUIZ ENGINE — one question at a time, timer, immediate feedback, score
// ===========================================================================

function QuizEngine({
  lesson,
  lang,
  progress,
  enrollment,
  token,
  onComplete,
}: {
  lesson: any;
  lang: string;
  progress: any;
  enrollment: any;
  token: string;
  onComplete: () => void;
}) {
  const questions: QuizQuestion[] = lesson.content?.questions ?? [];
  const passingScore = lesson.content?.passingScore ?? 70;
  const totalTime = lesson.content?.totalTime ?? null; // seconds
  const t_quiz = useTranslations('quiz');

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(totalTime);

  const q = questions[current];

  // Global timer countdown
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || finished) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timer);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, finished]);

  // Submit answer for current question
  const handleAnswer = useCallback((optionId: string) => {
    if (showFeedback) return;
    setSelected(optionId);
    setShowFeedback(true);
    setAnswers((prev) => ({ ...prev, [q.id]: optionId }));
  }, [showFeedback, q]);

  // Next question
  const handleNext = useCallback(() => {
    setSelected(null);
    setShowFeedback(false);
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent((c) => c + 1);
    }
  }, [current, questions.length]);

  // Score calculation
  const score = useMemo(() => {
    if (!finished) return 0;
    let correct = 0;
    questions.forEach((q) => {
      const chosen = answers[q.id];
      const correctOption = q.options.find((o) => o.isCorrect);
      if (chosen && correctOption && chosen === correctOption.id) correct++;
    });
    return questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
  }, [finished, answers, questions]);

  const passed = score >= passingScore;

  // Mark complete when passed
  useEffect(() => {
    if (finished && passed && !progress?.is_completed) {
      onComplete();
      // Also persist score
      learningApi.updateProgress(token, {
        lessonId: lesson.id,
        enrollmentId: enrollment?.id,
        isCompleted: true,
        score,
      }).catch(() => {});
    }
  }, [finished, passed, progress, onComplete, token, lesson.id, enrollment, score]);

  // ---- No questions ----
  if (questions.length === 0) {
    return (
      <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-6 text-center">
        <HelpCircle className="w-10 h-10 mx-auto text-[var(--text-secondary)] opacity-30 mb-3" />
        <p className="text-[var(--text-secondary)]">{t_quiz('noQuestions')}</p>
      </div>
    );
  }

  // ---- Finished / Score screen ----
  if (finished) {
    return (
      <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-6 text-center space-y-4">
        <div
          className={clsx(
            'w-20 h-20 rounded-full mx-auto flex items-center justify-center text-2xl font-bold',
            passed
              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
          )}
        >
          {score}%
        </div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)]">
          {passed ? t_quiz('congratulations') : t_quiz('tryAgain')}
        </h2>
        <p className="text-sm text-[var(--text-secondary)]">
          {passed
            ? t_quiz('passedMessage', { score, passingScore })
            : t_quiz('failedMessage', { score, passingScore })}
        </p>
        {!passed && (
          <button
            onClick={() => {
              setCurrent(0);
              setAnswers({});
              setSelected(null);
              setShowFeedback(false);
              setFinished(false);
              setTimeLeft(totalTime);
            }}
            className="px-6 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark"
          >
            {t_quiz('restart')}
          </button>
        )}
      </div>
    );
  }

  // ---- Question display ----
  const correctOption = q.options.find((o) => o.isCorrect);

  return (
    <div className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] overflow-hidden">
      {/* Progress + Timer bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] bg-gray-50/50 dark:bg-gray-800/30">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {t_quiz('questionProgress', { current: current + 1, total: questions.length })}
        </span>
        <div className="flex items-center gap-3">
          {/* Progress dots */}
          <div className="flex gap-1">
            {questions.map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'w-1.5 h-1.5 rounded-full',
                  i < current ? 'bg-brand-navy dark:bg-brand-gold' :
                  i === current ? 'bg-brand-navy dark:bg-brand-gold scale-125' :
                  'bg-gray-200 dark:bg-gray-700',
                )}
              />
            ))}
          </div>
          {/* Timer */}
          {timeLeft !== null && (
            <span className={clsx(
              'flex items-center gap-1 text-xs font-mono font-medium',
              timeLeft < 30 ? 'text-red-500' : 'text-[var(--text-secondary)]',
            )}>
              <Clock className="w-3 h-3" />
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      {/* Question */}
      <div className="p-5 lg:p-6 space-y-4">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          {t(q.text, lang)}
        </h3>

        {/* Options */}
        <div className="space-y-2">
          {q.options.map((opt) => {
            const isChosen = selected === opt.id;
            const isCorrectOpt = opt.isCorrect;
            const showCorrect = showFeedback && isCorrectOpt;
            const showWrong = showFeedback && isChosen && !isCorrectOpt;

            return (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                disabled={showFeedback}
                className={clsx(
                  'w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                  !showFeedback && 'hover:border-brand-navy/30 dark:hover:border-brand-gold/30 hover:bg-brand-navy/5 dark:hover:bg-brand-gold/5',
                  showCorrect && 'border-green-400 bg-green-50 text-green-700 dark:border-green-500/50 dark:bg-green-900/20 dark:text-green-400',
                  showWrong && 'border-red-400 bg-red-50 text-red-700 dark:border-red-500/50 dark:bg-red-900/20 dark:text-red-400',
                  !showFeedback && isChosen && 'border-brand-navy dark:border-brand-gold',
                  !showCorrect && !showWrong && 'border-[var(--border)] text-[var(--text-primary)]',
                  showFeedback && !showCorrect && !showWrong && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
                    showCorrect ? 'border-green-500 bg-green-500' :
                    showWrong ? 'border-red-500 bg-red-500' :
                    isChosen ? 'border-brand-navy dark:border-brand-gold' :
                    'border-gray-300 dark:border-gray-600',
                  )}>
                    {(showCorrect || showWrong) && (
                      <span className="text-white text-[10px] font-bold">
                        {showCorrect ? '✓' : '✗'}
                      </span>
                    )}
                  </div>
                  {t(opt.text, lang)}
                </div>
              </button>
            );
          })}
        </div>

        {/* Explanation after feedback */}
        {showFeedback && q.explanation && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 text-sm text-blue-700 dark:text-blue-300"
          >
            {t(q.explanation, lang)}
          </motion.div>
        )}

        {/* Next button */}
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-end"
          >
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900 dark:hover:bg-brand-gold-dark transition-colors"
            >
              {current + 1 >= questions.length ? t_quiz('seeResult') : t_quiz('next')}
              <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
