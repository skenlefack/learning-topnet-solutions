// ============================================================================
// Topnet Solutions Academy — Unit Tests: Progression Engine
// Tests pure helpers and DB-dependent functions with mocked dependencies
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external deps that @topnet-academy/shared barrel transitively imports
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));

vi.mock('@topnet-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@topnet-academy/shared')>();
  return {
    ...original,
    query: vi.fn(),
    queryOne: vi.fn(),
    publishEvent: vi.fn(),
    cacheDel: vi.fn(),
    getRedis: vi.fn(() => ({
      pipeline: vi.fn(() => ({
        zadd: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      })),
      hgetall: vi.fn().mockResolvedValue({}),
      hmset: vi.fn().mockResolvedValue('OK'),
      expire: vi.fn().mockResolvedValue(1),
    })),
  };
});

import { query, queryOne, publishEvent, cacheDel } from '@topnet-academy/shared';
import {
  getNextLevel,
  getPassingScore,
  recalculateProgress,
  checkLevelUnlock,
} from '../../../packages/academy-learning/src/services/progression-engine';

const mockQuery = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockPublishEvent = vi.mocked(publishEvent);
const mockCacheDel = vi.mocked(cacheDel);

// ---------------------------------------------------------------------------
// Pure function tests: getNextLevel
// ---------------------------------------------------------------------------

describe('getNextLevel', () => {
  it('returns "intermediate" for "beginner"', () => {
    expect(getNextLevel('beginner')).toBe('intermediate');
  });

  it('returns "advanced" for "intermediate"', () => {
    expect(getNextLevel('intermediate')).toBe('advanced');
  });

  it('returns "expert" for "advanced"', () => {
    expect(getNextLevel('advanced')).toBe('expert');
  });

  it('returns null for "expert" (highest level)', () => {
    expect(getNextLevel('expert')).toBeNull();
  });

  it('returns null for an unknown level', () => {
    expect(getNextLevel('nonexistent')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Pure function tests: getPassingScore
// ---------------------------------------------------------------------------

describe('getPassingScore', () => {
  it('returns 70 for "beginner"', () => {
    expect(getPassingScore('beginner')).toBe(70);
  });

  it('returns 75 for "intermediate"', () => {
    expect(getPassingScore('intermediate')).toBe(75);
  });

  it('returns 80 for "advanced"', () => {
    expect(getPassingScore('advanced')).toBe(80);
  });

  it('returns 85 for "expert"', () => {
    expect(getPassingScore('expert')).toBe(85);
  });

  it('returns 70 as default for unknown level', () => {
    expect(getPassingScore('unknown')).toBe(70);
  });
});

// ---------------------------------------------------------------------------
// recalculateProgress
// ---------------------------------------------------------------------------

describe('recalculateProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates progress and returns the updated enrollment', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'enroll-1',
      user_id: 'user-1',
      course_id: 'course-1',
      status: 'active',
      progress_percent: 60,
    });

    const result = await recalculateProgress('enroll-1');

    expect(result).toBeDefined();
    expect(result!.id).toBe('enroll-1');
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
    // The CTE query should contain the enrollment ID
    expect(mockQueryOne.mock.calls[0][1]).toEqual(['enroll-1']);
  });

  it('clears cache for the user after progress update', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'enroll-1',
      user_id: 'user-1',
      course_id: 'course-1',
      status: 'active',
      progress_percent: 75,
    });

    await recalculateProgress('enroll-1');

    expect(mockCacheDel).toHaveBeenCalledWith('enrollments:user-1:*');
  });

  it('triggers checkLevelUnlock when enrollment status is "completed"', async () => {
    // Return an enrollment with status = 'completed'
    mockQueryOne
      // recalculateProgress CTE result
      .mockResolvedValueOnce({
        id: 'enroll-1',
        user_id: 'user-1',
        course_id: 'course-1',
        status: 'completed',
        progress_percent: 100,
      })
      // checkLevelUnlock: course lookup
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'beginner',
        tenant_id: 'tenant-1',
      })
      // checkLevelUnlock: module check
      .mockResolvedValueOnce({
        total_modules: 2,
        completed_modules: 2,
      })
      // checkLevelUnlock: final assessment
      .mockResolvedValueOnce({
        score: 85,
        passed: true,
      })
      // checkLevelUnlock: existing cert check
      .mockResolvedValueOnce(null) // no existing cert
      // checkLevelUnlock: insert cert
      .mockResolvedValueOnce({
        id: 'cert-1',
        user_id: 'user-1',
        course_id: 'course-1',
        level: 'beginner',
        certificate_number: 'ARIS-BEG-XXXXX',
      });

    await recalculateProgress('enroll-1');

    // Should have cleared cache
    expect(mockCacheDel).toHaveBeenCalledWith('enrollments:user-1:*');
    // checkLevelUnlock should have been called (we verify via the queryOne calls)
    // At minimum, course lookup + module check + assessment check should have happened
    expect(mockQueryOne.mock.calls.length).toBeGreaterThan(1);
  });

  it('does not trigger checkLevelUnlock when status is not "completed"', async () => {
    mockQueryOne.mockResolvedValueOnce({
      id: 'enroll-1',
      user_id: 'user-1',
      course_id: 'course-1',
      status: 'active',
      progress_percent: 50,
    });

    await recalculateProgress('enroll-1');

    // Only 1 queryOne call (the CTE), no further calls for checkLevelUnlock
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
  });

  it('returns null when enrollment not found (CTE returns nothing)', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    const result = await recalculateProgress('missing-enrollment');

    expect(result).toBeNull();
    expect(mockCacheDel).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// checkLevelUnlock
// ---------------------------------------------------------------------------

describe('checkLevelUnlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues certification when all checks pass (beginner level)', async () => {
    mockQueryOne
      // course lookup
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'beginner',
        tenant_id: 'tenant-1',
      })
      // module check: all required modules completed
      .mockResolvedValueOnce({
        total_modules: 3,
        completed_modules: '3', // DB returns string sometimes
      })
      // final assessment: passed with high score
      .mockResolvedValueOnce({
        score: '90',
        passed: true,
      })
      // no existing cert
      .mockResolvedValueOnce(null)
      // INSERT cert returning
      .mockResolvedValueOnce({
        id: 'cert-new',
        user_id: 'user-1',
        course_id: 'course-1',
        level: 'beginner',
        certificate_number: 'ARIS-BEG-ABC123',
      });

    await checkLevelUnlock('user-1', 'course-1');

    // Should publish certification event
    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith(
      'academy.certification.issued.v1',
      expect.objectContaining({ level: 'beginner' }),
      'tenant-1',
      'user-1',
    );
  });

  it('skips when course is not found', async () => {
    mockQueryOne.mockResolvedValueOnce(null);

    await checkLevelUnlock('user-1', 'missing-course');

    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
  });

  it('skips when not all required modules are completed', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'intermediate',
        tenant_id: 'tenant-1',
      })
      .mockResolvedValueOnce({
        total_modules: 5,
        completed_modules: '3', // only 3 of 5 completed
      });

    await checkLevelUnlock('user-1', 'course-1');

    expect(mockPublishEvent).not.toHaveBeenCalled();
    // Should not proceed to assessment check
    expect(mockQueryOne).toHaveBeenCalledTimes(2);
  });

  it('skips when assessment is not passed', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'advanced',
        tenant_id: 'tenant-1',
      })
      .mockResolvedValueOnce({
        total_modules: 2,
        completed_modules: '2',
      })
      .mockResolvedValueOnce({
        score: '50',
        passed: false, // did not pass
      });

    await checkLevelUnlock('user-1', 'course-1');

    expect(mockPublishEvent).not.toHaveBeenCalled();
    expect(mockQueryOne).toHaveBeenCalledTimes(3);
  });

  it('skips when assessment score is below the level passing threshold', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'advanced', // passing_score = 80
        tenant_id: 'tenant-1',
      })
      .mockResolvedValueOnce({
        total_modules: 2,
        completed_modules: '2',
      })
      .mockResolvedValueOnce({
        score: '75', // below 80 for advanced
        passed: true, // passed the assessment's own threshold but not the level's
      });

    await checkLevelUnlock('user-1', 'course-1');

    expect(mockPublishEvent).not.toHaveBeenCalled();
  });

  it('requires live attendance for expert level', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'expert',
        tenant_id: 'tenant-1',
      })
      .mockResolvedValueOnce({
        total_modules: 2,
        completed_modules: '2',
      })
      .mockResolvedValueOnce({
        score: '90',
        passed: true,
      })
      // live attendance check: 0 sessions attended
      .mockResolvedValueOnce({
        attended: 0,
      });

    await checkLevelUnlock('user-1', 'course-1');

    // Should NOT issue certification because no live attendance
    expect(mockPublishEvent).not.toHaveBeenCalled();
    // Should have checked 4 things: course, modules, assessment, live
    expect(mockQueryOne).toHaveBeenCalledTimes(4);
  });

  it('issues certification for expert level when live attendance exists', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'expert',
        tenant_id: 'tenant-1',
      })
      .mockResolvedValueOnce({
        total_modules: 1,
        completed_modules: '1',
      })
      .mockResolvedValueOnce({
        score: '90',
        passed: true,
      })
      // live attendance check: 2 sessions attended
      .mockResolvedValueOnce({
        attended: 2,
      })
      // no existing cert
      .mockResolvedValueOnce(null)
      // INSERT cert
      .mockResolvedValueOnce({
        id: 'cert-expert',
        user_id: 'user-1',
        course_id: 'course-1',
        level: 'expert',
        certificate_number: 'ARIS-EXP-XYZ789',
      });

    await checkLevelUnlock('user-1', 'course-1');

    expect(mockPublishEvent).toHaveBeenCalledTimes(1);
    expect(mockPublishEvent).toHaveBeenCalledWith(
      'academy.certification.issued.v1',
      expect.objectContaining({ level: 'expert' }),
      'tenant-1',
      'user-1',
    );
  });

  it('does not issue duplicate certification if one already exists', async () => {
    mockQueryOne
      .mockResolvedValueOnce({
        id: 'course-1',
        level: 'beginner',
        tenant_id: 'tenant-1',
      })
      .mockResolvedValueOnce({
        total_modules: 2,
        completed_modules: '2',
      })
      .mockResolvedValueOnce({
        score: '85',
        passed: true,
      })
      // existing cert found
      .mockResolvedValueOnce({
        id: 'cert-existing',
      });

    await checkLevelUnlock('user-1', 'course-1');

    // Should NOT publish event or insert new cert
    expect(mockPublishEvent).not.toHaveBeenCalled();
    // 4 queryOne calls: course, modules, assessment, existing cert check
    expect(mockQueryOne).toHaveBeenCalledTimes(4);
  });
});
