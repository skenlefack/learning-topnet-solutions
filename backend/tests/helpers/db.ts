// ============================================================================
// Test Helper — Database utilities
// ============================================================================
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getTestPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return pool;
}

export async function testQuery<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getTestPool().connect();
  try {
    await client.query('SET search_path TO academy_core, public');
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function testQueryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await testQuery<T>(text, params);
  return rows[0] || null;
}

/** Reset database — truncate all data tables */
export async function resetDatabase(): Promise<void> {
  const client = await getTestPool().connect();
  try {
    await client.query('SET search_path TO academy_core, public');
    await client.query(`
      TRUNCATE TABLE
        academy_core.audit_log,
        academy_core.live_session_attendance,
        academy_core.live_sessions,
        academy_core.certifications,
        academy_core.assessment_attempts,
        academy_core.questions,
        academy_core.assessments,
        academy_core.progress_tracking,
        academy_core.enrollments,
        academy_core.lessons,
        academy_core.modules,
        academy_core.courses,
        academy_core.users,
        academy_core.tenants
      CASCADE
    `);
  } finally {
    client.release();
  }
}

export async function closeTestPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
