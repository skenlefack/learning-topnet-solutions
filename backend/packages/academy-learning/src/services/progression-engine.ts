// ============================================================================
// Topnet Solutions Academy — Progression Engine
// Core logic: recalculate progress, level unlock, certification, leaderboard
// ============================================================================
import {
  query, queryOne, publishEvent, TOPICS,
  cacheDel, getRedis,
} from '@topnet-academy/shared';
import type { CourseLevel } from '@topnet-academy/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEVEL_ORDER: CourseLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

const PASSING_SCORES: Record<CourseLevel, number> = {
  beginner: 70,
  intermediate: 75,
  advanced: 80,
  expert: 85,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getNextLevel(current: string): CourseLevel | null {
  const idx = LEVEL_ORDER.indexOf(current as CourseLevel);
  return idx >= 0 && idx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[idx + 1] : null;
}

export function getPassingScore(level: string): number {
  return PASSING_SCORES[level as CourseLevel] ?? 70;
}

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

// ---------------------------------------------------------------------------
// recalculateProgress
// ---------------------------------------------------------------------------

export async function recalculateProgress(enrollmentId: string) {
  const result = await queryOne<any>(`
    WITH stats AS (
      SELECT
        e.id, e.user_id, e.course_id,
        (SELECT COUNT(*) FROM academy_core.lessons l
          JOIN academy_core.modules m ON m.id = l.module_id
          WHERE m.course_id = e.course_id AND l.is_required = true) AS total_required,
        (SELECT COUNT(*) FROM academy_core.progress_tracking pt
          JOIN academy_core.lessons l ON l.id = pt.lesson_id
          JOIN academy_core.modules m ON m.id = l.module_id
          WHERE pt.enrollment_id = e.id AND pt.is_completed = true
            AND l.is_required = true) AS completed_required
      FROM academy_core.enrollments e WHERE e.id = $1
    )
    UPDATE academy_core.enrollments SET
      progress_percent = CASE
        WHEN (SELECT total_required FROM stats) > 0
        THEN ROUND(
          (SELECT completed_required FROM stats)::numeric
          / (SELECT total_required FROM stats)::numeric * 100, 2)
        ELSE 0 END,
      status = CASE
        WHEN (SELECT completed_required FROM stats) >= (SELECT total_required FROM stats)
          AND (SELECT total_required FROM stats) > 0
        THEN 'completed' ELSE status END,
      completed_at = CASE
        WHEN (SELECT completed_required FROM stats) >= (SELECT total_required FROM stats)
          AND (SELECT total_required FROM stats) > 0
          AND completed_at IS NULL
        THEN NOW() ELSE completed_at END,
      updated_at = NOW()
    WHERE id = $1 RETURNING *
  `, [enrollmentId]);

  if (result) {
    await cacheDel(`enrollments:${result.user_id}:*`);

    // Enrollment completed → trigger level unlock check
    if (result.status === 'completed') {
      await checkLevelUnlock(result.user_id, result.course_id);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// checkLevelUnlock
// ---------------------------------------------------------------------------

export async function checkLevelUnlock(
  userId: string,
  courseId: string,
): Promise<void> {
  // 1. Get course details
  const course = await queryOne<any>(
    'SELECT id, level, tenant_id FROM academy_core.courses WHERE id = $1',
    [courseId],
  );
  if (!course) return;

  const requiredScore = getPassingScore(course.level);

  // 2. Verify ALL required modules are 100 % complete (every required lesson done)
  const moduleCheck = await queryOne<any>(`
    SELECT
      (SELECT COUNT(*) FROM academy_core.modules m
        WHERE m.course_id = $1 AND m.is_required = true) AS total_modules,
      (SELECT COUNT(DISTINCT m.id) FROM academy_core.modules m
        WHERE m.course_id = $1 AND m.is_required = true
        AND NOT EXISTS (
          SELECT 1 FROM academy_core.lessons l
          WHERE l.module_id = m.id AND l.is_required = true
          AND NOT EXISTS (
            SELECT 1 FROM academy_core.progress_tracking pt
            WHERE pt.user_id = $2 AND pt.lesson_id = l.id AND pt.is_completed = true
          )
        )) AS completed_modules
  `, [courseId, userId]);

  if (!moduleCheck
    || moduleCheck.total_modules === 0
    || parseInt(moduleCheck.completed_modules) < parseInt(moduleCheck.total_modules)) {
    return;
  }

  // 3. Verify final assessment passed with the level's minimum score
  const finalAssessment = await queryOne<any>(`
    SELECT aa.score, aa.passed
    FROM academy_core.assessment_attempts aa
    JOIN academy_core.assessments a ON a.id = aa.assessment_id
    WHERE a.course_id = $1 AND a.is_final = true AND aa.user_id = $2
    ORDER BY aa.score DESC NULLS LAST
    LIMIT 1
  `, [courseId, userId]);

  if (!finalAssessment
    || !finalAssessment.passed
    || (parseFloat(finalAssessment.score) ?? 0) < requiredScore) {
    return;
  }

  // 4. Expert level: at least 1 live session attended
  if (course.level === 'expert') {
    const liveCheck = await queryOne<any>(`
      SELECT COUNT(*)::int AS attended
      FROM academy_core.live_attendance la
      JOIN academy_core.live_sessions ls ON ls.id = la.session_id
      WHERE la.user_id = $1 AND ls.course_id = $2
    `, [userId, courseId]);

    if (!liveCheck || liveCheck.attended === 0) return;
  }

  // 5. All checks passed — issue certification (idempotent)
  const existingCert = await queryOne<any>(
    `SELECT id FROM academy_core.certifications
     WHERE user_id = $1 AND course_id = $2 AND level = $3 AND status = 'issued'`,
    [userId, courseId, course.level],
  );
  if (existingCert) return;

  const certNumber = `ARIS-${course.level.toUpperCase().slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

  const cert = await queryOne<any>(`
    INSERT INTO academy_core.certifications
      (user_id, course_id, level, status, certificate_number, issued_at)
    VALUES ($1, $2, $3, 'issued', $4, NOW())
    RETURNING *
  `, [userId, courseId, course.level, certNumber]);

  if (cert) {
    await publishEvent(TOPICS.CERTIFICATION_ISSUED, cert, course.tenant_id, userId);
    console.log(
      `[ProgressionEngine] Certification ${certNumber} issued — user=${userId} level=${course.level}`,
    );
  }
}

// ---------------------------------------------------------------------------
// getNextCourse
// ---------------------------------------------------------------------------

export async function getNextCourse(
  userId: string,
  currentCourseId: string,
) {
  const current = await queryOne<any>(
    'SELECT level FROM academy_core.courses WHERE id = $1',
    [currentCourseId],
  );
  if (!current) return null;

  const nextLevel = getNextLevel(current.level);
  if (!nextLevel) return null;

  // Next-level published courses that require the current course
  const candidates = await query<any>(`
    SELECT c.id, c.title, c.slug, c.level, c.estimated_hours,
           c.thumbnail_url, c.prerequisites
    FROM academy_core.courses c
    WHERE c.level = $1 AND c.status = 'published' AND $2 = ANY(c.prerequisites)
  `, [nextLevel, currentCourseId]);

  for (const candidate of candidates) {
    const prereqs: string[] = candidate.prerequisites || [];
    if (prereqs.length === 0) continue;

    const certs = await query<any>(
      `SELECT course_id FROM academy_core.certifications
       WHERE user_id = $1 AND status = 'issued' AND course_id = ANY($2)`,
      [userId, prereqs],
    );

    if (certs.length >= prereqs.length) {
      const enrolled = await queryOne<any>(
        'SELECT id FROM academy_core.enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, candidate.id],
      );
      return { ...candidate, alreadyEnrolled: !!enrolled };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// calculateTimeEstimate
// ---------------------------------------------------------------------------

export async function calculateTimeEstimate(enrollmentId: string) {
  const stats = await queryOne<any>(`
    SELECT
      e.started_at,
      (SELECT COUNT(*) FROM academy_core.lessons l
        JOIN academy_core.modules m ON m.id = l.module_id
        WHERE m.course_id = e.course_id AND l.is_required = true
      ) AS total_lessons,
      (SELECT COUNT(*) FROM academy_core.progress_tracking pt
        JOIN academy_core.lessons l ON l.id = pt.lesson_id
        JOIN academy_core.modules m ON m.id = l.module_id
        WHERE pt.enrollment_id = e.id AND pt.is_completed = true
          AND l.is_required = true
      ) AS completed_lessons,
      (SELECT COALESCE(SUM(pt.time_spent_seconds), 0)
        FROM academy_core.progress_tracking pt
        WHERE pt.enrollment_id = e.id
      ) AS total_time_seconds,
      (SELECT COALESCE(SUM(l.duration_minutes), 0)
        FROM academy_core.lessons l
        JOIN academy_core.modules m ON m.id = l.module_id
        WHERE m.course_id = e.course_id AND l.is_required = true
        AND NOT EXISTS (
          SELECT 1 FROM academy_core.progress_tracking pt
          WHERE pt.enrollment_id = e.id AND pt.lesson_id = l.id AND pt.is_completed = true
        )
      ) AS remaining_estimated_minutes
    FROM academy_core.enrollments e WHERE e.id = $1
  `, [enrollmentId]);

  if (!stats || parseInt(stats.total_lessons) === 0) {
    return { remainingMinutes: 0, estimatedCompletionDate: null, velocityLessonsPerHour: 0 };
  }

  const totalHours = parseInt(stats.total_time_seconds) / 3600;
  const completedLessons = parseInt(stats.completed_lessons);
  const remainingLessons = parseInt(stats.total_lessons) - completedLessons;
  const velocity = totalHours > 0 ? completedLessons / totalHours : 0;

  const remainingMinutes = velocity > 0
    ? Math.round((remainingLessons / velocity) * 60)
    : parseInt(stats.remaining_estimated_minutes);

  // Estimate completion date from daily pace
  const daysSinceStart = Math.max(
    1,
    (Date.now() - new Date(stats.started_at).getTime()) / 86_400_000,
  );
  const minutesPerDay = parseInt(stats.total_time_seconds) / 60 / daysSinceStart;
  const daysRemaining = minutesPerDay > 0 ? remainingMinutes / minutesPerDay : null;
  const estimatedCompletionDate = daysRemaining !== null
    ? new Date(Date.now() + daysRemaining * 86_400_000).toISOString()
    : null;

  return {
    remainingMinutes,
    estimatedCompletionDate,
    velocityLessonsPerHour: Math.round(velocity * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Leaderboard (Redis Sorted Sets)
// ---------------------------------------------------------------------------

export async function updateLeaderboard(
  userId: string,
  tenantId: string,
): Promise<void> {
  const redis = getRedis();

  // Score = total completed lessons
  const result = await queryOne<any>(
    `SELECT COUNT(*)::int AS score
     FROM academy_core.progress_tracking
     WHERE user_id = $1 AND is_completed = true`,
    [userId],
  );
  const score = result?.score ?? 0;

  // Resolve tenant hierarchy (country → REC → continental)
  const tenantChain: string[] = [tenantId];
  let current = await queryOne<any>(
    'SELECT parent_id FROM academy_core.tenants WHERE id = $1',
    [tenantId],
  );
  while (current?.parent_id) {
    tenantChain.push(current.parent_id);
    current = await queryOne<any>(
      'SELECT parent_id FROM academy_core.tenants WHERE id = $1',
      [current.parent_id],
    );
  }

  const now = new Date();
  const weekKey = `${now.getFullYear()}-W${String(getWeekNumber(now)).padStart(2, '0')}`;
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const pipeline = redis.pipeline();
  for (const tid of tenantChain) {
    pipeline.zadd(`leaderboard:${tid}:week:${weekKey}`, score, userId);
    pipeline.zadd(`leaderboard:${tid}:month:${monthKey}`, score, userId);
    pipeline.zadd(`leaderboard:${tid}:all`, score, userId);
    pipeline.expire(`leaderboard:${tid}:week:${weekKey}`, 14 * 86400);
    pipeline.expire(`leaderboard:${tid}:month:${monthKey}`, 62 * 86400);
  }
  await pipeline.exec();
}

// ---------------------------------------------------------------------------
// Streak (consecutive days of activity)
// ---------------------------------------------------------------------------

export async function updateStreak(userId: string): Promise<number> {
  const redis = getRedis();
  const key = `streak:${userId}`;
  const today = new Date().toISOString().slice(0, 10);

  const data = await redis.hgetall(key);
  const lastActive = data.last_active;
  let streak = parseInt(data.current_streak || '0', 10);

  if (lastActive === today) return streak; // already counted today

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  streak = lastActive === yesterday ? streak + 1 : 1;

  await redis.hmset(key, { current_streak: String(streak), last_active: today });
  await redis.expire(key, 90 * 86400);
  return streak;
}

// ---------------------------------------------------------------------------
// Video heartbeat flush (Redis → PostgreSQL batch)
// ---------------------------------------------------------------------------

export async function flushVideoHeartbeats(): Promise<number> {
  const redis = getRedis();
  const pattern = 'progress:video:*';
  let flushed = 0;

  // SCAN for heartbeat keys (non-blocking unlike KEYS)
  const stream = redis.scanStream({ match: pattern, count: 200 });

  const keysToProcess: string[] = [];
  for await (const batch of stream) {
    keysToProcess.push(...(batch as string[]));
  }

  if (keysToProcess.length === 0) return 0;

  for (const rawKey of keysToProcess) {
    // rawKey includes keyPrefix, strip it for redis commands
    const key = rawKey.replace(/^academy:/, '');

    const data = await redis.hgetall(key);
    if (!data.userId || !data.lessonId) {
      await redis.del(key);
      continue;
    }

    try {
      await queryOne(`
        INSERT INTO academy_core.progress_tracking
          (user_id, lesson_id, enrollment_id, time_spent_seconds,
           last_position_seconds, attempts)
        VALUES ($1, $2, $3, $4, $5, 1)
        ON CONFLICT (user_id, lesson_id) DO UPDATE SET
          time_spent_seconds = progress_tracking.time_spent_seconds + $4,
          last_position_seconds = $5,
          updated_at = NOW()
      `, [
        data.userId,
        data.lessonId,
        data.enrollmentId,
        parseInt(data.seconds || '0'),
        parseInt(data.position || '0'),
      ]);

      await redis.del(key);
      flushed++;
    } catch (err) {
      console.error(`[HeartbeatFlush] Failed for key ${key}:`, err);
    }
  }

  if (flushed > 0) {
    console.log(`[HeartbeatFlush] Flushed ${flushed} video heartbeats to DB`);
  }
  return flushed;
}
