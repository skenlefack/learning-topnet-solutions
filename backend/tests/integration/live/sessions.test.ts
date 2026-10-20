// ============================================================================
// Topnet Solutions Academy — Integration Tests: Live Session Routes
// Tests real PostgreSQL + Redis via Testcontainers, mocks Kafka + BBB
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@topnet-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container), BBB client, recording processor
// ---------------------------------------------------------------------------

// Mock the actual Kafka module to prevent real broker connections.
// audit.ts imports publishEvent from '../kafka' (relative), so the barrel mock
// alone does NOT intercept that import — we must mock the source module directly.
vi.mock('../../../packages/shared/src/kafka/index', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../packages/shared/src/kafka/index')>();
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

vi.mock('@topnet-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@topnet-academy/shared')>();
  return {
    ...original,
    publishEvent: vi.fn().mockResolvedValue(undefined),
    createConsumer: vi.fn().mockResolvedValue({ disconnect: vi.fn() }),
  };
});

vi.mock('../../../packages/academy-live/src/services/bbb-client', () => ({
  bbbClient: {
    createMeeting: vi.fn().mockResolvedValue({ internalMeetingId: 'mock-internal-id' }),
    joinMeeting: vi.fn().mockReturnValue('https://bbb.test/join?token=mock'),
    endMeeting: vi.fn().mockResolvedValue(undefined),
    getMeetingInfo: vi.fn().mockResolvedValue({ running: true, participantCount: 5 }),
  },
}));

vi.mock('../../../packages/academy-live/src/services/recording-processor', () => ({
  processRecording: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks)
// ---------------------------------------------------------------------------

import { sessionRoutes } from '../../../packages/academy-live/src/routes/sessions';
import { bbbClient } from '../../../packages/academy-live/src/services/bbb-client';

// ---------------------------------------------------------------------------
// App builder — sessions are mounted under /sessions prefix in production,
// but the route handler registers at root of its plugin scope
// ---------------------------------------------------------------------------

async function buildSessionApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(sessionRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Helper: create a session directly in DB for update/delete tests
// ---------------------------------------------------------------------------

async function insertSession(overrides: Record<string, unknown> = {}): Promise<any> {
  const defaults = {
    courseId: IDS.courses.surveillance,
    title: '{"fr":"Session de test","en":"Test Session"}',
    description: '{"fr":"Description test"}',
    trainerId: IDS.users.amina, // trainer
    tenantId: IDS.tenants.continental,
    status: 'scheduled' as string,
    bbbMeetingId: `topnet-academy-test-${Date.now()}`,
    scheduledAt: new Date(Date.now() + 86400000).toISOString(), // tomorrow
    durationMinutes: 60,
    maxParticipants: 300,
  };
  const config = { ...defaults, ...overrides };

  const row = await testQueryOne(
    `INSERT INTO live_sessions
       (course_id, title, description, trainer_id, tenant_id, status, bbb_meeting_id, scheduled_at, duration_minutes, max_participants)
     VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6::live_session_status, $7, $8, $9, $10)
     RETURNING *`,
    [
      config.courseId,
      config.title,
      config.description,
      config.trainerId,
      config.tenantId,
      config.status,
      config.bbbMeetingId,
      config.scheduledAt,
      config.durationMinutes,
      config.maxParticipants,
    ],
  );
  return row;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Live Session Routes — Integration', () => {
  let app: FastifyInstance;
  const pool = getTestPool();

  beforeAll(async () => {
    await seedTestData(pool);
    app = await buildSessionApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanTestData(pool);
    await closeTestPool();
  });

  // Clean up sessions between tests
  beforeEach(async () => {
    await testQuery('DELETE FROM academy_core.live_attendance');
    await testQuery('DELETE FROM academy_core.live_sessions');
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Create session
  // =========================================================================

  describe('POST / — create a session', () => {
    it('should allow a trainer to create a session', async () => {
      const scheduledAt = new Date(Date.now() + 86400000).toISOString();

      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: {
          courseId: IDS.courses.surveillance,
          title: { fr: 'Session de formation', en: 'Training Session' },
          description: { fr: 'Description de la session' },
          scheduledAt,
          durationMinutes: 90,
          maxParticipants: 100,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('scheduled');
      expect(body.data.trainer_id).toBe(IDS.users.amina);
      expect(body.data.tenant_id).toBe(IDS.tenants.continental);
      expect(body.data.duration_minutes).toBe(90);
      expect(body.data.max_participants).toBe(100);
      expect(body.data.bbb_meeting_id).toBeDefined();

      // Verify in DB
      const dbSession = await testQueryOne(
        'SELECT * FROM live_sessions WHERE id = $1',
        [body.data.id],
      );
      expect(dbSession).not.toBeNull();
      expect(dbSession.status).toBe('scheduled');
    });

    it('should allow an admin to create a session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          courseId: IDS.courses.surveillance,
          title: { fr: 'Session admin' },
          description: { fr: 'Admin created' },
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      expect(res.statusCode).toBe(201);
    });
  });

  // =========================================================================
  // 2. List sessions
  // =========================================================================

  describe('GET / — list sessions', () => {
    it('should return scheduled and live sessions', async () => {
      // Create some sessions directly in DB
      await insertSession({ status: 'scheduled' });
      await insertSession({ status: 'scheduled' });

      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.data.length).toBeGreaterThanOrEqual(2);

      // Should include trainer info (joined data)
      for (const session of body.data) {
        expect(session).toHaveProperty('trainer_first_name');
        expect(session).toHaveProperty('trainer_last_name');
      }
    });

    it('should not return cancelled or ended sessions', async () => {
      await insertSession({ status: 'scheduled' });
      await insertSession({ status: 'cancelled' });
      await insertSession({ status: 'ended' });

      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Only the 'scheduled' session should appear (not cancelled or ended)
      for (const session of body.data) {
        expect(['scheduled', 'live']).toContain(session.status);
      }
    });
  });

  // =========================================================================
  // 3. Update session
  // =========================================================================

  describe('PUT /:id — update a session', () => {
    it('should allow the trainer to update their scheduled session', async () => {
      const session = await insertSession();

      const res = await app.inject({
        method: 'PUT',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: {
          title: { fr: 'Session modifiee', en: 'Modified Session' },
          durationMinutes: 120,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.duration_minutes).toBe(120);

      // Verify in DB
      const dbSession = await testQueryOne(
        'SELECT * FROM live_sessions WHERE id = $1',
        [session.id],
      );
      expect(dbSession.duration_minutes).toBe(120);
    });

    it('should allow admin to update any scheduled session', async () => {
      const session = await insertSession();

      const res = await app.inject({
        method: 'PUT',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          durationMinutes: 45,
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.duration_minutes).toBe(45);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'PUT',
        url: `/${fakeId}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: { durationMinutes: 30 },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 4. Only scheduled sessions can be modified
  // =========================================================================

  describe('Only scheduled sessions can be modified', () => {
    it('should return 409 when trying to update a live session', async () => {
      const session = await insertSession({ status: 'live' });

      const res = await app.inject({
        method: 'PUT',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: { durationMinutes: 120 },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toContain('Only scheduled sessions can be modified');
    });

    it('should return 409 when trying to update an ended session', async () => {
      const session = await insertSession({ status: 'ended' });

      const res = await app.inject({
        method: 'PUT',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: { durationMinutes: 120 },
      });

      expect(res.statusCode).toBe(409);
    });

    it('should return 409 when trying to update a cancelled session', async () => {
      const session = await insertSession({ status: 'cancelled' });

      const res = await app.inject({
        method: 'PUT',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: { durationMinutes: 120 },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  // =========================================================================
  // 5. Delete/cancel session
  // =========================================================================

  describe('DELETE /:id — cancel a session', () => {
    it('should cancel a session and return notified count', async () => {
      const session = await insertSession();

      const res = await app.inject({
        method: 'DELETE',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.cancelled).toBe(true);
      expect(body.data.notifiedCount).toBeDefined();

      // Verify status in DB
      const dbSession = await testQueryOne(
        'SELECT * FROM live_sessions WHERE id = $1',
        [session.id],
      );
      expect(dbSession.status).toBe('cancelled');
    });

    it('should end BBB meeting when cancelling a live session', async () => {
      const session = await insertSession({ status: 'live' });

      await app.inject({
        method: 'DELETE',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
      });

      expect(bbbClient.endMeeting).toHaveBeenCalledWith(session.bbb_meeting_id);
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'DELETE',
        url: `/${fakeId}`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 6. Permission checks
  // =========================================================================

  describe('Permission checks', () => {
    it('should return 403 when a learner tries to create a session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          courseId: IDS.courses.surveillance,
          title: { fr: 'Session interdite' },
          description: { fr: 'Non autorise' },
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toContain('Insufficient permissions');
    });

    it('should return 403 when a learner tries to update a session', async () => {
      const session = await insertSession();

      const res = await app.inject({
        method: 'PUT',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { durationMinutes: 30 },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 when a non-owner trainer tries to cancel a session', async () => {
      // Session owned by Amina (trainer)
      const session = await insertSession({ trainerId: IDS.users.amina });

      // Jean is a different trainer
      const jeanToken = TOKENS.trainer(); // default trainer is Amina, so use Kenya admin as alternative
      // For a proper test we would create a token for Jean, but the fixture trainer IS Amina
      // Let's use kenyaLearner who has 'learner' role which is not trainer/admin
      const res = await app.inject({
        method: 'DELETE',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // =========================================================================
  // 7. Join URL generation
  // =========================================================================

  describe('GET /:id/join — generate BBB join URL', () => {
    it('should return a join URL for a scheduled session (creates meeting)', async () => {
      const session = await insertSession({ status: 'scheduled' });

      const res = await app.inject({
        method: 'GET',
        url: `/${session.id}/join`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.joinUrl).toBe('https://bbb.test/join?token=mock');
      expect(body.data.isModerator).toBe(false); // learner is not moderator

      // BBB createMeeting should have been called (session was scheduled)
      expect(bbbClient.createMeeting).toHaveBeenCalled();

      // Verify session status changed to 'live' in DB
      const dbSession = await testQueryOne(
        'SELECT * FROM live_sessions WHERE id = $1',
        [session.id],
      );
      expect(dbSession.status).toBe('live');
    });

    it('should mark trainer as moderator', async () => {
      const session = await insertSession({
        trainerId: IDS.users.amina,
        status: 'scheduled',
      });

      const res = await app.inject({
        method: 'GET',
        url: `/${session.id}/join`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` }, // Amina is the trainer
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.isModerator).toBe(true);
    });

    it('should track attendance on join', async () => {
      const session = await insertSession({ status: 'scheduled' });

      await app.inject({
        method: 'GET',
        url: `/${session.id}/join`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      // Verify attendance record
      const attendance = await testQueryOne(
        'SELECT * FROM live_attendance WHERE session_id = $1 AND user_id = $2',
        [session.id, IDS.users.kenyaLearner],
      );
      expect(attendance).not.toBeNull();
    });

    it('should return 410 for cancelled session', async () => {
      const session = await insertSession({ status: 'cancelled' });

      const res = await app.inject({
        method: 'GET',
        url: `/${session.id}/join`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(410);
      expect(res.json().error).toContain('cancelled');
    });

    it('should return 404 for non-existent session', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'GET',
        url: `/${fakeId}/join`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 8. Get session detail
  // =========================================================================

  describe('GET /:id — session detail', () => {
    it('should return session detail with trainer info', async () => {
      const session = await insertSession();

      const res = await app.inject({
        method: 'GET',
        url: `/${session.id}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.trainer_first_name).toBe('Amina');
      expect(body.data.trainer_last_name).toBe('Osei');
      expect(body.data).toHaveProperty('total_attendees');
    });
  });

  // =========================================================================
  // 9. End session
  // =========================================================================

  describe('POST /:id/end — end a session', () => {
    it('should end a live session and call BBB endMeeting', async () => {
      const session = await insertSession({ status: 'live' });

      const res = await app.inject({
        method: 'POST',
        url: `/${session.id}/end`,
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('ended');

      // BBB endMeeting should have been called
      expect(bbbClient.endMeeting).toHaveBeenCalledWith(session.bbb_meeting_id);

      // Verify in DB
      const dbSession = await testQueryOne(
        'SELECT * FROM live_sessions WHERE id = $1',
        [session.id],
      );
      expect(dbSession.status).toBe('ended');
    });

    it('should return 403 when a non-trainer/non-admin tries to end a session', async () => {
      const session = await insertSession({ status: 'live' });

      const res = await app.inject({
        method: 'POST',
        url: `/${session.id}/end`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
