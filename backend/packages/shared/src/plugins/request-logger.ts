// ============================================================================
// ARIS Academy — Request Logger Plugin (Fastify)
// Structured JSON logging for every request with duration, user context,
// and unique X-Request-ID header. Skips /health and /metrics endpoints.
// Usage: fastify.register(requestLoggerPlugin)
// ============================================================================
import fp from 'fastify-plugin';
import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ---------------------------------------------------------------------------
// Routes to skip (high-frequency infra endpoints)
// ---------------------------------------------------------------------------

const SKIP_PATHS = ['/health', '/metrics'];

function shouldSkip(url: string): boolean {
  // Match exact path or path with trailing slash / query params
  return SKIP_PATHS.some(
    (p) => url === p || url.startsWith(`${p}/`) || url.startsWith(`${p}?`)
  );
}

// ---------------------------------------------------------------------------
// Type augmentation — request ID on request object
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    /** Unique per-request ID (X-Request-ID) */
    reqId: string;
  }
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

async function requestLoggerPlugin(fastify: FastifyInstance): Promise<void> {
  // Decorate request with a default so Fastify can add it to the prototype
  fastify.decorateRequest('reqId', '');

  // -----------------------------------------------------------------------
  // onRequest: assign request ID + start timer
  // -----------------------------------------------------------------------
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Use existing X-Request-ID header if provided, otherwise generate one
    const incomingId = request.headers['x-request-id'] as string | undefined;
    const requestId = incomingId || randomUUID();

    request.reqId = requestId;

    // Set the X-Request-ID response header so callers can correlate
    void reply.header('X-Request-ID', requestId);

    // Store the start time on the raw request for duration calculation
    (request.raw as any).__startTime = process.hrtime.bigint();
  });

  // -----------------------------------------------------------------------
  // onResponse: emit structured log line
  // -----------------------------------------------------------------------
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const url = request.url || '';

    // Skip noisy infra endpoints
    if (shouldSkip(url)) return;

    // Calculate duration in milliseconds
    const start: bigint | undefined = (request.raw as any).__startTime;
    let durationMs = 0;
    if (start) {
      durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    }

    // Extract user ID if authenticated
    const userId: string | undefined = request.user?.sub;

    // Build structured log entry
    const logEntry = {
      requestId: request.reqId,
      method: request.method,
      url,
      statusCode: reply.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || undefined,
      userId: userId || undefined,
      tenantId: request.tenantId || undefined,
    };

    // Use appropriate log level based on status code
    if (reply.statusCode >= 500) {
      fastify.log.error(logEntry, 'Request completed with server error');
    } else if (reply.statusCode >= 400) {
      fastify.log.warn(logEntry, 'Request completed with client error');
    } else {
      fastify.log.info(logEntry, 'Request completed');
    }
  });

  fastify.log.info('[RequestLogger] Plugin registered');
}

export default fp(requestLoggerPlugin, {
  name: 'academy-request-logger',
  fastify: '4.x',
});

export { requestLoggerPlugin };
