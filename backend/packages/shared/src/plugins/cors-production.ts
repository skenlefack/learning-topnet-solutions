// ============================================================================
// Topnet Solutions Academy — Production CORS Configuration
// Provides strict origin control based on NODE_ENV and CORS_ORIGINS env var.
// Usage: import { getCorsConfig } from '@topnet-academy/shared';
//        await app.register(cors, getCorsConfig());
// ============================================================================
import type { FastifyCorsOptions } from '@fastify/cors';

// ---------------------------------------------------------------------------
// Default allowed origins per environment
// ---------------------------------------------------------------------------

const PRODUCTION_ORIGINS = [
  'https://learn.topnet-solutions.com',
  'https://www.learn.topnet-solutions.com',
];

const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
];

// ---------------------------------------------------------------------------
// Allowed headers & methods
// ---------------------------------------------------------------------------

const ALLOWED_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
] as const;

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Tenant-ID',
  'X-Request-ID',
] as const;

// ---------------------------------------------------------------------------
// getCorsConfig — builds a @fastify/cors options object
// ---------------------------------------------------------------------------

/**
 * Build CORS configuration from environment.
 *
 * Resolution order for allowed origins:
 *  1. `CORS_ORIGINS` env var (comma-separated list)
 *  2. Defaults based on `NODE_ENV`
 *     - production  -> PRODUCTION_ORIGINS
 *     - development -> DEVELOPMENT_ORIGINS
 *     - test        -> all origins allowed
 *
 * @returns FastifyCorsOptions ready for `fastify.register(cors, ...)`
 */
export function getCorsConfig(): FastifyCorsOptions {
  const env = process.env.NODE_ENV || 'development';

  // Allow everything in test mode
  if (env === 'test') {
    return {
      origin: true,
      credentials: true,
    };
  }

  // Determine allowed origins
  let origins: string[];

  if (process.env.CORS_ORIGINS) {
    origins = process.env.CORS_ORIGINS
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  } else if (env === 'production') {
    origins = [...PRODUCTION_ORIGINS];
  } else {
    // development / staging — include both production + localhost
    origins = [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];
  }

  return {
    origin: origins,
    methods: [...ALLOWED_METHODS],
    allowedHeaders: [...ALLOWED_HEADERS],
    credentials: true,
    maxAge: 86400, // 24 hours — browsers cache preflight responses
  };
}
