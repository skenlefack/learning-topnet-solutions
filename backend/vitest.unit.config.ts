import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for pure unit tests — no Docker, no DB, no testcontainers.
 * Run with: npx vitest run --config vitest.unit.config.ts
 */
export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      '@topnet-academy/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
});
