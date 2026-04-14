// ============================================================================
// ARIS Academy — PostgreSQL Connection Pool
// Graceful degradation: queries return empty results if DB is unavailable
// ============================================================================
import { Pool, PoolConfig } from 'pg';

let pool: Pool | null = null;
let dbAvailable = true;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
    pool.on('error', (err) => {
      console.error('[DB] Unexpected pool error:', err.message);
      dbAvailable = false;
    });
    pool.on('connect', () => {
      dbAvailable = true;
    });
  }
  return pool;
}

export function isDbAvailable(): boolean {
  return dbAvailable;
}

export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const client = await getPool().connect();
  try {
    await client.query('SET search_path TO academy_core, public');
    const result = await client.query(text, params);
    dbAvailable = true;
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function transaction<T>(fn: (client: any) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('SET search_path TO academy_core, public');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
