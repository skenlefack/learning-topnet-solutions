'use client';
// ============================================================================
// Topnet Solutions Academy — Path Composite Exam
// Questions pulled from all courses in the learning path
// ============================================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle, XCircle, Clock,
  Award, Loader2, AlertTriangle, Trophy, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/store';
import { pathExamApi } from '@/lib/api';

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

type Phase = 'loading' | 'intro' | 'exam' | 'submitting' | 'results';

export default function PathExamPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const language = useAuthStore((s) => s.language);
  const pathId = params.id as string;

  const [phase, setPhase] = useState<Phase>('loading');
  const [examData, setExamData] = useState<any>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Start exam
  const startExam = useCallback(async () => {
    if (!token) return;
    setPhase('loading');
    try {
      const res: any = await pathExamApi.start(token, pathId);
      setExamData(res.data);
      setTimeLeft(res.data.timeLimit * 60);
      setPhase('intro');
    } catch (err: any) {
      setError(err.message || 'Impossible de démarrer l\'examen');
      setPhase('results');
    }
  }, [token, pathId]);

  useEffect(() => { startExam(); }, [startExam]);

  // Timer
  useEffect(() => {
    if (phase !== 'exam') return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const handleAnswer = (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = useCallback(async () => {
    if (!token || !examData) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('submitting');
    try {
      const res: any = await pathExamApi.submit(token, examData.attemptId, answers);
      setResults(res.data);
      setPhase('results');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la soumission');
      setPhase('exam');
    }
  }, [token, examData, answers]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const questions = examData?.questions || [];
  const currentQuestion = questions[currentQ];
  const progress = questions.length > 0 ? Math.round(((currentQ + 1) / questions.length) * 100) : 0;

  // ── Loading ──
  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-navy" />
      </div>
    );
  }

  // ── Error ──
  if (error && phase === 'results' && !results) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Examen non disponible</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">{error}</p>
        <Link href="/" className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-navy text-white">
          Retour au dashboard
        </Link>
      </div>
    );
  }

  // ── Intro ──
  if (phase === 'intro') {
    return (
      <div className="max-w-lg mx-auto py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-8 text-center">
          <Award className="w-14 h-14 text-brand-gold mx-auto mb-4" />
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-2">
            Examen de parcours
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-1">
            {getLocalText(examData.pathTitle, language)}
          </p>
          <div className="flex items-center justify-center gap-4 text-xs text-[var(--text-secondary)] my-4">
            <span>{examData.totalQuestions} questions</span>
            <span>|</span>
            <span>Score requis : {examData.passingScore}%</span>
            <span>|</span>
            <span>{examData.timeLimit} min</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-6">
            Cet examen regroupe des questions de tous les cours du parcours. Répondez à chaque question et soumettez avant la fin du temps imparti.
          </p>
          <button
            onClick={() => setPhase('exam')}
            className="px-8 py-3 rounded-xl text-sm font-semibold bg-brand-navy text-white hover:bg-brand-navy-deep transition-colors"
          >
            Commencer l'examen
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Submitting ──
  if (phase === 'submitting') {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-navy mx-auto" />
          <p className="text-sm text-[var(--text-secondary)]">Correction en cours...</p>
        </div>
      </div>
    );
  }

  // ── Results ──
  if (phase === 'results' && results) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-8 text-center">
          {results.passed ? (
            <>
              <Trophy className="w-16 h-16 text-brand-gold mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-emerald-600 mb-2">Félicitations !</h1>
              <p className="text-sm text-[var(--text-secondary)]">Vous avez réussi l'examen du parcours</p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-red-500 mb-2">Examen non réussi</h1>
              <p className="text-sm text-[var(--text-secondary)]">Vous n'avez pas atteint le score requis</p>
            </>
          )}

          <div className="my-6 grid grid-cols-3 gap-4">
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30">
              <div className={clsx('text-2xl font-bold', results.passed ? 'text-emerald-600' : 'text-red-500')}>{results.score}%</div>
              <div className="text-[10px] text-[var(--text-secondary)]">Score</div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{results.correctAnswers}/{results.totalQuestions}</div>
              <div className="text-[10px] text-[var(--text-secondary)]">Bonnes réponses</div>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/30">
              <div className="text-2xl font-bold text-[var(--text-primary)]">{results.passingScore}%</div>
              <div className="text-[10px] text-[var(--text-secondary)]">Score requis</div>
            </div>
          </div>

          {results.certification && (
            <div className="p-4 rounded-xl bg-brand-gold/10 border border-brand-gold/30 mb-4">
              <Award className="w-8 h-8 text-brand-gold mx-auto mb-2" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Certificat délivré</p>
              <p className="text-xs text-[var(--text-secondary)] font-mono mt-1">{results.certification.certificate_number}</p>
            </div>
          )}

          <div className="flex gap-3 justify-center mt-4">
            <Link href="/" className="px-5 py-2 rounded-lg text-sm font-medium border border-[var(--border)] hover:bg-gray-50">
              Dashboard
            </Link>
            {!results.passed && (
              <button onClick={startExam} className="px-5 py-2 rounded-lg text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy-deep flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Réessayer
              </button>
            )}
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Exam ──
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          Question {currentQ + 1} / {questions.length}
        </span>
        <div className={clsx('flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold', timeLeft < 60 ? 'bg-red-100 text-red-600' : 'bg-gray-100 dark:bg-gray-800 text-[var(--text-primary)]')}>
          <Clock className="w-3.5 h-3.5" /> {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
        <div className="h-full rounded-full bg-brand-navy dark:bg-brand-gold transition-all" style={{ width: `${progress}%` }} />
      </div>

      {/* Question */}
      {currentQuestion && (
        <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="rounded-xl bg-white dark:bg-surface-dark-card border border-[var(--border)] p-6">
          <p className="text-sm font-semibold text-[var(--text-primary)] mb-4 leading-relaxed">
            {getLocalText(currentQuestion.questionText, language)}
          </p>

          {/* Options */}
          <div className="space-y-2">
            {(currentQuestion.options || []).map((opt: any, i: number) => {
              const isSelected = answers[currentQuestion.id] === opt.id;
              return (
                <button
                  key={opt.id || i}
                  onClick={() => handleAnswer(currentQuestion.id, opt.id)}
                  className={clsx(
                    'w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-all border',
                    isSelected
                      ? 'border-brand-navy bg-brand-navy/5 dark:border-brand-gold dark:bg-brand-gold/10 text-[var(--text-primary)]'
                      : 'border-[var(--border)] hover:border-gray-300 dark:hover:border-gray-600 text-[var(--text-secondary)]',
                  )}
                >
                  <span className={clsx(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 text-xs font-bold',
                    isSelected ? 'border-brand-navy bg-brand-navy text-white dark:border-brand-gold dark:bg-brand-gold dark:text-gray-900' : 'border-gray-300',
                  )}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{getLocalText(opt.text, language)}</span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
          disabled={currentQ === 0}
          className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:bg-gray-100 disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" /> Précédent
        </button>

        {currentQ < questions.length - 1 ? (
          <button
            onClick={() => setCurrentQ(q => q + 1)}
            className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-brand-navy text-white hover:bg-brand-navy-deep"
          >
            Suivant <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length === 0}
            className="flex items-center gap-1 px-6 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
          >
            <CheckCircle className="w-4 h-4" /> Soumettre
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex justify-center gap-1 flex-wrap">
        {questions.map((_: any, i: number) => (
          <button
            key={i}
            onClick={() => setCurrentQ(i)}
            className={clsx(
              'w-3 h-3 rounded-full transition-all',
              i === currentQ ? 'bg-brand-navy dark:bg-brand-gold scale-125' :
              answers[questions[i]?.id] ? 'bg-emerald-400' : 'bg-gray-300 dark:bg-gray-600',
            )}
          />
        ))}
      </div>
    </div>
  );
}
