'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { skillsApi } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { Clock, ChevronLeft, ChevronRight, Flag, Send, AlertTriangle, Eye } from 'lucide-react';

interface TestData {
  attemptId: string;
  token: string;
  durationSec: number;
  questions: Array<{
    id: string;
    questionText: Record<string, string>;
    options: Array<{ text: Record<string, string> }>;
    points: number;
    difficulty: number;
  }>;
  trackName: Record<string, string>;
  format: string;
  via: string;
}

export default function SkillTestPage() {
  const { track: trackCode } = useParams<{ track: string }>();
  const router = useRouter();
  const { token: authToken } = useAuthStore();

  const [testData, setTestData] = useState<TestData | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Load test data from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem('skill-test');
    if (!raw) { router.push(`/skills/${trackCode}`); return; }
    const data = JSON.parse(raw) as TestData;
    setTestData(data);
    setTimeLeft(data.durationSec);
  }, [trackCode, router]);

  // Timer countdown
  useEffect(() => {
    if (!testData || timeLeft <= 0 || submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — auto-submit
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [testData, submitted]);

  // Tab-switch detection
  useEffect(() => {
    const handler = () => {
      if (document.hidden && testData && !submitted) {
        setTabSwitches(prev => prev + 1);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [testData, submitted]);

  // Prevent accidental navigation
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (testData && !submitted) { e.preventDefault(); }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [testData, submitted]);

  const handleAnswer = (questionId: string, optionIdx: number) => {
    setAnswers(prev => ({ ...prev, [questionId]: optionIdx }));
  };

  const markDontKnow = (questionId: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: -1 }));
  };

  const handleSubmit = useCallback(async (timeUp = false) => {
    if (!testData || !authToken || submitting || submitted) return;
    setSubmitting(true);
    try {
      const res = await skillsApi.submit(authToken, {
        attemptId: testData.attemptId,
        token: testData.token,
        answers,
        tabSwitches,
        timeUp,
      });
      if (res.success) {
        setSubmitted(true);
        sessionStorage.removeItem('skill-test');
        sessionStorage.setItem('skill-result', JSON.stringify(res.data));
        router.push(`/skills/results/${testData.attemptId}`);
      }
    } catch (err: any) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  }, [testData, authToken, answers, tabSwitches, submitting, submitted, router]);

  if (!testData) return null;

  const questions = testData.questions;
  const current = questions[currentIdx];
  const totalQ = questions.length;
  const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined).length;

  // Format timer
  const hours = Math.floor(timeLeft / 3600);
  const mins = Math.floor((timeLeft % 3600) / 60);
  const secs = timeLeft % 60;
  const timerColor = timeLeft < 300 ? 'text-red-500' : timeLeft < 600 ? 'text-yellow-500' : 'text-gray-700 dark:text-gray-300';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top bar */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-sm text-gray-900 dark:text-white">
              {testData.trackName?.fr || trackCode}
            </h1>
            <p className="text-xs text-gray-500">
              Question {currentIdx + 1}/{totalQ} — {answeredCount} repondue(s)
            </p>
          </div>

          <div className="flex items-center gap-4">
            {/* Tab switches indicator */}
            {tabSwitches > 0 && (
              <span className="flex items-center gap-1 text-xs text-orange-500">
                <Eye className="w-3.5 h-3.5" /> {tabSwitches}
              </span>
            )}

            {/* Timer */}
            <div className={`flex items-center gap-1.5 font-mono font-bold text-lg ${timerColor}`}>
              <Clock className="w-4 h-4" />
              {hours > 0 && `${hours}:`}{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </div>

            {/* Submit */}
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Envoi...' : 'Terminer'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="max-w-5xl mx-auto mt-2">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${(answeredCount / totalQ) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        {current && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
            {/* Difficulty badge */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-400">
                Question {currentIdx + 1} sur {totalQ}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                current.difficulty <= 2 ? 'bg-green-100 text-green-700' :
                current.difficulty <= 3 ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                {current.difficulty <= 2 ? 'Facile' : current.difficulty <= 3 ? 'Moyen' : 'Difficile'}
              </span>
            </div>

            {/* Question text */}
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-6 leading-relaxed">
              {current.questionText?.fr || current.questionText?.en || ''}
            </h2>

            {/* Options */}
            <div className="space-y-3 mb-6">
              {current.options.map((opt, idx) => {
                const isSelected = answers[current.id] === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => handleAnswer(current.id, idx)}
                    className={`w-full p-4 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 ring-2 ring-blue-500'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="text-sm text-gray-800 dark:text-gray-200 pt-0.5">
                        {opt.text?.fr || opt.text?.en || ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* "I don't know" button */}
            <button
              onClick={() => markDontKnow(current.id)}
              className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                answers[current.id] === -1
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Flag className="w-3.5 h-3.5 inline mr-1" />
              Je ne sais pas
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" /> Precedente
          </button>
          <button
            onClick={() => setCurrentIdx(Math.min(totalQ - 1, currentIdx + 1))}
            disabled={currentIdx === totalQ - 1}
            className="flex items-center gap-1 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 disabled:opacity-30"
          >
            Suivante <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Question palette */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 mb-3">Navigation rapide</p>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((q, idx) => {
              const isAnswered = answers[q.id] !== undefined;
              const isDontKnow = answers[q.id] === -1;
              const isCurrent = idx === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(idx)}
                  className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                    isCurrent ? 'ring-2 ring-blue-500 bg-blue-100 text-blue-700' :
                    isDontKnow ? 'bg-gray-200 dark:bg-gray-600 text-gray-500' :
                    isAnswered ? 'bg-green-100 dark:bg-green-900/30 text-green-700' :
                    'bg-gray-50 dark:bg-gray-700 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 inline-block" /> Repondu</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Je ne sais pas</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border inline-block" /> Non repondu</span>
          </div>
        </div>
      </div>
    </div>
  );
}
