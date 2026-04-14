// ============================================================================
// ARIS Academy — Route Tests: Live Session Routes
// Tests sessions, recordings, attendance (no real DB)
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret-for-live-routes';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
const mockQueryOne = vi.fn();
const mockPaginate = vi.fn();

vi.mock('@fastify/rate-limit', () => ({
  default: vi.fn(),
}));

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
  return {
    ...original,
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
    paginate: (...args: any[]) => mockPaginate(...args),
    transaction: vi.fn().mockImplementation(async (fn) => fn({ query: vi.fn() })),
    cacheDel: vi.fn().mockResolvedValue(undefined),
    publishEvent: vi.fn().mockResolvedValue(undefined),
    auditLog: vi.fn().mockResolvedValue(undefined),
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
      send: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
    }),
  };
});

vi.mock('../../packages/academy-live/src/services/bbb-client', () => ({
  bbbClient: {
    createMeeting: vi.fn().mockResolvedValue({ meetingID: 'bbb-123', attendeePW: 'ap', moderatorPW: 'mp' }),
    joinMeeting: vi.fn().mockReturnValue('https://bbb.example.com/join'),
    endMeeting: vi.fn().mockResolvedValue(true),
    getMeetingInfo: vi.fn().mockResolvedValue({ running: true }),
    getRecordings: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../../packages/academy-live/src/services/recording-processor', () => ({
  processRecording: vi.fn().mockResolvedValue({ id: 'rec-1', status: 'processed' }),
}));

// ---------------------------------------------------------------------------
// Import routes after mocks
// ---------------------------------------------------------------------------

import { authPlugin } from '@aris-academy/shared';
import { sessionRoutes } from '../../packages/academy-live/src/routes/sessions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function signToken(payload: Record<string, any> = {}): string {
  const defaults = {
    sub: 'usr-001',
    email: 'trainer@au-ibar.org',
    role: 'trainer',
    tenantId: 'au-ibar',
    tenantLevel: 'continental',
    firstName: 'Test',
    lastName: 'Trainer',
  };
  return jwt.sign({ ...defaults, ...payload }, TEST_SECRET, { expiresIn: '1h' });
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: TEST_SECRET });
  await app.register(authPlugin);

  app.decorateRequest('tenantFilter', null);
  app.addHook('preHandler', async (request) => {
    if (request.user) {
      request.tenantId = request.user.tenantId;
      request.tenantLevel = request.user.tenantLevel;
    }
    request.tenantFilter = () => ({ clause: '1=1', params: [] });
  });

  await app.register(sessionRoutes, { prefix: '/sessions' });

  app.setErrorHandler((error, _request, reply) => {
    return reply.code(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Live Session Routes — API (Fastify inject)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // GET /sessions — List sessions
  // =========================================================================

  describe('GET /sessions', () => {
    it('should return 200 with sessions list', async () => {
      mockQuery.mockResolvedValue([
        { id: 's1', title: { fr: 'Session 1' }, status: 'scheduled' },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/sessions',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
    });

    it('should return mock data when DB unavailable', async () => {
      mockQuery.mockRejectedValueOnce(new Error('DB down'));

      const res = await app.inject({
        method: 'GET',
        url: '/sessions',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
      expect(res.json().data.length).toBeGreaterThan(0);
    });

    it('should return 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/sessions',
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // GET /sessions/upcoming
  // =========================================================================

  describe('GET /sessions/upcoming', () => {
    it('should return 200 with upcoming sessions', async () => {
      mockQuery.mockResolvedValue([
        { id: 's1', status: 'scheduled', scheduled_at: new Date(Date.now() + 86400000).toISOString() },
      ]);

      const res = await app.inject({
        method: 'GET',
        url: '/sessions/upcoming',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().success).toBe(true);
    });
  });

  // =========================================================================
  // GET /sessions/:id — single session
  // =========================================================================

  describe('GET /sessions/:id', () => {
    it('should return 200 with session data', async () => {
      mockQueryOne.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        title: { fr: 'Session Test' },
        status: 'scheduled',
      });
      mockQuery.mockResolvedValue([]);

      const res = await app.inject({
        method: 'GET',
        url: '/sessions/00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.title.fr).toBe('Session Test');
    });

    it('should return 404 for missing session', async () => {
      mockQueryOne.mockResolvedValue(null);

      const res = await app.inject({
        method: 'GET',
        url: '/sessions/00000000-0000-0000-0000-ffffffffffff',
        headers: { authorization: `Bearer ${signToken()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // POST /sessions — Create session
  // =========================================================================

  describe('POST /sessions', () => {
    const newSession = {
      title: { fr: 'Nouvelle session', en: 'New session' },
      courseId: '00000000-0000-0000-0000-000000000301',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      durationMinutes: 90,
      maxParticipants: 100,
    };

    it('should return 201 when trainer creates a session', async () => {
      mockQueryOne.mockResolvedValue({ id: 'new-session-id', ...newSession, status: 'scheduled' });

      const res = await app.inject({
        method: 'POST',
        url: '/sessions',
        headers: { authorization: `Bearer ${signToken({ role: 'trainer' })}` },
        payload: newSession,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().success).toBe(true);
    });

    it('should return 403 when learner tries to create', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/sessions',
        headers: {
          authorization: `Bearer ${signToken({ role: 'learner', tenantLevel: 'country', tenantId: 'kenya' })}`,
        },
        payload: newSession,
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // DELETE /sessions/:id — Cancel session
  // =========================================================================

  describe('DELETE /sessions/:id', () => {
    it('should return 204 when trainer cancels session', async () => {
      mockQueryOne.mockResolvedValue({ id: 's1', trainer_id: 'usr-001' });

      const res = await app.inject({
        method: 'DELETE',
        url: '/sessions/00000000-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${signToken({ role: 'trainer' })}` },
      });

      expect(res.statusCode).toBe(204);
    });

    it('should return 404 when session not found', async () => {
      mockQueryOne.mockResolvedValue(null);

      const res = await app.inject({
        method: 'DELETE',
        url: '/sessions/00000000-0000-0000-0000-ffffffffffff',
        headers: { authorization: `Bearer ${signToken({ role: 'admin_continental' })}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
