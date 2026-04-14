// ============================================================================
// ARIS Academy — Adaptive Scoring Engine
// Selects questions based on learner history + scores with time bonus
// ============================================================================
import { query, queryOne } from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestionRow {
  id: string;
  question_text: any;
  question_type: string;
  options: any[];
  correct_answer: any;
  difficulty: number;
  points: number;
  tags: string[];
  explanation: any;
}

interface SanitizedQuestion {
  id: string;
  questionText: any;
  questionType: string;
  options: Array<{ text: any }>;
  points: number;
  difficulty: number;
}

export interface ScoreBreakdown {
  questionId: string;
  correct: boolean;
  pointsEarned: number;
  pointsAvailable: number;
  explanation: any;
}

export interface ScoreResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  breakdown: ScoreBreakdown[];
  passed: boolean;
  timeBonus: number;
  timeTakenSeconds: number;
}

// ---------------------------------------------------------------------------
// Difficulty buckets
// ---------------------------------------------------------------------------

const DIFFICULTY_EASY = [1, 2];
const DIFFICULTY_MEDIUM = [3];
const DIFFICULTY_HARD = [4, 5];

interface DifficultyDistribution {
  easy: number;   // fraction
  medium: number;
  hard: number;
}

const FIRST_ATTEMPT_DIST: DifficultyDistribution = {
  easy: 0.4,
  medium: 0.4,
  hard: 0.2,
};

// ---------------------------------------------------------------------------
// selectQuestions — adaptive question selection
// ---------------------------------------------------------------------------

export async function selectQuestions(
  assessmentId: string,
  userId: string,
): Promise<{ questions: SanitizedQuestion[]; questionIds: string[] }> {
  const assessment = await queryOne(
    'SELECT * FROM academy_core.assessments WHERE id = $1',
    [assessmentId],
  );
  if (!assessment) throw new Error(`Assessment ${assessmentId} not found`);

  // Load all available questions for this assessment
  const allQuestions = await query<QuestionRow>(
    'SELECT * FROM academy_core.questions WHERE assessment_id = $1',
    [assessmentId],
  );

  if (allQuestions.length === 0) {
    return { questions: [], questionIds: [] };
  }

  const targetCount = assessment.question_count || allQuestions.length;

  // Load previous attempts to determine adaptive distribution
  const prevAttempts = await query(
    `SELECT id, answers, score, passed
     FROM academy_core.assessment_attempts
     WHERE user_id = $1 AND assessment_id = $2 AND submitted_at IS NOT NULL
     ORDER BY started_at DESC`,
    [userId, assessmentId],
  );

  // Collect question IDs used in the most recent failed attempt (to avoid reuse)
  const recentFailedQuestionIds = new Set<string>();
  if (prevAttempts.length > 0 && !prevAttempts[0].passed && prevAttempts[0].answers) {
    const answers =
      typeof prevAttempts[0].answers === 'string'
        ? JSON.parse(prevAttempts[0].answers)
        : prevAttempts[0].answers;
    for (const qId of Object.keys(answers)) {
      recentFailedQuestionIds.add(qId);
    }
  }

  // Determine difficulty distribution
  const dist = computeDistribution(prevAttempts, allQuestions);

  // Bucket questions by difficulty
  const easyPool = allQuestions.filter((q) => DIFFICULTY_EASY.includes(q.difficulty));
  const mediumPool = allQuestions.filter((q) => DIFFICULTY_MEDIUM.includes(q.difficulty));
  const hardPool = allQuestions.filter((q) => DIFFICULTY_HARD.includes(q.difficulty));

  // Calculate how many from each bucket
  const easyCount = Math.round(targetCount * dist.easy);
  const hardCount = Math.round(targetCount * dist.hard);
  const mediumCount = targetCount - easyCount - hardCount;

  // Prefer questions NOT in the most recent failed attempt
  const preferFresh = (pool: QuestionRow[]) => {
    const fresh = pool.filter((q) => !recentFailedQuestionIds.has(q.id));
    const stale = pool.filter((q) => recentFailedQuestionIds.has(q.id));
    return [...shuffle(fresh), ...shuffle(stale)];
  };

  const selected: QuestionRow[] = [
    ...preferFresh(easyPool).slice(0, easyCount),
    ...preferFresh(mediumPool).slice(0, mediumCount),
    ...preferFresh(hardPool).slice(0, hardCount),
  ];

  // If we got fewer than targetCount (sparse buckets), fill from all remaining
  if (selected.length < targetCount) {
    const selectedIds = new Set(selected.map((q) => q.id));
    const remaining = preferFresh(allQuestions).filter((q) => !selectedIds.has(q.id));
    selected.push(...remaining.slice(0, targetCount - selected.length));
  }

  // Final shuffle
  const finalQuestions = shuffle(selected).slice(0, targetCount);

  // Sanitize — strip correct_answer and is_correct from options
  const sanitized: SanitizedQuestion[] = finalQuestions.map((q) => ({
    id: q.id,
    questionText: q.question_text,
    questionType: q.question_type,
    options: q.options?.map((o: any) => ({ text: o.text })) ?? [],
    points: q.points,
    difficulty: q.difficulty,
  }));

  return {
    questions: sanitized,
    questionIds: finalQuestions.map((q) => q.id),
  };
}

// ---------------------------------------------------------------------------
// computeDistribution — adapt difficulty mix based on past performance
// ---------------------------------------------------------------------------

function computeDistribution(
  prevAttempts: any[],
  allQuestions: QuestionRow[],
): DifficultyDistribution {
  if (prevAttempts.length === 0) {
    return FIRST_ATTEMPT_DIST;
  }

  // Analyse the most recent attempt to find weak spots
  const lastAttempt = prevAttempts[0];
  const answers =
    typeof lastAttempt.answers === 'string'
      ? JSON.parse(lastAttempt.answers)
      : lastAttempt.answers;

  if (!answers || Object.keys(answers).length === 0) {
    return FIRST_ATTEMPT_DIST;
  }

  // Build a question lookup
  const qMap = new Map(allQuestions.map((q) => [q.id, q]));

  let easyTotal = 0, easyCorrect = 0;
  let mediumTotal = 0, mediumCorrect = 0;
  let hardTotal = 0, hardCorrect = 0;

  for (const [qId, selectedIdx] of Object.entries(answers)) {
    const q = qMap.get(qId);
    if (!q) continue;
    const correct = q.options?.[selectedIdx as any]?.is_correct === true;

    if (DIFFICULTY_EASY.includes(q.difficulty)) {
      easyTotal++;
      if (correct) easyCorrect++;
    } else if (DIFFICULTY_MEDIUM.includes(q.difficulty)) {
      mediumTotal++;
      if (correct) mediumCorrect++;
    } else {
      hardTotal++;
      if (correct) hardCorrect++;
    }
  }

  const easyRate = easyTotal > 0 ? easyCorrect / easyTotal : 1;
  const mediumRate = mediumTotal > 0 ? mediumCorrect / mediumTotal : 0.5;
  const hardRate = hardTotal > 0 ? hardCorrect / hardTotal : 0;

  // Shift difficulty toward weaker areas:
  // High easy rate → fewer easy, more medium/hard
  // Low easy rate → more easy to reinforce fundamentals
  if (easyRate >= 0.8 && mediumRate >= 0.6) {
    // Learner is strong — push harder
    return { easy: 0.2, medium: 0.4, hard: 0.4 };
  }
  if (easyRate >= 0.8 && mediumRate < 0.6) {
    // Solid on basics, needs medium practice
    return { easy: 0.2, medium: 0.5, hard: 0.3 };
  }
  if (easyRate < 0.5) {
    // Struggling with basics — reinforce
    return { easy: 0.5, medium: 0.35, hard: 0.15 };
  }

  // Default balanced retry
  return { easy: 0.3, medium: 0.4, hard: 0.3 };
}

// ---------------------------------------------------------------------------
// scoreAttempt — detailed scoring with time bonus
// ---------------------------------------------------------------------------

export async function scoreAttempt(
  attemptId: string,
  answers: Record<string, number>,
): Promise<ScoreResult> {
  const attempt = await queryOne(
    'SELECT * FROM academy_core.assessment_attempts WHERE id = $1',
    [attemptId],
  );
  if (!attempt) throw new Error(`Attempt ${attemptId} not found`);

  const assessment = await queryOne(
    'SELECT * FROM academy_core.assessments WHERE id = $1',
    [attempt.assessment_id],
  );
  if (!assessment) throw new Error(`Assessment ${attempt.assessment_id} not found`);

  const breakdown: ScoreBreakdown[] = [];
  let maxScore = 0;
  let earnedScore = 0;

  for (const [questionId, selectedIdx] of Object.entries(answers)) {
    const question = await queryOne<QuestionRow>(
      'SELECT * FROM academy_core.questions WHERE id = $1',
      [questionId],
    );
    if (!question) continue;

    const correct = question.options?.[selectedIdx]?.is_correct === true;
    const pointsEarned = correct ? question.points : 0;

    maxScore += question.points;
    earnedScore += pointsEarned;

    breakdown.push({
      questionId,
      correct,
      pointsEarned,
      pointsAvailable: question.points,
      explanation: correct ? null : question.explanation,
    });
  }

  const timeTakenSeconds = Math.floor(
    (Date.now() - new Date(attempt.started_at).getTime()) / 1000,
  );

  // Time bonus: +5% if completed in < 50% of allotted time
  let timeBonus = 0;
  if (assessment.time_limit_minutes) {
    const allowedSeconds = assessment.time_limit_minutes * 60;
    if (timeTakenSeconds < allowedSeconds * 0.5) {
      timeBonus = 5;
    }
  }

  const rawPercentage = maxScore > 0 ? Math.round((earnedScore / maxScore) * 100) : 0;
  const finalPercentage = Math.min(100, rawPercentage + timeBonus);
  const passed = finalPercentage >= assessment.passing_score;

  return {
    totalScore: earnedScore,
    maxScore,
    percentage: finalPercentage,
    breakdown,
    passed,
    timeBonus,
    timeTakenSeconds,
  };
}

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
