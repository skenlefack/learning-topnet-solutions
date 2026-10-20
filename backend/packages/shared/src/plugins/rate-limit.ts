// ============================================================================
// Topnet Solutions Academy — Rate Limiting Plugin (Fastify)
// Uses @fastify/rate-limit with Redis store for distributed rate limiting.
// Graceful degradation: falls back to in-memory store if Redis is unavailable.
// Usage: fastify.register(rateLimitPlugin)
// ============================================================================
import fp from 'fastify-plugin';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { getRedis, isRedisAvailable } from '../redis';

// ---------------------------------------------------------------------------
// Configuration defaults
// ---------------------------------------------------------------------------

/** Requests per window for different route categories */
const RATE_LIMITS = {
  /** Global default: 100 req/min per IP */
  global: { max: 100, timeWindow: '1 minute' },
  /** Auth routes (login/register): 10 req/min per IP — brute-force protection */
  auth: { max: 10, timeWindow: '1 minute' },
  /** Public/read-only routes (health, verify): 200 req/min per IP */
  public: { max: 200, timeWindow: '1 minute' },
  /** Admin routes: 50 req/min per authenticated user */
  admin: { max: 50, timeWindow: '1 minute' },
} as const;

// ---------------------------------------------------------------------------
// Route category detection helpers
// ---------------------------------------------------------------------------

function isAuthRoute(url: string): boolean {
  return /^\/(auth)\/(login|register|refresh|forgot-password|reset-password)/i.test(url);
}

function isPublicRoute(url: string): boolean {
  return /^\/(health|verify|metrics|public)\b/i.test(url);
}

function isAdminRoute(url: string): boolean {
  return /^\/(admin)\b/i.test(url);
}

// ---------------------------------------------------------------------------
// Key generator: IP for unauthenticated, user ID for authenticated admin
// ---------------------------------------------------------------------------

function keyGenerator(request: FastifyRequest): string {
  const url = request.url || '';

  // Admin routes: rate-limit per authenticated user
  if (isAdminRoute(url) && request.user?.sub) {
    return `admin:${request.user.sub}`;
  }

  // Everything else: rate-limit per IP
  return request.ip;
}

// ---------------------------------------------------------------------------
// Dynamic max resolver based on route category
// ---------------------------------------------------------------------------

function routeMax(request: FastifyRequest, _key: string): number {
  const url = request.url || '';
  if (isAuthRoute(url)) return RATE_LIMITS.auth.max;
  if (isPublicRoute(url)) return RATE_LIMITS.public.max;
  if (isAdminRoute(url)) return RATE_LIMITS.admin.max;
  return RATE_LIMITS.global.max;
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  // Skip rate limiting entirely in test environment
  if (process.env.NODE_ENV === 'test') {
    fastify.log.info('[RateLimit] Skipped — test environment');
    return;
  }

  // Build Redis store config if Redis is available
  let redisStore: { redis: ReturnType<typeof getRedis> } | undefined;
  try {
    if (isRedisAvailable()) {
      redisStore = { redis: getRedis() };
      fastify.log.info('[RateLimit] Using Redis store for distributed rate limiting');
    } else {
      fastify.log.warn(
        '[RateLimit] Redis unavailable — falling back to in-memory store'
      );
    }
  } catch {
    fastify.log.warn(
      '[RateLimit] Failed to connect to Redis for rate limiting — using in-memory store'
    );
  }

  await fastify.register(rateLimit, {
    // Global defaults
    max: routeMax,
    timeWindow: RATE_LIMITS.global.timeWindow,

    // Redis store (or undefined for built-in in-memory store)
    redis: redisStore?.redis,

    // Key generator
    keyGenerator,

    // Skip rate limiting for HEAD and OPTIONS (preflight)
    allowList: (_request: FastifyRequest, _key: string) => false,

    // Custom error response matching ARIS API format
    errorResponseBuilder: (_request: FastifyRequest, context) => {
      return {
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil(context.ttl / 1000),
      };
    },

    // Add standard rate-limit headers
    addHeadersOnExceeding: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
    },
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
  });

  fastify.log.info('[RateLimit] Plugin registered');
}

export default fp(rateLimitPlugin, {
  name: 'academy-rate-limit',
  fastify: '4.x',
});

export { rateLimitPlugin, RATE_LIMITS };
