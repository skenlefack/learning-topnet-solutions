// ============================================================================
// ARIS Academy — Shared Package Barrel Export
// ============================================================================

// Core infrastructure
export * from './types';
export * from './db';
export * from './redis';
export * from './kafka';

// Validation
export * from './utils/validation';

// Pagination
export * from './utils/pagination';

// Audit
export * from './utils/audit';

// Fastify plugins (register with fastify.register())
export { default as authPlugin } from './plugins/auth';
export { default as tenantScopePlugin } from './plugins/tenant-scope';
export { default as metricsPlugin } from './plugins/metrics';
export type { TenantFilterResult } from './plugins/tenant-scope';
export { default as rateLimitPlugin } from './plugins/rate-limit';
export { default as requestLoggerPlugin } from './plugins/request-logger';

// CORS configuration
export { getCorsConfig } from './plugins/cors-production';
