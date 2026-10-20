// ============================================================================
// Topnet Solutions Academy — Notification Routes
// GET list, PUT mark read, PUT mark all read, GET unread count
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query,
  queryOne,
  validateBody,
  paginationSchema,
  BearerSecurity,
  PaginationQuery,
} from '@topnet-academy/shared';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const notifQuerySchema = z.object({
  unreadOnly: z.string().optional(),
}).merge(paginationSchema);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function notificationRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // GET /notifications — list user's notifications
  // =========================================================================
  app.get('/notifications', {
    schema: {
      summary: 'List user notifications',
      tags: ['Notifications'],
      security: BearerSecurity,
      querystring: {
        type: 'object' as const,
        properties: {
          unreadOnly: { type: 'string' },
          ...PaginationQuery.properties,
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    const raw = validateBody(notifQuerySchema, request.query);
    const page = raw.page ?? 1;
    const limit = raw.limit ?? 20;
    const offset = (page - 1) * limit;

    try {
      let sql = `
        SELECT * FROM academy_core.notifications
        WHERE user_id = $1
      `;
      const params: unknown[] = [user.sub];
      let idx = 2;

      if (raw.unreadOnly === 'true') {
        sql += ` AND is_read = false`;
      }

      // Get total
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*)::int AS total');
      const countRes = await queryOne<{ total: number }>(countSql, params);

      sql += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
      params.push(limit, offset);

      const notifications = await query(sql, params);

      return reply.send({
        success: true,
        data: notifications,
        meta: {
          total: countRes?.total || 0,
          page,
          limit,
          totalPages: Math.ceil((countRes?.total || 0) / limit),
        },
      });
    } catch (err: any) {
      console.warn(`[notifications] DB unavailable: ${err.message}`);
      return reply.send({
        success: true,
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      });
    }
  });

  // =========================================================================
  // GET /notifications/unread-count
  // =========================================================================
  app.get('/notifications/unread-count', {
    schema: {
      summary: 'Get unread notification count',
      tags: ['Notifications'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await queryOne<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM academy_core.notifications
         WHERE user_id = $1 AND is_read = false`,
        [request.user.sub],
      );
      return reply.send({ success: true, data: { count: result?.count || 0 } });
    } catch {
      return reply.send({ success: true, data: { count: 0 } });
    }
  });

  // =========================================================================
  // PUT /notifications/:id/read — mark single notification as read
  // =========================================================================
  app.put<{ Params: { id: string } }>('/notifications/:id/read', {
    schema: {
      summary: 'Mark notification as read',
      tags: ['Notifications'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const notif = await queryOne(
      `UPDATE academy_core.notifications
       SET is_read = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [request.params.id, request.user.sub],
    );

    if (!notif) {
      return reply.code(404).send({ success: false, error: 'Notification not found' });
    }
    return reply.send({ success: true, data: notif });
  });

  // =========================================================================
  // PUT /notifications/read-all — mark all as read
  // =========================================================================
  app.put('/notifications/read-all', {
    schema: {
      summary: 'Mark all notifications as read',
      tags: ['Notifications'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    await query(
      `UPDATE academy_core.notifications
       SET is_read = true
       WHERE user_id = $1 AND is_read = false`,
      [request.user.sub],
    );
    return reply.send({ success: true, data: { marked: true } });
  });
}
