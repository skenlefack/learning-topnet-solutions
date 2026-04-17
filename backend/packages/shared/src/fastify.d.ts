// ============================================================================
// Type augmentation for @fastify/swagger schema properties
// Allows 'summary', 'description', 'tags', 'security', 'consumes' in route schema
// ============================================================================
import 'fastify';

declare module 'fastify' {
  interface FastifySchema {
    summary?: string;
    description?: string;
    tags?: string[];
    security?: Array<Record<string, string[]>>;
    consumes?: string[];
  }
}
