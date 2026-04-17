import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.tsx'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: true,
    coverage: {
      provider: 'v8',
      include: ['src/app/**/*.tsx', 'src/app/**/*.ts'],
      exclude: ['src/app/layout.tsx', 'src/app/**/page.tsx'],
      thresholds: {
        lines: 50,
        branches: 40,
        functions: 45,
        statements: 50,
      },
    },
  },
});
