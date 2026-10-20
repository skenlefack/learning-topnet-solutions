// ============================================================================
// Topnet Solutions Academy — Test Global Setup
// Starts PostgreSQL via testcontainers, runs init.sql + seed.sql
// Redis/Kafka not needed — graceful degradation is already implemented
// ============================================================================
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

export async function setup() {
  console.log('[Test Setup] Starting PostgreSQL testcontainer...');

  const pg: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('academy_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const dbUrl = pg.getConnectionUri();

  // Run init.sql to create schema, enums, tables, indexes, RLS policies
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    const initSqlPath = path.resolve(__dirname, '../../infra/postgres/init.sql');
    const initSql = fs.readFileSync(initSqlPath, 'utf-8');
    await client.query(initSql);
    console.log('[Test Setup] init.sql executed');

    // Run seed.sql for reference/test data
    const seedSqlPath = path.resolve(__dirname, '../../infra/postgres/seed.sql');
    if (fs.existsSync(seedSqlPath)) {
      const seedSql = fs.readFileSync(seedSqlPath, 'utf-8');
      await client.query(seedSql);
      console.log('[Test Setup] seed.sql executed');
    }
  } finally {
    await client.end();
  }

  // Env vars for test processes
  process.env.DATABASE_URL = dbUrl;
  process.env.JWT_SECRET = 'test-jwt-secret-aris-2026';
  process.env.NODE_ENV = 'test';

  // Store container for teardown
  (globalThis as any).__PG_CONTAINER__ = pg;

  console.log(`[Test Setup] PostgreSQL ready at ${dbUrl}`);
}

export async function teardown() {
  const pg = (globalThis as any).__PG_CONTAINER__;
  if (pg) {
    console.log('[Test Setup] Stopping PostgreSQL testcontainer...');
    await pg.stop();
  }
}
