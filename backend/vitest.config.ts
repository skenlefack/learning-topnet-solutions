import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: [
        'packages/shared/src/**/*.ts',
        'packages/academy-course/src/**/*.ts',
        'packages/academy-learning/src/**/*.ts',
        'packages/academy-assessment/src/**/*.ts',
        'packages/academy-live/src/**/*.ts',
      ],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/types/**'],
    },
    testTimeout: 30000,
    hookTimeout: 120000,
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
