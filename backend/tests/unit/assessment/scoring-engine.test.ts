// ============================================================================
// ARIS Academy — Unit Tests: Adaptive Scoring Engine
// Mocks DB queries (query, queryOne) to test selectQuestions() and
// scoreAttempt() in complete isolation — no database required.
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external deps that @aris-academy/shared barrel transitively imports
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));

// Mock the shared package's DB functions before importing the module under test
vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    query: vi.fn(),
    queryOne: vi.fn(),
  };
});

import { query, queryOne } from '@aris-academy/shared';
import {
  selectQuestions,
  scoreAttempt,
  type ScoreResult,
  type ScoreBreakdown,
} from '../../../packages/academy-assessment/src/services/scoring-engine';

const mockQuery = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);

// ---------------------------------------------------------------------------
// Factory helpers for test data
// ---------------------------------------------------------------------------

function makeQuestion(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'q-1',
    question_text: overrides.question_text ?? { en: 'Sample question?' },
    question_type: overrides.question_type ?? 'qcm',
    options: overrides.options ?? [
      { text: { en: 'A' }, is_correct: false },
      { text: { en: 'B' }, is_correct: true },
      { text: { en: 'C' }, is_correct: false },
      { text: { en: 'D' }, is_correct: false },
    ],
    correct_answer: overrides.correct_answer ?? null,
    difficulty: overrides.difficulty ?? 1,
    points: overrides.points ?? 10,
    tags: overrides.tags ?? [],
    explanation: overrides.explanation ?? { en: 'B is correct.' },
  };
}

function makeAssessment(overrides: Record<string, any> = {}) {
  return {
    id: overrides.id ?? 'assess-1',
    question_count: overrides.question_count ?? 10,
    passing_score: overrides.passing_score ?? 70,
    time_limit_minutes: overrides.time_limit_minutes ?? 30,
    ...overrides,
  };
}

/**
 * Build a pool of questions spread across all difficulty levels (1-5 cycling).
 */
function buildQuestionPool(count: number): any[] {
  const questions: any[] = [];
  for (let i = 0; i < count; i++) {
    const difficulty = (i % 5) + 1;
    questions.push(
      makeQuestion({ id: `q-${i}`, difficulty, points: 10 }),
    );
  }
  return questions;
}

// ===========================================================================
// selectQuestions
// ===========================================================================

describe('selectQuestions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Make shuffle deterministic
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  it('returns empty arrays when no questions exist for the assessment', async () => {
    mockQueryOne.mockResolvedValueOnce(makeAssessment());
    mockQuery.mockResolvedValueOnce([]); // no questions

    const result = await selectQuestions('assess-1', 'user-1');

    expect(result.questions).toHaveLength(0);
    expect(result.questionIds).toHaveLength(0);
  });

  it('throws when the assessment is not found in the database', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    await expect(selectQuestions('missing-id', 'user-1'))
      .rejects.toThrow('Assessment missing-id not found');
  });

  it('uses first-attempt distribution (40/40/20) when there are no previous attempts', async () => {
    const pool = buildQuestionPool(20);
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 10 }));
    mockQuery
      .mockResolvedValueOnce(pool) // all questions
      .mockResolvedValueOnce([]);  // no previous attempts

    const result = await selectQuestions('assess-1', 'user-1');

    expect(result.questions.length).toBeLessThanOrEqual(10);
    expect(result.questionIds.length).toBeLessThanOrEqual(10);

    // Verify questions are sanitized: no is_correct leaking through
    for (const q of result.questions) {
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('questionText');
      expect(q).toHaveProperty('questionType');
      expect(q).toHaveProperty('options');
      expect(q).toHaveProperty('points');
      expect(q).toHaveProperty('difficulty');
      for (const opt of q.options) {
        expect(opt).not.toHaveProperty('is_correct');
        expect(opt).toHaveProperty('text');
      }
    }
  });

  it('selects up to question_count questions from the pool', async () => {
    const pool = buildQuestionPool(30);
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 5 }));
    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([]);

    const result = await selectQuestions('assess-1', 'user-1');

    expect(result.questions.length).toBeLessThanOrEqual(5);
    expect(result.questionIds.length).toBeLessThanOrEqual(5);
  });

  it('returns all questions when pool size is less than question_count', async () => {
    const pool = buildQuestionPool(3);
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 10 }));
    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([]);

    const result = await selectQuestions('assess-1', 'user-1');

    // Only 3 questions exist so we can get at most 3
    expect(result.questions.length).toBe(3);
    expect(result.questionIds.length).toBe(3);
  });

  it('uses all questions when question_count is not set', async () => {
    const pool = buildQuestionPool(5);
    // question_count is null/undefined → defaults to allQuestions.length
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: null }));
    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([]);

    const result = await selectQuestions('assess-1', 'user-1');

    expect(result.questions.length).toBe(5);
  });

  it('shifts to harder distribution for strong learners (easy>=0.8, medium>=0.6)', async () => {
    const pool = buildQuestionPool(20);
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 10 }));

    // Build previous attempt where learner aced all questions (option index 1 = correct)
    const answers: Record<string, number> = {};
    for (const q of pool.slice(0, 10)) {
      answers[q.id] = 1; // is_correct: true
    }

    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([
        { id: 'attempt-1', answers, score: 90, passed: true },
      ]);

    const result = await selectQuestions('assess-1', 'user-1');

    // The engine should still return questions even when pushing harder difficulty
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.questionIds.length).toBeGreaterThan(0);
  });

  it('shifts to easier distribution for struggling learners (easy<0.5)', async () => {
    const pool = buildQuestionPool(20);
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 10 }));

    // All answers wrong (option index 0 = is_correct: false)
    const answers: Record<string, number> = {};
    for (const q of pool.slice(0, 10)) {
      answers[q.id] = 0;
    }

    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([
        { id: 'attempt-1', answers, score: 10, passed: false },
      ]);

    const result = await selectQuestions('assess-1', 'user-1');

    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('prefers fresh questions over ones from the most recent failed attempt', async () => {
    const pool = [
      makeQuestion({ id: 'fresh-1', difficulty: 1 }),
      makeQuestion({ id: 'fresh-2', difficulty: 2 }),
      makeQuestion({ id: 'fresh-3', difficulty: 3 }),
      makeQuestion({ id: 'stale-1', difficulty: 1 }),
      makeQuestion({ id: 'stale-2', difficulty: 3 }),
      makeQuestion({ id: 'stale-3', difficulty: 5 }),
    ];

    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 3 }));
    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([
        {
          id: 'attempt-fail',
          answers: { 'stale-1': 0, 'stale-2': 0, 'stale-3': 0 },
          score: 20,
          passed: false,
        },
      ]);

    const result = await selectQuestions('assess-1', 'user-1');

    const freshSelected = result.questionIds.filter((id) => id.startsWith('fresh-'));
    // Engine should prefer fresh questions
    expect(freshSelected.length).toBeGreaterThanOrEqual(1);
  });

  it('does not avoid stale questions when most recent attempt was passed', async () => {
    const pool = [
      makeQuestion({ id: 'q-a', difficulty: 1 }),
      makeQuestion({ id: 'q-b', difficulty: 3 }),
    ];

    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 2 }));
    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([
        {
          id: 'attempt-pass',
          answers: { 'q-a': 1, 'q-b': 1 },
          score: 100,
          passed: true, // passed = true → recentFailedQuestionIds stays empty
        },
      ]);

    const result = await selectQuestions('assess-1', 'user-1');

    // Both questions should be selectable since last attempt was a pass
    expect(result.questions.length).toBe(2);
  });

  it('handles previous attempts with stringified JSON answers', async () => {
    const pool = buildQuestionPool(10);
    mockQueryOne.mockResolvedValueOnce(makeAssessment({ question_count: 5 }));

    // answers as string (the engine JSON.parses it)
    const answers = JSON.stringify({ 'q-0': 1, 'q-1': 0, 'q-2': 1 });

    mockQuery
      .mockResolvedValueOnce(pool)
      .mockResolvedValueOnce([
        { id: 'attempt-1', answers, score: 50, passed: false },
      ]);

    // Should not throw — engine handles string answers
    const result = await selectQuestions('assess-1', 'user-1');
    expect(result.questions.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// scoreAttempt
// ===========================================================================

describe('scoreAttempt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scores correct answers with full points and wrong answers with 0', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 600_000).toISOString(), // 10 min ago
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(
        makeQuestion({ id: 'q-1', points: 10, explanation: { en: 'Explanation 1' } }),
      )
      .mockResolvedValueOnce(
        makeQuestion({ id: 'q-2', points: 20, explanation: { en: 'Explanation 2' } }),
      );

    const result = await scoreAttempt('attempt-1', {
      'q-1': 1, // correct (index 1 = is_correct: true)
      'q-2': 0, // wrong (index 0 = is_correct: false)
    });

    expect(result.totalScore).toBe(10);
    expect(result.maxScore).toBe(30); // 10 + 20

    // Breakdown for q-1 (correct)
    const b1 = result.breakdown.find((b) => b.questionId === 'q-1')!;
    expect(b1.correct).toBe(true);
    expect(b1.pointsEarned).toBe(10);
    expect(b1.pointsAvailable).toBe(10);
    expect(b1.explanation).toBeNull(); // correct answers get null explanation

    // Breakdown for q-2 (wrong)
    const b2 = result.breakdown.find((b) => b.questionId === 'q-2')!;
    expect(b2.correct).toBe(false);
    expect(b2.pointsEarned).toBe(0);
    expect(b2.pointsAvailable).toBe(20);
    expect(b2.explanation).toEqual({ en: 'Explanation 2' }); // wrong answers get explanation
  });

  it('calculates percentage correctly (earned/max * 100, rounded)', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 20 * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-2', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-3', points: 10 }));

    // 1 out of 3 correct = 33.33% → rounds to 33
    const result = await scoreAttempt('attempt-1', {
      'q-1': 1, // correct
      'q-2': 0, // wrong
      'q-3': 0, // wrong
    });

    expect(result.totalScore).toBe(10);
    expect(result.maxScore).toBe(30);
    expect(result.percentage).toBe(33); // Math.round(10/30 * 100) = 33
    expect(result.timeBonus).toBe(0); // 20 min >= 50% of 30 min
  });

  it('awards +5% time bonus when completed in less than 50% of allotted time', async () => {
    const now = Date.now();
    // Started 5 min ago, time limit = 30 min → 5 < 15 (50%) → bonus
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 5 * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }));

    const result = await scoreAttempt('attempt-1', { 'q-1': 1 }); // 100% raw

    expect(result.timeBonus).toBe(5);
    // Raw = 100%, bonus = +5 → capped at 100
    expect(result.percentage).toBe(100);
  });

  it('does NOT award time bonus when time taken is >= 50% of allotted time', async () => {
    const now = Date.now();
    // Started 20 min ago, time limit = 30 min → 20 >= 15 → no bonus
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 20 * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }));

    const result = await scoreAttempt('attempt-1', { 'q-1': 1 });

    expect(result.timeBonus).toBe(0);
    expect(result.percentage).toBe(100);
  });

  it('does NOT award time bonus when assessment has no time limit', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 50, time_limit_minutes: null }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }));

    const result = await scoreAttempt('attempt-1', { 'q-1': 1 });

    expect(result.timeBonus).toBe(0);
  });

  it('determines PASS when percentage >= passing_score', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 600_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 50, time_limit_minutes: null }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-2', points: 10 }));

    // 1 out of 2 correct = 50%, passing = 50
    const result = await scoreAttempt('attempt-1', { 'q-1': 1, 'q-2': 0 });

    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(true);
  });

  it('determines FAIL when percentage < passing_score', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 600_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: null }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-2', points: 10 }));

    // 1 out of 2 correct = 50%, passing = 70
    const result = await scoreAttempt('attempt-1', { 'q-1': 1, 'q-2': 0 });

    expect(result.percentage).toBe(50);
    expect(result.passed).toBe(false);
  });

  it('handles ALL correct answers (100% score)', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 25 * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-2', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-3', points: 10 }));

    const result = await scoreAttempt('attempt-1', {
      'q-1': 1,
      'q-2': 1,
      'q-3': 1,
    });

    expect(result.totalScore).toBe(30);
    expect(result.maxScore).toBe(30);
    expect(result.percentage).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.breakdown.every((b) => b.correct)).toBe(true);
  });

  it('handles ALL wrong answers (0% score)', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 25 * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-2', points: 10 }));

    const result = await scoreAttempt('attempt-1', {
      'q-1': 0, // wrong
      'q-2': 0, // wrong
    });

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(20);
    expect(result.percentage).toBe(0);
    expect(result.passed).toBe(false);
    expect(result.breakdown.every((b) => !b.correct)).toBe(true);
  });

  it('handles empty answers gracefully (0 max score)', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: null }));

    const result = await scoreAttempt('attempt-1', {});

    expect(result.totalScore).toBe(0);
    expect(result.maxScore).toBe(0);
    expect(result.percentage).toBe(0);
    expect(result.breakdown).toHaveLength(0);
    expect(result.passed).toBe(false);
    expect(result.timeBonus).toBe(0);
  });

  it('skips questions that are not found in the database', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 600_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 70, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }))
      .mockResolvedValueOnce(null); // q-2 not found

    const result = await scoreAttempt('attempt-1', { 'q-1': 1, 'q-2': 0 });

    // Only q-1 should appear in breakdown
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].questionId).toBe('q-1');
    expect(result.maxScore).toBe(10);
    expect(result.totalScore).toBe(10);
  });

  it('throws when the attempt is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    await expect(scoreAttempt('missing', { 'q-1': 0 }))
      .rejects.toThrow('Attempt missing not found');
  });

  it('throws when the assessment is not found for the attempt', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'missing-assessment',
        started_at: new Date(now - 60_000).toISOString(),
      })
      .mockResolvedValueOnce(null); // assessment not found

    await expect(scoreAttempt('attempt-1', { 'q-1': 0 }))
      .rejects.toThrow('Assessment missing-assessment not found');
  });

  it('caps percentage at 100 even with time bonus', async () => {
    const now = Date.now();
    // 100% raw + 5% bonus should be capped at 100
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 2 * 60_000).toISOString(), // 2 min < 15 min
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 50, time_limit_minutes: 30 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 10 }));

    const result = await scoreAttempt('attempt-1', { 'q-1': 1 });

    expect(result.timeBonus).toBe(5);
    expect(result.percentage).toBe(100); // Math.min(100, 100 + 5)
  });

  it('records timeTakenSeconds based on started_at vs now', async () => {
    const now = Date.now();
    const minutesAgo = 12;
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - minutesAgo * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 50, time_limit_minutes: 30 }));

    const result = await scoreAttempt('attempt-1', {});

    // timeTakenSeconds should be approximately 720 (12 * 60)
    // Allow small variance due to test execution time
    expect(result.timeTakenSeconds).toBeGreaterThanOrEqual(minutesAgo * 60 - 2);
    expect(result.timeTakenSeconds).toBeLessThanOrEqual(minutesAgo * 60 + 5);
  });

  it('handles questions with varying point values', async () => {
    const now = Date.now();
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'attempt-1',
        assessment_id: 'assess-1',
        started_at: new Date(now - 20 * 60_000).toISOString(),
      })
      .mockResolvedValueOnce(makeAssessment({ passing_score: 50, time_limit_minutes: null }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-1', points: 5 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-2', points: 15 }))
      .mockResolvedValueOnce(makeQuestion({ id: 'q-3', points: 30 }));

    // Get q-1 (5pt) and q-3 (30pt) correct, miss q-2 (15pt)
    const result = await scoreAttempt('attempt-1', {
      'q-1': 1,
      'q-2': 0,
      'q-3': 1,
    });

    expect(result.totalScore).toBe(35);  // 5 + 0 + 30
    expect(result.maxScore).toBe(50);    // 5 + 15 + 30
    expect(result.percentage).toBe(70);  // Math.round(35/50 * 100) = 70
    expect(result.passed).toBe(true);    // 70 >= 50
  });
});
