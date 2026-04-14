import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for route tests — no Docker, no DB, no testcontainers.
 * Uses mocked DB/Kafka/Redis with Fastify inject.
 * Run with: npx vitest run --config vitest.routes.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['tests/routes/**/*.test.ts'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      '@aris-academy/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});
