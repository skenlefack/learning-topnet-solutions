// ============================================================================
// ARIS Academy — Community Routes
// Forum posts (CRUD + replies + upvote) + Study groups (CRUD + join/leave)
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query,
  queryOne,
  paginate,
  validateBody,
  multiLangTextSchema,
  paginationSchema,
} from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const postQuerySchema = z.object({
  category: z.string().optional(),
}).merge(paginationSchema);

const createPostSchema = z.object({
  title: multiLangTextSchema.optional(),
  body: multiLangTextSchema,
  category: z.string().default('general'),
  parentId: z.string().uuid().optional(),
});

const createGroupSchema = z.object({
  name: multiLangTextSchema,
  description: multiLangTextSchema.optional(),
  maxMembers: z.number().int().min(2).max(100).default(20),
  isPublic: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function communityRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // FORUM POSTS
  // =========================================================================

  // GET /community/posts — list top-level posts
  app.get('/community/posts', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const raw = validateBody(postQuerySchema, request.query);
    const page = raw.page ?? 1;
    const limit = raw.limit ?? 20;

    try {
      let sql = `
        SELECT p.*,
          u.first_name AS author_first_name,
          u.last_name AS author_last_name,
          u.avatar_url AS author_avatar
        FROM academy_core.forum_posts p
        JOIN academy_core.users u ON u.id = p.author_id
        WHERE p.parent_id IS NULL
          AND p.tenant_id = $1
      `;
      const params: unknown[] = [request.tenantId];
      let idx = 2;

      if (raw.category) {
        sql += ` AND p.category = $${idx}`;
        params.push(raw.category);
        idx++;
      }

      sql += ' ORDER BY p.is_pinned DESC, p.created_at DESC';

      const result = await paginate(sql, params, page, limit);
      return reply.send({ success: true, data: result.data, meta: result.meta });
    } catch (err: any) {
      console.warn(`[community] Posts query failed: ${err.message}`);
      return reply.send({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    }
  });

  // GET /community/posts/:id — get post with replies
  app.get<{ Params: { id: string } }>('/community/posts/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const post = await queryOne(
      `SELECT p.*,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name,
         u.avatar_url AS author_avatar
       FROM academy_core.forum_posts p
       JOIN academy_core.users u ON u.id = p.author_id
       WHERE p.id = $1`,
      [request.params.id],
    );

    if (!post) {
      return reply.code(404).send({ success: false, error: 'Post not found' });
    }

    return reply.send({ success: true, data: post });
  });

  // GET /community/posts/:id/replies
  app.get<{ Params: { id: string } }>('/community/posts/:id/replies', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const replies = await query(
      `SELECT p.*,
         u.first_name AS author_first_name,
         u.last_name AS author_last_name,
         u.avatar_url AS author_avatar
       FROM academy_core.forum_posts p
       JOIN academy_core.users u ON u.id = p.author_id
       WHERE p.parent_id = $1
       ORDER BY p.created_at ASC`,
      [request.params.id],
    );

    return reply.send({ success: true, data: replies });
  });

  // POST /community/posts — create post or reply
  app.post('/community/posts', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createPostSchema, request.body);
    const user = request.user;

    const post = await queryOne(
      `INSERT INTO academy_core.forum_posts
         (tenant_id, author_id, parent_id, category, title, body)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING *`,
      [
        user.tenantId,
        user.sub,
        body.parentId || null,
        body.category,
        body.title ? JSON.stringify(body.title) : null,
        JSON.stringify(body.body),
      ],
    );

    // Increment reply_count on parent
    if (body.parentId) {
      await query(
        'UPDATE academy_core.forum_posts SET reply_count = reply_count + 1 WHERE id = $1',
        [body.parentId],
      );
    }

    return reply.code(201).send({ success: true, data: post });
  });

  // POST /community/posts/:id/upvote
  app.post<{ Params: { id: string } }>('/community/posts/:id/upvote', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const post = await queryOne(
      `UPDATE academy_core.forum_posts
       SET upvotes = upvotes + 1
       WHERE id = $1
       RETURNING id, upvotes`,
      [request.params.id],
    );

    if (!post) {
      return reply.code(404).send({ success: false, error: 'Post not found' });
    }
    return reply.send({ success: true, data: post });
  });

  // DELETE /community/posts/:id
  app.delete<{ Params: { id: string } }>('/community/posts/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const deleted = await queryOne(
      `DELETE FROM academy_core.forum_posts
       WHERE id = $1 AND (author_id = $2 OR $3 IN ('admin_country', 'admin_rec', 'admin_continental'))
       RETURNING id, parent_id`,
      [request.params.id, user.sub, user.role],
    );

    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Post not found or unauthorized' });
    }

    // Decrement reply_count on parent
    if (deleted.parent_id) {
      await query(
        'UPDATE academy_core.forum_posts SET reply_count = GREATEST(0, reply_count - 1) WHERE id = $1',
        [deleted.parent_id],
      );
    }

    return reply.code(204).send();
  });

  // =========================================================================
  // STUDY GROUPS
  // =========================================================================

  // GET /community/groups
  app.get('/community/groups', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const raw = validateBody(paginationSchema, request.query);
    const page = raw.page ?? 1;
    const limit = raw.limit ?? 20;

    try {
      const sql = `
        SELECT g.*,
          u.first_name AS creator_first_name,
          u.last_name AS creator_last_name,
          EXISTS(
            SELECT 1 FROM academy_core.study_group_members m
            WHERE m.group_id = g.id AND m.user_id = $2
          ) AS is_member
        FROM academy_core.study_groups g
        JOIN academy_core.users u ON u.id = g.created_by
        WHERE g.tenant_id = $1
        ORDER BY g.member_count DESC, g.created_at DESC
      `;

      const result = await paginate(sql, [request.tenantId, request.user.sub], page, limit);
      return reply.send({ success: true, data: result.data, meta: result.meta });
    } catch (err: any) {
      console.warn(`[community] Groups query failed: ${err.message}`);
      return reply.send({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
    }
  });

  // POST /community/groups — create group
  app.post('/community/groups', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createGroupSchema, request.body);
    const user = request.user;

    const group = await queryOne(
      `INSERT INTO academy_core.study_groups
         (tenant_id, name, description, created_by, max_members, is_public, tags)
       VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7)
       RETURNING *`,
      [
        user.tenantId,
        JSON.stringify(body.name),
        body.description ? JSON.stringify(body.description) : null,
        user.sub,
        body.maxMembers,
        body.isPublic,
        body.tags,
      ],
    );

    // Auto-add creator as admin member
    await queryOne(
      `INSERT INTO academy_core.study_group_members (group_id, user_id, role)
       VALUES ($1, $2, 'admin')`,
      [group.id, user.sub],
    );

    return reply.code(201).send({ success: true, data: group });
  });

  // POST /community/groups/:id/join
  app.post<{ Params: { id: string } }>('/community/groups/:id/join', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user;

    // Check group exists and not full
    const group = await queryOne<any>(
      'SELECT id, member_count, max_members FROM academy_core.study_groups WHERE id = $1',
      [request.params.id],
    );
    if (!group) {
      return reply.code(404).send({ success: false, error: 'Group not found' });
    }
    if (group.member_count >= group.max_members) {
      return reply.code(400).send({ success: false, error: 'Group is full' });
    }

    await queryOne(
      `INSERT INTO academy_core.study_group_members (group_id, user_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [request.params.id, user.sub],
    );

    await query(
      'UPDATE academy_core.study_groups SET member_count = member_count + 1 WHERE id = $1',
      [request.params.id],
    );

    return reply.send({ success: true, data: { joined: true } });
  });

  // POST /community/groups/:id/leave
  app.post<{ Params: { id: string } }>('/community/groups/:id/leave', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user;

    const deleted = await queryOne(
      `DELETE FROM academy_core.study_group_members
       WHERE group_id = $1 AND user_id = $2
       RETURNING id`,
      [request.params.id, user.sub],
    );

    if (deleted) {
      await query(
        'UPDATE academy_core.study_groups SET member_count = GREATEST(1, member_count - 1) WHERE id = $1',
        [request.params.id],
      );
    }

    return reply.send({ success: true, data: { left: true } });
  });

  // DELETE /community/groups/:id
  app.delete<{ Params: { id: string } }>('/community/groups/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const user = request.user;
    const deleted = await queryOne(
      `DELETE FROM academy_core.study_groups
       WHERE id = $1 AND (created_by = $2 OR $3 IN ('admin_country', 'admin_rec', 'admin_continental'))
       RETURNING id`,
      [request.params.id, user.sub, user.role],
    );

    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Group not found or unauthorized' });
    }

    return reply.code(204).send();
  });
}
