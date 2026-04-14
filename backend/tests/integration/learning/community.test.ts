// ============================================================================
// ARIS Academy — Integration Tests: Community Routes
// Forum posts CRUD, upvote, replies, Study groups join/leave
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { authPlugin, tenantScopePlugin } from '@aris-academy/shared';
import { TOKENS } from '../../helpers/jwt';
import { IDS, seedTestData, cleanTestData } from '../../helpers/fixtures';
import { getTestPool, testQuery, testQueryOne, closeTestPool } from '../../helpers/db';

// ---------------------------------------------------------------------------
// Mocks — Kafka (no container)
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

// ---------------------------------------------------------------------------
// Import route handler (after mocks)
// ---------------------------------------------------------------------------

import communityRoutes from '../../../packages/academy-learning/src/routes/community';

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

async function buildCommunityApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: 'test-secret-key-for-vitest' });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);
  await app.register(communityRoutes);
  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Community Routes — Integration', () => {
  let app: FastifyInstance;
  const pool = getTestPool();

  beforeAll(async () => {
    await seedTestData(pool);
    app = await buildCommunityApp();
  });

  afterAll(async () => {
    await app.close();
    await cleanTestData(pool);
    await closeTestPool();
  });

  // Clean up community data between tests
  beforeEach(async () => {
    await testQuery('DELETE FROM academy_core.study_group_members');
    await testQuery('DELETE FROM academy_core.study_groups');
    await testQuery('DELETE FROM academy_core.forum_posts');
  });

  // =========================================================================
  // 1. Forum Posts — CRUD
  // =========================================================================

  describe('Forum Posts CRUD', () => {
    it('should create a post (POST /community/posts)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          title: { fr: 'Mon premier post', en: 'My first post' },
          body: { fr: 'Bonjour a tous !', en: 'Hello everyone!' },
          category: 'general',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.category).toBe('general');
      expect(body.data.author_id).toBe(IDS.users.kenyaLearner);

      // Verify in DB
      const dbPost = await testQueryOne(
        'SELECT * FROM forum_posts WHERE id = $1',
        [body.data.id],
      );
      expect(dbPost).not.toBeNull();
      expect(dbPost.category).toBe('general');
    });

    it('should list top-level posts (GET /community/posts)', async () => {
      // Create two posts
      await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          title: { fr: 'Post 1' },
          body: { fr: 'Contenu 1' },
          category: 'general',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          title: { fr: 'Post 2' },
          body: { fr: 'Contenu 2' },
          category: 'questions',
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.length).toBe(2);
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBe(2);
    });

    it('should filter posts by category', async () => {
      // Create posts in different categories
      await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'General post' }, category: 'general' },
      });
      await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'Question post' }, category: 'questions' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/community/posts?category=questions',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBe(1);
      expect(body.data[0].category).toBe('questions');
    });

    it('should get a single post by ID (GET /community/posts/:id)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          title: { fr: 'Mon post' },
          body: { fr: 'Details du post' },
          category: 'general',
        },
      });
      const postId = createRes.json().data.id;

      const res = await app.inject({
        method: 'GET',
        url: `/community/posts/${postId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.id).toBe(postId);
      expect(res.json().data.author_first_name).toBe('Learner');
    });

    it('should return 404 for non-existent post', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'GET',
        url: `/community/posts/${fakeId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it('should delete own post (DELETE /community/posts/:id)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'A supprimer' }, category: 'general' },
      });
      const postId = createRes.json().data.id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/community/posts/${postId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify deleted from DB
      const dbPost = await testQueryOne('SELECT * FROM forum_posts WHERE id = $1', [postId]);
      expect(dbPost).toBeNull();
    });

    it('admin should delete any post', async () => {
      // Learner creates a post
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'Learner post' }, category: 'general' },
      });
      const postId = createRes.json().data.id;

      // Admin deletes it
      const res = await app.inject({
        method: 'DELETE',
        url: `/community/posts/${postId}`,
        headers: { authorization: `Bearer ${TOKENS.continentalAdmin()}` },
      });

      expect(res.statusCode).toBe(204);
    });
  });

  // =========================================================================
  // 2. Forum Posts — Upvote & Replies
  // =========================================================================

  describe('Upvote & Replies', () => {
    it('should upvote a post (POST /community/posts/:id/upvote)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'Upvote me' }, category: 'general' },
      });
      const postId = createRes.json().data.id;

      const res = await app.inject({
        method: 'POST',
        url: `/community/posts/${postId}/upvote`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.upvotes).toBe(1);
    });

    it('should create a reply to a post', async () => {
      // Create parent post
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          title: { fr: 'Parent Post' },
          body: { fr: 'Parent content' },
          category: 'general',
        },
      });
      const parentId = createRes.json().data.id;

      // Create reply
      const replyRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
        payload: {
          body: { fr: 'Ma reponse' },
          parentId,
          category: 'general',
        },
      });

      expect(replyRes.statusCode).toBe(201);
      expect(replyRes.json().data.parent_id).toBe(parentId);

      // Verify reply_count incremented
      const parent = await testQueryOne('SELECT * FROM forum_posts WHERE id = $1', [parentId]);
      expect(parent.reply_count).toBe(1);
    });

    it('should list replies for a post (GET /community/posts/:id/replies)', async () => {
      // Create parent
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'Parent' }, category: 'general' },
      });
      const parentId = createRes.json().data.id;

      // Create 2 replies
      await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { body: { fr: 'Reply 1' }, parentId, category: 'general' },
      });
      await app.inject({
        method: 'POST',
        url: '/community/posts',
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
        payload: { body: { fr: 'Reply 2' }, parentId, category: 'general' },
      });

      const res = await app.inject({
        method: 'GET',
        url: `/community/posts/${parentId}/replies`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.length).toBe(2);
    });
  });

  // =========================================================================
  // 3. Study Groups — CRUD + join/leave
  // =========================================================================

  describe('Study Groups', () => {
    it('should create a group (POST /community/groups)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          name: { fr: 'Groupe Surveillance', en: 'Surveillance Group' },
          description: { fr: 'Etude ensemble' },
          maxMembers: 10,
          isPublic: true,
          tags: ['surveillance'],
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.success).toBe(true);
      expect(body.data.max_members).toBe(10);
      expect(body.data.is_public).toBe(true);

      // Creator should be auto-added as admin member
      const membership = await testQueryOne(
        'SELECT * FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [body.data.id, IDS.users.kenyaLearner],
      );
      expect(membership).not.toBeNull();
      expect(membership.role).toBe('admin');
    });

    it('should list groups (GET /community/groups)', async () => {
      // Create a group
      await app.inject({
        method: 'POST',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: {
          name: { fr: 'Groupe Test' },
          maxMembers: 5,
        },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.meta).toBeDefined();
    });

    it('should join a group (POST /community/groups/:id/join)', async () => {
      // Create group by Kenya learner
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { name: { fr: 'Groupe Join Test' }, maxMembers: 10 },
      });
      const groupId = createRes.json().data.id;

      // Nigeria learner joins
      const res = await app.inject({
        method: 'POST',
        url: `/community/groups/${groupId}/join`,
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.joined).toBe(true);

      // Verify membership
      const membership = await testQueryOne(
        'SELECT * FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, IDS.users.nigeriaLearner],
      );
      expect(membership).not.toBeNull();
    });

    it('should leave a group (POST /community/groups/:id/leave)', async () => {
      // Create and join
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { name: { fr: 'Groupe Leave Test' }, maxMembers: 10 },
      });
      const groupId = createRes.json().data.id;

      await app.inject({
        method: 'POST',
        url: `/community/groups/${groupId}/join`,
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      // Leave
      const res = await app.inject({
        method: 'POST',
        url: `/community/groups/${groupId}/leave`,
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().data.left).toBe(true);

      // Verify membership removed
      const membership = await testQueryOne(
        'SELECT * FROM study_group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, IDS.users.nigeriaLearner],
      );
      expect(membership).toBeNull();
    });

    it('should reject join when group is full', async () => {
      // Create a group with max 2 members
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { name: { fr: 'Groupe Full' }, maxMembers: 2 },
      });
      const groupId = createRes.json().data.id;

      // Update member_count to simulate full group
      await testQuery(
        'UPDATE study_groups SET member_count = 2 WHERE id = $1',
        [groupId],
      );

      // Try to join
      const res = await app.inject({
        method: 'POST',
        url: `/community/groups/${groupId}/join`,
        headers: { authorization: `Bearer ${TOKENS.nigeriaLearner()}` },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('full');
    });

    it('should delete own group (DELETE /community/groups/:id)', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/community/groups',
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
        payload: { name: { fr: 'Groupe Delete Test' }, maxMembers: 5 },
      });
      const groupId = createRes.json().data.id;

      const res = await app.inject({
        method: 'DELETE',
        url: `/community/groups/${groupId}`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(204);

      const dbGroup = await testQueryOne('SELECT * FROM study_groups WHERE id = $1', [groupId]);
      expect(dbGroup).toBeNull();
    });

    it('should return 404 for non-existent group', async () => {
      const fakeId = '00000000-0000-0000-0000-ffffffffffff';
      const res = await app.inject({
        method: 'POST',
        url: `/community/groups/${fakeId}/join`,
        headers: { authorization: `Bearer ${TOKENS.kenyaLearner()}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // =========================================================================
  // Auth checks
  // =========================================================================

  describe('Authentication', () => {
    it('should return 401 for unauthenticated posts request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/community/posts',
      });

      expect(res.statusCode).toBe(401);
    });

    it('should return 401 for unauthenticated groups request', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/community/groups',
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
