// ============================================================================
// ARIS Academy — Admin Routes
// GET  /admin/stats                          — aggregate statistics
// GET  /admin/users                          — list users (paginated, filtered)
// POST /admin/users                          — create user
// PUT  /admin/users/:id                      — update user
// POST /admin/users/bulk-import              — bulk import from CSV/JSON
// GET  /admin/tenants                        — list tenants
// GET  /admin/courses/:courseId/analytics     — course analytics
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, transaction, paginate, validateBody,
  uuidSchema, paginationSchema,
} from '@aris-academy/shared';
import crypto from 'crypto';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const userListSchema = paginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(['learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental']).optional(),
});

const createUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  role: z.enum(['learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental']),
  tenantId: uuidSchema,
  preferredLanguage: z.enum(['en', 'fr', 'ar', 'pt']).default('en'),
  isActive: z.boolean().default(true),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental']).optional(),
  tenantId: uuidSchema.optional(),
  preferredLanguage: z.enum(['en', 'fr', 'ar', 'pt']).optional(),
  isActive: z.boolean().optional(),
});

const bulkImportSchema = z.object({
  users: z.array(z.object({
    email: z.string().email(),
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    role: z.enum(['learner', 'trainer', 'admin_country', 'admin_rec', 'admin_continental']).default('learner'),
    tenant_id: uuidSchema,
    preferred_language: z.enum(['en', 'fr', 'ar', 'pt']).default('en'),
  })).min(1).max(1000),
});

// ---------------------------------------------------------------------------
// Admin preHandler — require admin role
// ---------------------------------------------------------------------------

function adminGuard(app: FastifyInstance) {
  return [
    app.authenticate,
    app.requireRole('admin_country', 'admin_rec', 'admin_continental'),
  ];
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function adminRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // GET /admin/stats — aggregate statistics (tenant-scoped)
  // -------------------------------------------------------------------------
  app.get(
    '/admin/stats',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { clause, params: filterParams } = req.tenantFilter();

        const overview = await queryOne<any>(`
          SELECT
            (SELECT COUNT(*)::int FROM academy_core.users u
              WHERE ${clause.replace('tenant_id', 'u.tenant_id')}) AS total_users,
            (SELECT COUNT(*)::int FROM academy_core.enrollments en
              JOIN academy_core.users u ON u.id = en.user_id
              WHERE ${clause.replace('tenant_id', 'u.tenant_id')}) AS total_enrollments,
            (SELECT COUNT(*)::int FROM academy_core.enrollments en
              JOIN academy_core.users u ON u.id = en.user_id
              WHERE en.status = 'completed'
                AND ${clause.replace('tenant_id', 'u.tenant_id')}) AS completed_enrollments,
            (SELECT COUNT(*)::int FROM academy_core.certifications cert
              JOIN academy_core.users u ON u.id = cert.user_id
              WHERE cert.status = 'issued'
                AND ${clause.replace('tenant_id', 'u.tenant_id')}) AS total_certifications,
            (SELECT COUNT(*)::int FROM academy_core.courses
              WHERE status = 'published') AS total_courses,
            (SELECT COUNT(*)::int FROM academy_core.live_sessions
              WHERE status = 'scheduled' AND scheduled_at > NOW()) AS upcoming_sessions
        `, filterParams);

        const completionRate = overview && overview.total_enrollments > 0
          ? Math.round(overview.completed_enrollments / overview.total_enrollments * 10000) / 100
          : 0;

        return reply.send({
          success: true,
          data: { ...overview, completionRate },
        });
      } catch (err: any) {
        app.log.warn(`[admin] Stats error: ${err.message}`);
        return reply.send({
          success: true,
          data: {
            total_users: 0, total_enrollments: 0, completed_enrollments: 0,
            total_certifications: 0, total_courses: 0, upcoming_sessions: 0,
            completionRate: 0,
          },
        });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/users — list users (paginated, search, role filter)
  // -------------------------------------------------------------------------
  app.get(
    '/admin/users',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { page, limit, search, role } = validateBody(userListSchema, req.query);
      const { clause, params: filterParams } = req.tenantFilter();

      const conditions = [clause.replace('tenant_id', 'u.tenant_id')];
      const params = [...filterParams];

      if (role) {
        params.push(role);
        conditions.push(`u.role = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        conditions.push(`(u.email ILIKE $${params.length} OR u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length})`);
      }

      const where = conditions.join(' AND ');
      const baseQuery = `
        SELECT u.id, u.email, u.first_name, u.last_name, u.role,
               u.tenant_id, u.preferred_language, u.is_active,
               u.avatar_url, u.created_at,
               t.name AS tenant_name, t.code AS tenant_code
        FROM academy_core.users u
        LEFT JOIN academy_core.tenants t ON t.id = u.tenant_id
        WHERE ${where}
        ORDER BY u.created_at DESC
      `;

      const result = await paginate<any>(baseQuery, params, page, limit);
      return reply.send({ success: true, ...result });
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/users — create a single user
  // -------------------------------------------------------------------------
  app.post(
    '/admin/users',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const data = validateBody(createUserSchema, req.body);

      // Check email uniqueness
      const existing = await queryOne<any>(
        `SELECT id FROM academy_core.users WHERE email = $1`,
        [data.email.toLowerCase()],
      );
      if (existing) {
        return reply.code(409).send({ success: false, error: 'Email already exists' });
      }

      // Generate a temporary password hash (user will reset via SSO/email)
      const tempPassword = crypto.randomBytes(16).toString('hex');

      const user = await queryOne<any>(`
        INSERT INTO academy_core.users
          (email, first_name, last_name, role, tenant_id, preferred_language, is_active, password_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, email, first_name, last_name, role, tenant_id, preferred_language, is_active, created_at
      `, [
        data.email.toLowerCase(),
        data.firstName,
        data.lastName,
        data.role,
        data.tenantId,
        data.preferredLanguage,
        data.isActive,
        tempPassword,
      ]);

      return reply.code(201).send({ success: true, data: user });
    },
  );

  // -------------------------------------------------------------------------
  // PUT /admin/users/:id — update user
  // -------------------------------------------------------------------------
  app.put(
    '/admin/users/:id',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const data = validateBody(updateUserSchema, req.body);
      const userId = req.params.id;

      // Build dynamic SET clause
      const sets: string[] = [];
      const params: any[] = [];

      if (data.firstName !== undefined) { params.push(data.firstName); sets.push(`first_name = $${params.length}`); }
      if (data.lastName !== undefined) { params.push(data.lastName); sets.push(`last_name = $${params.length}`); }
      if (data.role !== undefined) { params.push(data.role); sets.push(`role = $${params.length}`); }
      if (data.tenantId !== undefined) { params.push(data.tenantId); sets.push(`tenant_id = $${params.length}`); }
      if (data.preferredLanguage !== undefined) { params.push(data.preferredLanguage); sets.push(`preferred_language = $${params.length}`); }
      if (data.isActive !== undefined) { params.push(data.isActive); sets.push(`is_active = $${params.length}`); }

      if (sets.length === 0) {
        return reply.code(400).send({ success: false, error: 'No fields to update' });
      }

      sets.push('updated_at = NOW()');
      params.push(userId);

      const user = await queryOne<any>(`
        UPDATE academy_core.users
        SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, email, first_name, last_name, role, tenant_id, preferred_language, is_active, updated_at
      `, params);

      if (!user) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }

      return reply.send({ success: true, data: user });
    },
  );

  // -------------------------------------------------------------------------
  // POST /admin/users/bulk-import — bulk create users from CSV/JSON
  // -------------------------------------------------------------------------
  app.post(
    '/admin/users/bulk-import',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { users } = validateBody(bulkImportSchema, req.body);

      let imported = 0;
      let failed = 0;
      const errors: Array<{ row: number; email: string; error: string }> = [];

      await transaction(async (client) => {
        await client.query('SET search_path TO academy_core, public');

        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          try {
            await client.query(`
              INSERT INTO academy_core.users
                (email, first_name, last_name, role, tenant_id, preferred_language, is_active, password_hash)
              VALUES ($1, $2, $3, $4, $5, $6, true, $7)
              ON CONFLICT (email) DO NOTHING
            `, [
              u.email.toLowerCase(),
              u.first_name,
              u.last_name,
              u.role,
              u.tenant_id,
              u.preferred_language,
              crypto.randomBytes(16).toString('hex'),
            ]);
            imported++;
          } catch (err: any) {
            failed++;
            errors.push({ row: i + 1, email: u.email, error: err.message });
          }
        }
      });

      return reply.send({
        success: true,
        data: { imported, failed, total: users.length, errors: errors.slice(0, 50) },
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/tenants — list all tenants (hierarchical)
  // -------------------------------------------------------------------------
  app.get(
    '/admin/tenants',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const { clause, params: filterParams } = req.tenantFilter();

      const tenants = await query<any>(`
        SELECT t.id, t.name, t.code, t.level, t.parent_id, t.logo_url, t.config,
               p.name AS parent_name, p.code AS parent_code,
               (SELECT COUNT(*)::int FROM academy_core.users u WHERE u.tenant_id = t.id) AS user_count
        FROM academy_core.tenants t
        LEFT JOIN academy_core.tenants p ON p.id = t.parent_id
        WHERE ${clause.replace('tenant_id', 't.id')}
        ORDER BY t.level, t.name
      `, filterParams);

      return reply.send({ success: true, data: tenants });
    },
  );

  // -------------------------------------------------------------------------
  // GET /admin/courses/:courseId/analytics — course-level analytics
  // -------------------------------------------------------------------------
  app.get(
    '/admin/courses/:courseId/analytics',
    { preHandler: adminGuard(app) },
    async (req: FastifyRequest<{ Params: { courseId: string } }>, reply: FastifyReply) => {
      const { courseId } = req.params;

      try {
        // Enrollment funnel
        const funnel = await query<any>(`
          SELECT
            COUNT(*)::int AS enrolled,
            COUNT(*) FILTER (WHERE progress_percent > 0)::int AS in_progress,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE id IN (
              SELECT enrollment_id FROM academy_core.certifications
              WHERE course_id = $1 AND status = 'issued'
            ))::int AS certified
          FROM academy_core.enrollments
          WHERE course_id = $1
        `, [courseId]);

        const f = funnel[0] || { enrolled: 0, in_progress: 0, completed: 0, certified: 0 };

        // Score distribution
        const scores = await query<any>(`
          SELECT
            CASE
              WHEN a.score BETWEEN 0 AND 20 THEN '0-20'
              WHEN a.score BETWEEN 21 AND 40 THEN '21-40'
              WHEN a.score BETWEEN 41 AND 60 THEN '41-60'
              WHEN a.score BETWEEN 61 AND 80 THEN '61-80'
              WHEN a.score BETWEEN 81 AND 100 THEN '81-100'
            END AS range,
            COUNT(*)::int AS count
          FROM academy_core.assessment_attempts a
          JOIN academy_core.assessments asmt ON asmt.id = a.assessment_id
          WHERE asmt.course_id = $1 AND a.status = 'graded'
          GROUP BY range
          ORDER BY range
        `, [courseId]);

        // Module completion rates
        const moduleCompletion = await query<any>(`
          SELECT
            m.title->>'en' AS name,
            m.sort_order,
            COUNT(DISTINCT pt.user_id)::int AS completed_users,
            (SELECT COUNT(DISTINCT e.user_id)::int
             FROM academy_core.enrollments e WHERE e.course_id = $1) AS total_users
          FROM academy_core.modules m
          LEFT JOIN academy_core.lessons l ON l.module_id = m.id
          LEFT JOIN academy_core.progress_tracking pt ON pt.lesson_id = l.id AND pt.is_completed = true
          WHERE m.course_id = $1
          GROUP BY m.id, m.title, m.sort_order
          ORDER BY m.sort_order
        `, [courseId]);

        // Summary
        const avgScore = await queryOne<any>(`
          SELECT
            ROUND(AVG(a.score)::numeric, 1) AS avg_score,
            ROUND(AVG(
              EXTRACT(EPOCH FROM (e.completed_at - e.started_at)) / 86400
            )::numeric, 0) AS avg_completion_days
          FROM academy_core.enrollments e
          LEFT JOIN academy_core.assessment_attempts a
            ON a.enrollment_id = e.id AND a.status = 'graded'
          WHERE e.course_id = $1 AND e.status = 'completed'
        `, [courseId]);

        const certRate = f.enrolled > 0 ? Math.round(f.certified / f.enrolled * 100) : 0;

        return reply.send({
          success: true,
          data: {
            funnel: [
              { name: 'Enrolled', value: f.enrolled },
              { name: 'In Progress', value: f.in_progress },
              { name: 'Completed', value: f.completed },
              { name: 'Certified', value: f.certified },
            ],
            scoreDistribution: scores,
            moduleCompletion: moduleCompletion.map((mc: any) => ({
              name: mc.name || `Module ${mc.sort_order}`,
              rate: mc.total_users > 0 ? Math.round(mc.completed_users / mc.total_users * 100) : 0,
            })),
            summary: {
              totalEnrolled: f.enrolled,
              avgScore: avgScore?.avg_score ?? 0,
              avgCompletionDays: avgScore?.avg_completion_days ?? 0,
              certificationRate: certRate,
            },
          },
        });
      } catch (err: any) {
        app.log.warn(`[admin] Course analytics error: ${err.message}`);
        return reply.code(500).send({ success: false, error: 'Failed to load analytics' });
      }
    },
  );
}
