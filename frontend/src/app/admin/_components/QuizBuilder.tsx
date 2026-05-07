'use client';
// ============================================================================
// AU-IBAR Learning — Quiz Builder (Admin)
// Create and manage assessments with multiple question types
// ============================================================================
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit3, Trash2, X, Loader2, CheckCircle, Circle,
  ChevronDown, ChevronUp, Copy, FileDown, FileUp, Search,
  ListChecks, ToggleLeft, Type, AlignLeft, ArrowUpDown, PenTool,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { questionApi, courseApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const QUESTION_TYPES = [
  { value: 'single_choice', label: 'Choix unique (QCM)', icon: Circle },
  { value: 'multiple_choice', label: 'Choix multiples', icon: ListChecks },
  { value: 'true_false', label: 'Vrai / Faux', icon: ToggleLeft },
  { value: 'short_answer', label: 'Réponse courte', icon: Type },
  { value: 'essay', label: 'Rédaction', icon: AlignLeft },
  { value: 'ordering', label: 'Mise en ordre', icon: ArrowUpDown },
  { value: 'fill_blank', label: 'Texte à trous', icon: PenTool },
] as const;

interface Choice {
  id: string;
  text: { fr: string; en?: string };
  isCorrect: boolean;
}

function getLocalText(t: any, lang = 'fr') {
  if (!t) return '';
  if (typeof t === 'string') return t;
  return t[lang] || t.fr || t.en || '';
}

function generateId() { return Math.random().toString(36).substring(2, 8); }

// ---------------------------------------------------------------------------
// Assessment Selector
// ---------------------------------------------------------------------------

function AssessmentSelector({ token, assessmentId, onSelect }: {
  token: string; assessmentId: string | null; onSelect: (id: string, title: string) => void;
}) {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const coursesRes: any = await courseApi.list(token, { limit: 100 });
        setCourses(coursesRes.data || []);
        // Flatten assessments from all courses
        const allAssessments: any[] = [];
        for (const c of (coursesRes.data || []).slice(0, 20)) {
          try {
            const res = await fetch(`/api/assessment/course/${c.id}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            if (data.data) {
              data.data.forEach((a: any) => allAssessments.push({ ...a, courseTitle: getLocalText(c.title) }));
            }
          } catch {}
        }
        setAssessments(allAssessments);
      } catch {}
      finally { setLoading(false); }
    })();
  }, [token]);

  if (loading) return <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]"><Loader2 className="w-4 h-4 animate-spin" /> Chargement...</div>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--text-secondary)]">Sélectionnez une évaluation :</p>
      <div className="max-h-48 overflow-y-auto space-y-1">
        {assessments.map(a => (
          <button
            key={a.id}
            onClick={() => onSelect(a.id, `${a.courseTitle} — ${getLocalText(a.title)}`)}
            className={clsx(
              'w-full flex items-center gap-2 p-2.5 rounded-lg text-left text-sm transition-colors',
              assessmentId === a.id ? 'bg-brand-navy/10 dark:bg-brand-gold/20 text-brand-navy dark:text-brand-gold' : 'hover:bg-gray-50 dark:hover:bg-gray-800/30',
            )}
          >
            <ListChecks className="w-4 h-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{getLocalText(a.title)}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">{a.courseTitle} &bull; {a.type} &bull; {a.passing_score}%</p>
            </div>
          </button>
        ))}
        {assessments.length === 0 && <p className="text-xs text-[var(--text-secondary)] p-2">Aucune évaluation. Créez d'abord un cours avec une évaluation.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Question Editor
// ---------------------------------------------------------------------------

function QuestionEditor({ question, onChange, onDelete }: {
  question: any; onChange: (q: any) => void; onDelete: () => void;
}) {
  const qType = question.questionType || 'single_choice';
  const choices: Choice[] = question.options || [];

  const updateChoice = (idx: number, field: string, value: any) => {
    const newChoices = [...choices];
    if (field === 'text') newChoices[idx] = { ...newChoices[idx], text: { ...newChoices[idx].text, fr: value } };
    else if (field === 'isCorrect') {
      if (qType === 'single_choice') newChoices.forEach((c, i) => c.isCorrect = i === idx);
      else newChoices[idx] = { ...newChoices[idx], isCorrect: value };
    }
    onChange({ ...question, options: newChoices });
  };

  const addChoice = () => {
    onChange({ ...question, options: [...choices, { id: generateId(), text: { fr: '' }, isCorrect: false }] });
  };

  const removeChoice = (idx: number) => {
    onChange({ ...question, options: choices.filter((_, i) => i !== idx) });
  };

  const inputClass = 'w-full px-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white dark:bg-surface-dark-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <select
          value={qType}
          onChange={e => onChange({ ...question, questionType: e.target.value })}
          className="px-2 py-1 rounded-lg text-xs bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]"
        >
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <select
            value={question.difficulty || 1}
            onChange={e => onChange({ ...question, difficulty: parseInt(e.target.value) })}
            className="px-2 py-1 rounded-lg text-xs bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)]"
          >
            {[1,2,3,4,5].map(d => <option key={d} value={d}>Diff. {d}</option>)}
          </select>
          <input
            type="number" min={1} max={100}
            value={question.points || 1}
            onChange={e => onChange({ ...question, points: parseInt(e.target.value) || 1 })}
            className="w-16 px-2 py-1 rounded-lg text-xs bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] text-center"
            title="Points"
          />
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
        </div>
      </div>

      {/* Question text */}
      <textarea
        value={getLocalText(question.questionText, 'fr')}
        onChange={e => onChange({ ...question, questionText: { ...question.questionText, fr: e.target.value } })}
        placeholder="Texte de la question (FR)"
        rows={2}
        className={clsx(inputClass, 'resize-none')}
      />

      {/* Choices (for choice-based questions) */}
      {['single_choice', 'multiple_choice', 'true_false'].includes(qType) && (
        <div className="space-y-2">
          {qType === 'true_false' && choices.length === 0 && (() => {
            onChange({ ...question, options: [
              { id: 'true', text: { fr: 'Vrai' }, isCorrect: true },
              { id: 'false', text: { fr: 'Faux' }, isCorrect: false },
            ] });
            return null;
          })()}
          {choices.map((c, i) => (
            <div key={c.id || i} className="flex items-center gap-2">
              <button
                onClick={() => updateChoice(i, 'isCorrect', !c.isCorrect)}
                className={clsx('shrink-0', c.isCorrect ? 'text-emerald-500' : 'text-gray-300')}
              >
                {c.isCorrect ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
              </button>
              <input
                value={c.text?.fr || ''}
                onChange={e => updateChoice(i, 'text', e.target.value)}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                className={clsx(inputClass, 'flex-1')}
                disabled={qType === 'true_false'}
              />
              {qType !== 'true_false' && (
                <button onClick={() => removeChoice(i)} className="p-1 rounded hover:bg-red-50"><X className="w-3.5 h-3.5 text-red-400" /></button>
              )}
            </div>
          ))}
          {qType !== 'true_false' && (
            <button onClick={addChoice} className="flex items-center gap-1 text-xs text-brand-navy dark:text-brand-gold hover:underline">
              <Plus className="w-3 h-3" /> Ajouter une option
            </button>
          )}
        </div>
      )}

      {/* Short answer */}
      {qType === 'short_answer' && (
        <input
          value={typeof question.correctAnswer === 'object' ? question.correctAnswer?.fr || '' : question.correctAnswer || ''}
          onChange={e => onChange({ ...question, correctAnswer: { fr: e.target.value } })}
          placeholder="Réponse attendue"
          className={inputClass}
        />
      )}

      {/* Essay */}
      {qType === 'essay' && (
        <p className="text-xs text-[var(--text-secondary)] italic">Réponse libre — notation manuelle par le formateur.</p>
      )}

      {/* Explanation */}
      <input
        value={getLocalText(question.explanation, 'fr')}
        onChange={e => onChange({ ...question, explanation: { ...question.explanation, fr: e.target.value } })}
        placeholder="Explication (optionnel)"
        className={clsx(inputClass, 'text-xs')}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main QuizBuilder
// ---------------------------------------------------------------------------

export default function QuizBuilder() {
  const { token } = useAuth();
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');

  const fetchQuestions = useCallback(async (aId: string) => {
    if (!token) return;
    setLoading(true);
    try {
      const res: any = await questionApi.list(token, aId);
      setQuestions((res.data || []).map((q: any) => ({ ...q, _saved: true })));
    } catch { setQuestions([]); }
    finally { setLoading(false); }
  }, [token]);

  const selectAssessment = (id: string, title: string) => {
    setAssessmentId(id);
    setAssessmentTitle(title);
    fetchQuestions(id);
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      _id: generateId(),
      _saved: false,
      questionText: { fr: '' },
      questionType: 'single_choice',
      options: [
        { id: generateId(), text: { fr: '' }, isCorrect: true },
        { id: generateId(), text: { fr: '' }, isCorrect: false },
      ],
      correctAnswer: null,
      difficulty: 1,
      points: 1,
      tags: [],
      explanation: { fr: '' },
    }]);
  };

  const updateQuestion = (idx: number, q: any) => {
    setQuestions(prev => prev.map((p, i) => i === idx ? { ...q, _saved: false } : p));
  };

  const deleteQuestion = async (idx: number) => {
    const q = questions[idx];
    if (q.id && token) {
      try {
        await questionApi.delete(token, q.id);
        toast.success('Question supprimée');
      } catch (err: any) { toast.error(err.message); return; }
    }
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    if (!token || !assessmentId) return;
    setSaving(true);
    let saved = 0;
    try {
      for (const q of questions) {
        if (q._saved) continue;
        const payload = {
          assessmentId,
          questionText: q.questionText,
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer || (q.options ? q.options.filter((o: any) => o.isCorrect).map((o: any) => o.id) : null),
          difficulty: q.difficulty,
          points: q.points,
          tags: q.tags || [],
          explanation: q.explanation,
        };
        if (q.id) {
          await questionApi.update(token, q.id, payload);
        } else {
          await questionApi.create(token, payload);
        }
        saved++;
      }
      toast.success(`${saved} question(s) enregistrée(s)`);
      fetchQuestions(assessmentId);
    } catch (err: any) { toast.error(err.message || 'Erreur'); }
    finally { setSaving(false); }
  };

  const exportJSON = () => {
    const data = questions.map(q => ({
      questionText: q.questionText, questionType: q.questionType,
      options: q.options, correctAnswer: q.correctAnswer,
      difficulty: q.difficulty, points: q.points, tags: q.tags, explanation: q.explanation,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'questions-export.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const imported = JSON.parse(text);
        if (Array.isArray(imported)) {
          setQuestions(prev => [...prev, ...imported.map((q: any) => ({ ...q, _id: generateId(), _saved: false }))]);
          toast.success(`${imported.length} questions importées`);
        }
      } catch { toast.error('Format JSON invalide'); }
    };
    input.click();
  };

  const filtered = searchFilter
    ? questions.filter(q => getLocalText(q.questionText, 'fr').toLowerCase().includes(searchFilter.toLowerCase()))
    : questions;

  const hasUnsaved = questions.some(q => !q._saved);

  if (!assessmentId && token) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Gestionnaire de Quiz</h3>
        <AssessmentSelector token={token} assessmentId={assessmentId} onSelect={selectAssessment} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button onClick={() => { setAssessmentId(null); setQuestions([]); }} className="text-xs text-brand-navy dark:text-brand-gold hover:underline mb-1">&larr; Changer d'évaluation</button>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{assessmentTitle}</h3>
          <p className="text-[10px] text-[var(--text-secondary)]">{questions.length} questions {hasUnsaved && '(modifications non enregistrées)'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={importJSON} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-gray-800/30">
            <FileUp className="w-3.5 h-3.5" /> Importer
          </button>
          <button onClick={exportJSON} disabled={questions.length === 0} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[var(--border)] hover:bg-gray-50 dark:hover:bg-gray-800/30 disabled:opacity-40">
            <FileDown className="w-3.5 h-3.5" /> Exporter
          </button>
          <button onClick={addQuestion} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-navy text-white hover:bg-brand-navy-deep dark:bg-brand-gold dark:text-gray-900">
            <Plus className="w-3.5 h-3.5" /> Question
          </button>
          {hasUnsaved && (
            <button onClick={saveAll} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Enregistrer tout
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      {questions.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Filtrer les questions..."
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-gray-50 dark:bg-gray-800/50 border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          />
        </div>
      )}

      {/* Questions */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-navy" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((q, i) => (
            <div key={q.id || q._id} className="relative">
              <span className="absolute -left-6 top-4 text-[10px] font-bold text-[var(--text-secondary)]">Q{i + 1}</span>
              <QuestionEditor
                question={q}
                onChange={updated => updateQuestion(questions.indexOf(q), updated)}
                onDelete={() => deleteQuestion(questions.indexOf(q))}
              />
            </div>
          ))}
          {questions.length === 0 && (
            <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
              Aucune question. Cliquez sur "+ Question" pour commencer.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
