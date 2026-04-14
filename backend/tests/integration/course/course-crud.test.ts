// ============================================================================
// ARIS Academy — Integration Tests: Course CRUD Operations
// Tests real PostgreSQL via Testcontainers, mocks Kafka + MinIO
// Covers: CRUD, tenant isolation, publishing workflow
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@aris-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container), course-resolver, MinIO
// ---------------------------------------------------------------------------

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

vi.mock('@aris-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aris-academy/shared')>();
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
  initBuckets: vi.fn().mockResolvedValue(undefined),
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

describe('Course CRUD — Integration (Testcontainers)', () => {
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
  // 1. CREATE
  // =========================================================================

  describe('POST / — Create course', () => {
    it('should create a draft course with all fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Nouveau cours de test', en: 'New test course' },
          description: { fr: 'Description FR', en: 'Description EN' },
          slug: 'nouveau-cours-crud-test',
          level: 'beginner',
          status: 'draft',
          estimatedHours: 15,
          passingScore: 75,
          tags: ['crud', 'test'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.slug).toBe('nouveau-cours-crud-test');
      expect(body.data.status).toBe('draft');
      expect(body.data.passing_score).toBe(75);
      expect(body.data.estimated_hours).toBe(15);
      expect(body.data.tags).toEqual(['crud', 'test']);
      expect(body.data.published_at).toBeNull();

      // Verify persisted in DB
      const dbRow = await testQueryOne(
        'SELECT * FROM courses WHERE slug = $1',
        ['nouveau-cours-crud-test'],
      );
      expect(dbRow).not.toBeNull();
      expect(dbRow.level).toBe('beginner');
      expect(dbRow.tenant_id).toBe(IDS.tenants.continental);
      expect(dbRow.tenant_level).toBe('continental');
    });

    it('should create a published course with published_at set', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours publie direct' },
          slug: 'cours-publie-direct',
          level: 'intermediate',
          status: 'published',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.data.status).toBe('published');
      expect(body.data.published_at).not.toBeNull();
    });

    it('should reject invalid slug format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Bad slug' },
          slug: 'Invalid Slug With Spaces!',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should require at least one language in title', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: {},
          slug: 'empty-title-test',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('trainer can create courses', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.trainer()}` },
        payload: {
          title: { en: 'Trainer Course' },
          slug: 'trainer-created-course',
          level: 'beginner',
        },
      });

      expect(res.statusCode).toBe(201);
    });
  });

  // =========================================================================
  // 2. READ
  // =========================================================================

  describe('GET /:id — Read single course', () => {
    it('should return the course with its modules', async () => {
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
      expect(Array.isArray(body.data.modules)).toBe(true);
      expect(body.data.modules.length).toBe(8); // 8 seeded modules
    });

    it('should return 404 for non-existent UUID', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'GET',
        url: `/${fakeId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().success).toBe(false);
      expect(res.json().error).toContain('not found');
    });

    it('should reject invalid UUID format', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/not-a-uuid',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // =========================================================================
  // 3. UPDATE
  // =========================================================================

  describe('PUT /:id — Update course', () => {
    it('should update individual fields without overwriting others', async () => {
      // Create a course
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours original', en: 'Original Course' },
          slug: 'cours-update-partial',
          level: 'beginner',
          passingScore: 70,
          tags: ['original'],
        },
      });
      const courseId = createRes.json().data.id;

      // Update only level and tags
      const res = await app.inject({
        method: 'PUT',
        url: `/${courseId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          level: 'advanced',
          tags: ['updated', 'partial'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.level).toBe('advanced');
      expect(body.data.tags).toEqual(['updated', 'partial']);
      // Original passing_score should be preserved
      expect(body.data.passing_score).toBe(70);
    });

    it('should return 404 when updating non-existent course', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'PUT',
        url: `/${fakeId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: { level: 'advanced' },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // 4. DELETE
  // =========================================================================

  describe('DELETE /:id — Delete course', () => {
    it('should delete and return 204', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'A supprimer' },
          slug: 'cours-delete-test',
          level: 'beginner',
        },
      });
      const courseId = createRes.json().data.id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/${courseId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify removed from DB
      const dbRow = await testQueryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
      expect(dbRow).toBeNull();
    });

    it('country admin should NOT be able to delete (requires admin_rec or admin_continental)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/${IDS.courses.surveillance}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // =========================================================================
  // 5. Tenant isolation
  // =========================================================================

  describe('Multi-tenant isolation', () => {
    it('continental admin sees all courses (continental tenant_level)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(6);
    });

    it('Kenya admin sees continental courses + own tenant courses', async () => {
      // Create a Kenya course
      await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
        payload: {
          title: { en: 'Kenya Local Course' },
          slug: 'kenya-local-isolation',
          level: 'beginner',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // Should see continental courses + Kenya course
      expect(body.data.length).toBeGreaterThanOrEqual(7);
      const kenyaCourse = body.data.find((c: any) => c.slug === 'kenya-local-isolation');
      expect(kenyaCourse).toBeDefined();
    });

    it('Nigeria admin does NOT see Kenya-only courses', async () => {
      // Create a Kenya course
      await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaAdmin()}` },
        payload: {
          title: { en: 'Kenya Secret Course' },
          slug: 'kenya-secret-isolation',
          level: 'beginner',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.nigeriaAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const kenyaCourse = body.data.find((c: any) => c.slug === 'kenya-secret-isolation');
      expect(kenyaCourse).toBeUndefined();
    });

    it('learner only sees own tenant + continental courses', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      // All seeded courses are continental, so learner should see them
      expect(body.data.length).toBeGreaterThanOrEqual(6);
    });
  });

  // =========================================================================
  // 6. Publishing workflow
  // =========================================================================

  describe('Publishing workflow', () => {
    it('should publish a draft course (POST /:id/publish)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours brouillon a publier' },
          slug: 'cours-publish-workflow',
          level: 'beginner',
          status: 'draft',
        },
      });
      const courseId = createRes.json().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/publish`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('published');
      expect(res.json().data.published_at).not.toBeNull();
    });

    it('should reject publishing an already published course', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/${IDS.courses.surveillance}/publish`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(400);
    });

    it('should archive a published course (POST /:id/archive)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Cours a archiver' },
          slug: 'cours-archive-workflow',
          level: 'beginner',
          status: 'published',
        },
      });
      const courseId = createRes.json().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/${courseId}/archive`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.status).toBe('archived');
    });

    it('should reject archiving a draft course', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Draft no archive' },
          slug: 'draft-no-archive',
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
    });

    it('full lifecycle: draft -> published -> archived', async () => {
      // 1. Create draft
      const createRes = await app.inject({
        method: 'POST',
        url: '/',
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
        payload: {
          title: { fr: 'Lifecycle test' },
          slug: 'lifecycle-test',
          level: 'beginner',
          status: 'draft',
        },
      });
      const courseId = createRes.json().data.id;
      expect(createRes.json().data.status).toBe('draft');

      // 2. Publish
      const publishRes = await app.inject({
        method: 'POST',
        url: `/${courseId}/publish`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });
      expect(publishRes.json().data.status).toBe('published');

      // 3. Archive
      const archiveRes = await app.inject({
        method: 'POST',
        url: `/${courseId}/archive`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });
      expect(archiveRes.json().data.status).toBe('archived');

      // 4. Verify final state in DB
      const dbRow = await testQueryOne('SELECT * FROM courses WHERE id = $1', [courseId]);
      expect(dbRow.status).toBe('archived');
      expect(dbRow.published_at).not.toBeNull();
    });
  });
});
