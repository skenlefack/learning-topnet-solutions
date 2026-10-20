// ============================================================================
// Topnet Solutions Academy — Unit Tests: Pagination Helper
// Mocks the DB query function to test paginate() logic in isolation
// ============================================================================
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external deps that @topnet-academy/shared barrel transitively imports
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));

// Mock the db module used internally by pagination.ts
// paginate() imports query from '../db' (relative), so we must mock the actual
// db module path — mocking the barrel '@topnet-academy/shared' would NOT intercept
// the internal relative import.
vi.mock('../../../packages/shared/src/db/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../packages/shared/src/db/index')>();
  return { ...original, query: vi.fn() };
});

import { paginate } from '@topnet-academy/shared';
import { query } from '../../../packages/shared/src/db/index';

const mockQuery = vi.mocked(query);

describe('paginate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns paginated data with correct meta', async () => {
    // First call: count query
    mockQuery.mockResolvedValueOnce([{ total: 50 }]);
    // Second call: data query
    mockQuery.mockResolvedValueOnce([
      { id: '1', name: 'Course A' },
      { id: '2', name: 'Course B' },
    ]);

    const result = await paginate('SELECT * FROM courses', [], 1, 2);

    expect(result.data).toHaveLength(2);
    expect(result.meta.total).toBe(50);
    expect(result.meta.page).toBe(1);
    expect(result.meta.limit).toBe(2);
    expect(result.meta.totalPages).toBe(25);
  });

  it('calculates correct offset for page > 1', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 100 }]);
    mockQuery.mockResolvedValueOnce([]);

    await paginate('SELECT * FROM courses WHERE status = $1', ['published'], 3, 10);

    // Data query should have LIMIT and OFFSET appended
    const dataCall = mockQuery.mock.calls[1];
    expect(dataCall[0]).toContain('LIMIT $2 OFFSET $3');
    expect(dataCall[1]).toEqual(['published', 10, 20]); // offset = (3-1)*10 = 20
  });

  it('returns totalPages = 1 when total is 0', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 0 }]);
    mockQuery.mockResolvedValueOnce([]);

    const result = await paginate('SELECT 1', [], 1, 20);

    expect(result.data).toHaveLength(0);
    expect(result.meta.total).toBe(0);
    expect(result.meta.totalPages).toBe(1);
  });

  it('builds correct count query wrapping the base query', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 5 }]);
    mockQuery.mockResolvedValueOnce([]);

    await paginate('SELECT * FROM users WHERE role = $1', ['trainer'], 1, 10);

    const countCall = mockQuery.mock.calls[0];
    expect(countCall[0]).toContain('SELECT COUNT(*)::int AS total FROM (SELECT * FROM users WHERE role = $1) AS _count_q');
    expect(countCall[1]).toEqual(['trainer']);
  });

  it('handles single page of results', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 3 }]);
    mockQuery.mockResolvedValueOnce([{ id: '1' }, { id: '2' }, { id: '3' }]);

    const result = await paginate('SELECT * FROM courses', [], 1, 20);

    expect(result.meta.totalPages).toBe(1);
    expect(result.data).toHaveLength(3);
  });
});
