// ============================================================================
// ARIS Academy — Dashboard Routes
// GET /dashboard                        — learner personal dashboard
// GET /dashboard/leaderboard            — ranked learners (Redis sorted sets)
// GET /dashboard/stats                  — admin aggregate stats
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, getRedis, isRedisAvailable, validateBody, uuidSchema,
} from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const leaderboardQuerySchema = z.object({
  tenantId: uuidSchema,
  period: z.enum(['week', 'month', 'all']).default('month'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const statsQuerySchema = z.object({
  tenantId: uuidSchema,
});

// ---------------------------------------------------------------------------
// Mock data (returned when DB is unavailable)
// ---------------------------------------------------------------------------

const MOCK_DASHBOARD = {
  enrollments: [
    {
      id: 'mock-enroll-1',
      status: 'active',
      progress_percent: 45,
      current_level: 'beginner',
      started_at: '2026-01-15T00:00:00Z',
      title: { fr: 'Introduction à ARIS 3.0', en: 'Introduction to ARIS 3.0' },
      slug: 'intro-aris-3',
      level: 'beginner',
      thumbnail_url: null,
      estimated_hours: 12,
      course_id: 'mock-course-1',
    },
    {
      id: 'mock-enroll-2',
      status: 'active',
      progress_percent: 20,
      current_level: 'beginner',
      started_at: '2026-02-01T00:00:00Z',
      title: { fr: 'Surveillance épidémiologique', en: 'Epidemiological Surveillance' },
      slug: 'epidemiological-surveillance',
      level: 'beginner',
      thumbnail_url: null,
      estimated_hours: 8,
      course_id: 'mock-course-2',
    },
    {
      id: 'mock-enroll-3',
      status: 'completed',
      progress_percent: 100,
      current_level: 'beginner',
      started_at: '2025-11-01T00:00:00Z',
      title: { fr: 'Santé animale de base', en: 'Basic Animal Health' },
      slug: 'basic-animal-health',
      level: 'beginner',
      thumbnail_url: null,
      estimated_hours: 6,
      course_id: 'mock-course-3',
    },
  ],
  stats: {
    coursesEnrolled: 3,
    coursesAvailable: 6,
    certificationsEarned: 1,
    countriesConnected: 12,
    totalHoursLearned: 42,
    currentStreak: 5,
  },
  recentActivity: [
    {
      lesson_id: 'mock-lesson-1',
      is_completed: true,
      score: 85,
      updated_at: new Date().toISOString(),
      lesson_title: { fr: 'Module 1: Concepts fondamentaux' },
      lesson_type: 'video',
      course_title: { fr: 'Introduction à ARIS 3.0' },
      course_slug: 'intro-aris-3',
    },
  ],
  currentEnrollment: {
    courseTitle: { fr: 'Introduction à ARIS 3.0', en: 'Introduction to ARIS 3.0' },
    progress: 45,
    level: 'beginner',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function periodKey(period: string): string {
  const now = new Date();
  if (period === 'week') {
    return `week:${now.getFullYear()}-W${String(getWeekNumber(now)).padStart(2, '0')}`;
  }
  if (period === 'month') {
    return `month:${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  return 'all';
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function dashboardRoutes(app: FastifyInstance) {

  // -------------------------------------------------------------------------
  // GET /dashboard — personal learner dashboard
  // -------------------------------------------------------------------------
  app.get(
    '/dashboard',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = req.user.sub;

      try {
        // All queries are independent → run in parallel
        const [
          enrollments,
          certifications,
          hoursRow,
          recentActivity,
          coursesCountRow,
          countriesRow,
        ] = await Promise.all([
          // Active enrollments with course info
          query(`
            SELECT e.id, e.course_id, e.status, e.progress_percent, e.current_level, e.started_at,
                   c.title, c.slug, c.level, c.thumbnail_url, c.estimated_hours
            FROM academy_core.enrollments e
            JOIN academy_core.courses c ON c.id = e.course_id
            WHERE e.user_id = $1
            ORDER BY e.updated_at DESC
          `, [userId]),

          // Issued certifications
          query(`
            SELECT cert.id, cert.level, cert.certificate_number, cert.issued_at,
                   c.title, c.slug
            FROM academy_core.certifications cert
            JOIN academy_core.courses c ON c.id = cert.course_id
            WHERE cert.user_id = $1 AND cert.status = 'issued'
            ORDER BY cert.issued_at DESC
          `, [userId]),

          // Total learning hours
          queryOne<any>(`
            SELECT COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds
            FROM academy_core.progress_tracking
            WHERE user_id = $1
          `, [userId]),

          // Last 20 activity items
          query(`
            SELECT pt.lesson_id, pt.is_completed, pt.score, pt.updated_at,
                   l.title AS lesson_title, l.type AS lesson_type,
                   c.title AS course_title, c.slug AS course_slug
            FROM academy_core.progress_tracking pt
            JOIN academy_core.lessons l ON l.id = pt.lesson_id
            JOIN academy_core.modules m ON m.id = l.module_id
            JOIN academy_core.courses c ON c.id = m.course_id
            WHERE pt.user_id = $1
            ORDER BY pt.updated_at DESC
            LIMIT 20
          `, [userId]),

          // Total available courses
          queryOne<any>(`
            SELECT COUNT(*)::int AS count
            FROM academy_core.courses
            WHERE status = 'published'
          `),

          // Countries connected
          queryOne<any>(`
            SELECT COUNT(DISTINCT t.id)::int AS count
            FROM academy_core.tenants t
            WHERE t.level = 'country'
          `),
        ]);

        // Streak from Redis (best-effort)
        let currentStreak = 0;
        if (isRedisAvailable()) {
          try {
            const streakData = await getRedis().hgetall(`streak:${userId}`);
            currentStreak = parseInt(streakData?.current_streak || '0', 10);
          } catch {
            // Redis unavailable — streak = 0
          }
        }

        const totalHours = Math.round((hoursRow?.total_seconds ?? 0) / 3600 * 10) / 10;
        const completedCourses = enrollments.filter((e: any) => e.status === 'completed').length;
        const activeEnrollment = enrollments.find((e: any) => e.status === 'active') || enrollments[0];

        return reply.send({
          success: true,
          data: {
            enrollments,
            stats: {
              coursesEnrolled: enrollments.filter((e: any) => e.status === 'active').length,
              coursesAvailable: coursesCountRow?.count ?? 0,
              certificationsEarned: certifications.length,
              countriesConnected: countriesRow?.count ?? 1,
              totalHoursLearned: totalHours,
              currentStreak,
            },
            recentActivity,
            currentEnrollment: activeEnrollment ? {
              courseTitle: activeEnrollment.title,
              progress: activeEnrollment.progress_percent,
              level: activeEnrollment.level,
            } : null,
          },
        });
      } catch (err: any) {
        console.warn(`[academy-learning] DB unavailable, returning mock data: ${err.message}`);
        return reply.send({
          success: true,
          data: MOCK_DASHBOARD,
        });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /dashboard/leaderboard — ranked learners from Redis sorted set
  // -------------------------------------------------------------------------
  app.get(
    '/dashboard/leaderboard',
    { preHandler: [app.authenticate] },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const { tenantId, period = 'month', page = 1, limit = 20 } = validateBody(leaderboardQuerySchema, req.query);

        if (!isRedisAvailable()) {
          return reply.send({ success: true, data: [], meta: { total: 0, page, limit, totalPages: 0 } });
        }

        const redis = getRedis();
        const redisKey = `leaderboard:${tenantId}:${periodKey(period)}`;
        const start = (page - 1) * limit;
        const stop = start + limit - 1;

        const entries = await redis.zrevrange(redisKey, start, stop, 'WITHSCORES');
        const ranked: Array<{ userId: string; score: number; rank: number }> = [];
        for (let i = 0; i < entries.length; i += 2) {
          ranked.push({
            userId: entries[i],
            score: parseInt(entries[i + 1], 10),
            rank: start + i / 2 + 1,
          });
        }

        if (ranked.length > 0) {
          const userIds = ranked.map((r) => r.userId);
          const users = await query<any>(
            `SELECT id, first_name, last_name, avatar_url, tenant_id
             FROM academy_core.users WHERE id = ANY($1)`,
            [userIds],
          );
          const userMap = new Map(users.map((u: any) => [u.id, u]));
          for (const entry of ranked) {
            const u = userMap.get(entry.userId);
            if (u) Object.assign(entry, {
              firstName: u.first_name,
              lastName: u.last_name,
              avatarUrl: u.avatar_url,
              tenantId: u.tenant_id,
            });
          }
        }

        const total = await redis.zcard(redisKey);
        return reply.send({
          success: true,
          data: ranked,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
        });
      } catch (err: any) {
        console.warn(`[academy-learning] Leaderboard unavailable: ${err.message}`);
        return reply.send({ success: true, data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
      }
    },
  );

  // -------------------------------------------------------------------------
  // GET /dashboard/stats — admin aggregate statistics
  // -------------------------------------------------------------------------
  app.get(
    '/dashboard/stats',
    {
      preHandler: [
        app.authenticate,
        app.requireRole('admin_country', 'admin_rec', 'admin_continental'),
      ],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = validateBody(statsQuerySchema, req.query);
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
                AND ${clause.replace('tenant_id', 'u.tenant_id')}) AS total_certifications
        `, filterParams);

        const completionRate = overview && overview.total_enrollments > 0
          ? Math.round(overview.completed_enrollments / overview.total_enrollments * 10000) / 100
          : 0;

        const byCountry = await query<any>(`
          SELECT
            t.id AS tenant_id, t.name AS tenant_name, t.code AS tenant_code,
            COUNT(DISTINCT u.id)::int AS users,
            COUNT(DISTINCT e.id)::int AS enrollments,
            COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed')::int AS completed,
            ROUND(AVG(e.progress_percent)::numeric, 1) AS avg_progress
          FROM academy_core.tenants t
          LEFT JOIN academy_core.users u ON u.tenant_id = t.id
          LEFT JOIN academy_core.enrollments e ON e.user_id = u.id
          WHERE t.level = 'country'
            AND ${clause.replace('tenant_id', 't.id')}
          GROUP BY t.id, t.name, t.code
          ORDER BY enrollments DESC
        `, filterParams);

        const byLevel = await query<any>(`
          SELECT
            c.level,
            COUNT(DISTINCT e.id)::int AS enrollments,
            COUNT(DISTINCT e.id) FILTER (WHERE e.status = 'completed')::int AS completed,
            ROUND(AVG(e.progress_percent)::numeric, 1) AS avg_progress
          FROM academy_core.enrollments e
          JOIN academy_core.courses c ON c.id = e.course_id
          JOIN academy_core.users u ON u.id = e.user_id
          WHERE ${clause.replace('tenant_id', 'u.tenant_id')}
          GROUP BY c.level
          ORDER BY ARRAY_POSITION(ARRAY['beginner','intermediate','advanced','expert'], c.level::text)
        `, filterParams);

        return reply.send({
          success: true,
          data: { overview: { ...overview, completionRate }, byCountry, byLevel },
        });
      } catch (err: any) {
        console.warn(`[academy-learning] Admin stats unavailable: ${err.message}`);
        return reply.send({
          success: true,
          data: {
            overview: { total_users: 0, total_enrollments: 0, completed_enrollments: 0, total_certifications: 0, completionRate: 0 },
            byCountry: [],
            byLevel: [],
          },
        });
      }
    },
  );
}
