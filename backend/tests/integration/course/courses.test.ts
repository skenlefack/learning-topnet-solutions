// ============================================================================
// Topnet Solutions Academy — Integration Tests: Course Routes
// Tests real PostgreSQL + Redis via Testcontainers, mocks Kafka + MinIO
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@topnet-academy/shared';
import { TOKENS, createTestToken } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container), course-resolver, MinIO
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

vi.mock('../../../packages/academy-course/src/services/course-resolver', () => ({
  resolveCourse: vi.fn().mockResolvedValue(null),
  invalidateResolvedCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../packages/academy-course/src/services/minio', () => ({
  uploadFile: vi.fn().mockResolvedValue('https://minio.test/file.png'),
  getSignedUrl: vi.fn().mockResolvedValue('https://minio.test/signed'),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

// ---------------------------------------------------------------------------
// Import route handler (after mocks)
// ---------------------------------------------------------------------------

import { courseRoutes } from '../../../packages/academy-course/src/routes/courses';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildCourseApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(courseRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Course Routes — Integration', () => {
  let app: FastifyInstance;
  const pool = getTestPool();

  beforeAll(async () => {
    await seedTestData(pool);
    app = await buildCourseApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanTestData(pool);
    await closeTestPool();
  });

  // Clean up test-created courses between tests to avoid slug collisions
  beforeEach(async () => {
    await testQuery(
      `DELETE FROM academy_core.course_overrides
       WHERE course_id NOT IN (SELECT id FROM academy_core.courses WHERE slug IN (
         'surveillance-epidemiologique','collecte-donnees-terrain','analyse-rapports',
         'administration-systeme','gestion-formulaires','interoperabilite-dhis2-fhir'
       ))`,
    );
    await testQuery(
      `DELETE FROM academy_core.courses WHERE slug NOT IN (
         'surveillance-epidemiologique','collecte-donnees-terrain','analyse-rapports',
         'administration-systeme','gestion-formulaires','interoperabilite-dhis2-fhir'
       )`,
    );
  });

  // =========================================================================
  // 1. CRUD — Create, Read, Update, Delete
  // =========================================================================

  describe('CRUD operations', () => {
    it('should create a course (POST /)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Nouveau Cours', en: 'New Course' },
          description: { fr: 'Description du cours' },
          slug: 'nouveau-cours-test',
          level: 'beginner',
          status: 'draft',
          estimatedHours: 10,
          passingScore: 70,
          tags: ['test', 'integration'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('nouveau-cours-test');
      expect(body.data.status).toBe('draft');
      expect(body.data.passing_score).toBe(70);
      expect(body.data.tags).toEqual(['test', 'integration']);

      // Verify in DB
      const dbCourse = await testQueryOne(
        'SELECT * FROM courses WHERE slug = $1',
        ['nouveau-cours-test'],
      );
      expect(dbCourse).not.toBeNull();
      expect(dbCourse.level).toBe('beginner');
    });

    it('should read a course by ID (GET /:id)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/${IDS.courses.surveillance}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('surveillance-epidemiologique');
      expect(body.data.modules).toBeDefined();
      expect(body.data.modules.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent course', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'GET',
        url: `/${fakeId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
    });

    it('should update a course (PUT /:id)', async () => {
      // Create a course first
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours a modifier' },
          slug: 'cours-a-modifier',
          level: 'beginner',
        },
      });
      const courseId = createRes.json().data.id;

      // Update it
      const res = await app.inject({
        method: 'PUT',
        url: `/${courseId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours modifie', en: 'Modified Course' },
          level: 'intermediate',
          tags: ['updated'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.level).toBe('intermediate');
      expect(body.data.tags).toEqual(['updated']);

      // Verify in DB
      const dbCourse = await testQueryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
      expect(dbCourse.level).toBe('intermediate');
    });

    it('should delete a course (DELETE /:id)', async () => {
      // Create a course first
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours a supprimer' },
          slug: 'cours-a-supprimer',
          level: 'beginner',
        },
      });
      const courseId = createRes.json().data.id;

      // Delete it
      const res = await app.inject({
        method: 'DELETE',
        url: `/${courseId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify removed from DB
      const dbCourse = await testQueryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
      expect(dbCourse).toBeNull();
    });
  });

  // =========================================================================
  // 2. List with pagination
  // =========================================================================

  describe('List with pagination', () => {
    it('should list courses with pagination defaults', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.meta).toBeDefined();
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(20);
      expect(body.meta.total).toBeGreaterThanOrEqual(6); // seeded courses
    });

    it('should respect page and limit parameters', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/?page=1&limit=2',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeLessThanOrEqual(2);
      expect(body.meta.limit).toBe(2);
      expect(body.meta.totalPages).toBeGreaterThanOrEqual(3); // 6 courses / 2 per page
    });

    it('should filter courses by level', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/?level=beginner',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      for (const course of body.data) {
        expect(course.level).toBe('beginner');
      }
    });

    it('should filter courses by status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/?status=published',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      for (const course of body.data) {
        expect(course.status).toBe('published');
      }
    });

    it('should search courses by title', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/?search=Surveillance&lang=fr',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 3. Multi-tenant isolation
  // =========================================================================

  describe('Multi-tenant isolation', () => {
    it('Kenya admin can create a course under Kenya tenant', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
        payload: {
          title: { en: 'Kenya Specific Course' },
          slug: 'kenya-specific-course',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.tenant_id).toBe(IDS.tenants.kenya);
      expect(body.data.tenant_level).toBe('country');
    });

    it('Nigeria admin should NOT see Kenya-only courses in listing', async () => {
      // Create a Kenya course
      await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
        payload: {
          title: { en: 'Kenya Only Course' },
          slug: 'kenya-only-course',
          level: 'beginner',
        },
      });

      // Nigeria admin lists courses — should see continental but not Kenya's country-level course
      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.nigeriaAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const kenyaCourse = body.data.find((c: any) => c.slug === 'kenya-only-course');
      expect(kenyaCourse).toBeUndefined();
    });

    it('Continental admin can see all courses across tenants', async () => {
      // Create a Kenya course
      await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
        payload: {
          title: { en: 'Kenya Test Course' },
          slug: 'kenya-test-course-visibility',
          level: 'beginner',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Continental admin sees all courses matching tenant_id or tenant_level='continental'
      expect(body.data.length).toBeGreaterThanOrEqual(6);
    });
  });

  // =========================================================================
  // 4. Override system
  // =========================================================================

  describe('Override system', () => {
    it('should create a tenant override for a continental course', async () => {
      const courseId = IDS.courses.surveillance;

      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
        payload: {
          title: { en: 'EAC Override: Epidemiological Surveillance' },
          estimatedHours: 15,
          tags: ['eac-specific'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.course_id).toBe(courseId);
      expect(body.data.tenant_id).toBe(IDS.tenants.eac);

      // Verify in DB
      const dbOverride = await testQueryOne(
        'SELECT * FROM course_overrides WHERE course_id = $1 AND tenant_id = $2',
        [courseId, IDS.tenants.eac],
      );
      expect(dbOverride).not.toBeNull();
      expect(dbOverride.override_data).toHaveProperty('title');
      expect(dbOverride.override_data).toHaveProperty('estimatedHours');
    });

    it('should upsert override on second POST (ON CONFLICT)', async () => {
      const courseId = IDS.courses.surveillance;

      // First override
      await app.inject({
        method: 'POST',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
        payload: { estimatedHours: 15 },
      });

      // Second override — should update, not duplicate
      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
        payload: { estimatedHours: 20, tags: ['updated'] },
      });

      expect(res.statusCode).toBe(200);

      const overrides = await testQuery(
        'SELECT * FROM course_overrides WHERE course_id = $1 AND tenant_id = $2',
        [courseId, IDS.tenants.eac],
      );
      expect(overrides.length).toBe(1);
      expect(overrides[0].override_data.estimatedHours).toBe(20);
    });

    it('should list all overrides for a course', async () => {
      const courseId = IDS.courses.surveillance;

      // Create EAC override
      await app.inject({
        method: 'POST',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
        payload: { estimatedHours: 15 },
      });

      // Create Kenya override
      await app.inject({
        method: 'POST',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
        payload: { estimatedHours: 12 },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/${courseId}/overrides`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete the current tenant override', async () => {
      const courseId = IDS.courses.surveillance;

      // Create override
      await app.inject({
        method: 'POST',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
        payload: { estimatedHours: 15 },
      });

      // Delete it
      const res = await app.inject({
        method: 'DELETE',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify removed
      const dbOverride = await testQueryOne(
        'SELECT * FROM course_overrides WHERE course_id = $1 AND tenant_id = $2',
        [courseId, IDS.tenants.eac],
      );
      expect(dbOverride).toBeNull();
    });

    it('should return 404 when no override exists for tenant', async () => {
      const courseId = IDS.courses.surveillance;

      const res = await app.inject({
        method: 'DELETE',
        url: `/${courseId}/override`,
        headers: { authorization: `Bearer ${TOKENS.eacAdmin()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 5. Publish workflow
  // =========================================================================

  describe('Publish workflow', () => {
    it('should publish a draft course and set published_at', async () => {
      // Create draft course
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours brouillon' },
          slug: 'cours-brouillon-publish',
          level: 'beginner',
          status: 'draft',
        },
      });
      const courseId = createRes.json().data.id;
      expect(createRes.json().data.status).toBe('draft');
      expect(createRes.json().data.published_at).toBeNull();

      // Publish it
      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/publish`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('published');
      expect(body.data.published_at).not.toBeNull();

      // Verify in DB
      const dbCourse = await testQueryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
      expect(dbCourse.status).toBe('published');
      expect(dbCourse.published_at).not.toBeNull();
    });

    it('should return 400 when trying to publish an already published course', async () => {
      // The seeded courses are already published
      const res = await app.inject({
        method: 'POST',
        url: `/${IDS.courses.surveillance}/publish`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
    });
  });

  // =========================================================================
  // 6. Archive workflow
  // =========================================================================

  describe('Archive workflow', () => {
    it('should archive a published course', async () => {
      // Create and publish a course
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours a archiver' },
          slug: 'cours-a-archiver',
          level: 'beginner',
          status: 'published',
        },
      });
      const courseId = createRes.json().data.id;

      // Archive it
      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/archive`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('archived');

      // Verify in DB
      const dbCourse = await testQueryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
      expect(dbCourse.status).toBe('archived');
    });

    it('should return 400 when trying to archive a draft course', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours brouillon archive test' },
          slug: 'cours-brouillon-archive',
          level: 'beginner',
          status: 'draft',
        },
      });
      const courseId = createRes.json().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/archive`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().success).toBe(false);
    });
  });

  // =========================================================================
  // 7. Duplicate (deep copy)
  // =========================================================================

  describe('Duplicate (deep copy)', () => {
    it('should duplicate a course with all modules', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/${IDS.courses.surveillance}/duplicate`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).not.toBe(IDS.courses.surveillance);
      expect(body.data.slug).toContain('surveillance-epidemiologique-copy-');
      expect(body.data.status).toBe('draft'); // duplicates are always drafts

      // Verify modules were duplicated
      const sourceModules = await testQuery(
        'SELECT * FROM modules WHERE course_id = $1 ORDER BY sort_order',
        [IDS.courses.surveillance],
      );
      const newModules = await testQuery(
        'SELECT * FROM modules WHERE course_id = $1 ORDER BY sort_order',
        [body.data.id],
      );
      expect(newModules.length).toBe(sourceModules.length);

      // IDs should be different (deep copy, not reference)
      for (let i = 0; i < sourceModules.length; i++) {
        expect(newModules[i].id).not.toBe(sourceModules[i].id);
        expect(newModules[i].sort_order).toBe(sourceModules[i].sort_order);
      }
    });
  });

  // =========================================================================
  // Auth / permission checks
  // =========================================================================

  describe('Permission checks', () => {
    it('should return 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 403 when learner tries to create a course', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          title: { fr: 'Learner course attempt' },
          slug: 'learner-course-attempt',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(403);
    });

    it('should return 403 when learner tries to delete a course', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/${IDS.courses.surveillance}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
