// ============================================================================
// ARIS Academy — Pagination Helper
// Generic paginate<T> that wraps any SELECT with COUNT + LIMIT/OFFSET
// ============================================================================
import { query } from '../db';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Paginates a SQL query and returns data + meta.
 *
 * @param baseQuery  - A SELECT statement (without LIMIT/OFFSET)
 * @param params     - Bound parameters for the baseQuery
 * @param page       - 1-based page number
 * @param limit      - Number of rows per page
 *
 * @example
 * const result = await paginate<Course>(
 *   'SELECT * FROM academy_core.courses WHERE status = $1',
 *   ['published'],
 *   1,
 *   20,
 * );
 */
export async function paginate<T>(
  baseQuery: string,
  params: unknown[],
  page: number,
  limit: number,
): Promise<PaginatedResult<T>> {
  // Total count
  const countSql = `SELECT COUNT(*)::int AS total FROM (${baseQuery}) AS _count_q`;
  const countRows = await query<{ total: number }>(countSql, params as unknown[]);
  const total = countRows[0]?.total ?? 0;

  // Data page
  const offset = (page - 1) * limit;
  const dataSql = `${baseQuery} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const data = await query<T>(dataSql, [...params, limit, offset]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
