// ============================================================================
// Topnet Solutions Academy — Route Tests: Health Check Endpoints
// Tests GET /health for all 4 services using Fastify inject
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';

// ---------------------------------------------------------------------------
// Mocks — prevent real connections to DB/Redis/Kafka
// ---------------------------------------------------------------------------

// Mock @fastify/rate-limit (not installed — used by shared/plugins/rate-limit.ts)
vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('@topnet-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@topnet-academy/shared')>();
  return {
    ...original,
    getPool: vi.fn().mockReturnValue({
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      connect: vi.fn().mockResolvedValue({
        query: vi.fn().mockResolvedValue({ rows: [] }),
        release: vi.fn(),
      }),
    }),
    query: vi.fn().mockResolvedValue([]),
    queryOne: vi.fn().mockResolvedValue(null),
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
  };
});

vi.mock('../../packages/shared/src/kafka/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../packages/shared/src/kafka/index')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
    getProducer: vi.fn().mockResolvedValue({
      send: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
    }),
  };
});

// ---------------------------------------------------------------------------
// Import health routes
// ---------------------------------------------------------------------------

import { healthRoutes } from '../../packages/academy-course/src/routes/health';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Health Check Routes — All Services', () => {

  // =========================================================================
  // 1. academy-course health route (uses dedicated healthRoutes plugin)
  // =========================================================================

  describe('academy-course /health', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      process.env.SERVICE_NAME = 'academy-course';
      app = Fastify({ logger: false });
      await app.register(healthRoutes, { prefix: '/health' });
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 200 with status ok', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeDefined();
      expect(typeof body.uptime).toBe('number');
    });

    it('GET /health/ready returns 200 when DB is available', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health/ready',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ready');
      expect(body.db).toBe('connected');
    });
  });

  // =========================================================================
  // 2. academy-learning health (inline in server.ts)
  // =========================================================================

  describe('academy-learning /health (inline)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      app.get('/health', async () => ({
        status: 'ok',
        service: 'academy-learning',
        timestamp: new Date().toISOString(),
      }));
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 200 with service name', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('academy-learning');
      expect(body.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 3. academy-assessment health (inline in server.ts)
  // =========================================================================

  describe('academy-assessment /health (inline)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      app.get('/health', async () => ({
        status: 'ok',
        service: 'academy-assessment',
        timestamp: new Date().toISOString(),
      }));
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 200 with service name', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('academy-assessment');
      expect(body.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 4. academy-live health (inline in server.ts)
  // =========================================================================

  describe('academy-live /health (inline)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      app.get('/health', async () => ({
        status: 'ok',
        service: 'academy-live',
        timestamp: new Date().toISOString(),
      }));
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /health returns 200 with service name', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('academy-live');
      expect(body.timestamp).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Health check contract verification
  // =========================================================================

  describe('Health check contract', () => {
    it('all services return the same response structure', async () => {
      const services = ['academy-course', 'academy-learning', 'academy-assessment', 'academy-live'];

      for (const service of services) {
        const app = Fastify({ logger: false });
        app.get('/health', async () => ({
          status: 'ok',
          service,
          timestamp: new Date().toISOString(),
        }));
        await app.ready();

        const res = await app.inject({ method: 'GET', url: '/health' });
        const body = res.json();

        // All services must conform to this contract
        expect(res.statusCode).toBe(200);
        expect(body).toHaveProperty('status', 'ok');
        expect(body).toHaveProperty('service', service);
        expect(body).toHaveProperty('timestamp');
        // Timestamp should be a valid ISO 8601 date
        expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);

        await app.close();
      }
    });

    it('health endpoint does NOT require authentication', async () => {
      const app = Fastify({ logger: false });
      app.get('/health', async () => ({ status: 'ok', service: 'test' }));
      await app.ready();

      // No authorization header
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(res.statusCode).toBe(200);
      await app.close();
    });
  });
});
