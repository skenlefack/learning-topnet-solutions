// ============================================================================
// ARIS Academy — Learning Service Consumers
// Kafka topics  : COURSE_PUBLISHED, COURSE_UPDATED, CERTIFICATION_ISSUED,
//                 LIVE_RECORDED, PROGRESS_UPDATED
// Background job: video heartbeat flush (every 5 min)
// ============================================================================
import {
  createConsumer, TOPICS,
  query, queryOne,
  cacheDel, publishEvent,
} from '@aris-academy/shared';
import type { AcademyEvent } from '@aris-academy/shared';
import {
  getNextLevel,
  updateLeaderboard,
  updateStreak,
  flushVideoHeartbeats,
} from './services/progression-engine';

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleCoursePublished(event: AcademyEvent): Promise<void> {
  const { id: courseId } = event.payload as any;
  console.log(`[Learning] Course published: ${courseId} — invalidating catalog caches`);
  await cacheDel('courses:*');
}

async function handleCourseUpdated(event: AcademyEvent): Promise<void> {
  const { id: courseId } = event.payload as any;
  console.log(`[Learning] Course updated: ${courseId} — invalidating caches`);
  await cacheDel('courses:*');
  await cacheDel('enrollments:*');
}

async function handleCertificationIssued(event: AcademyEvent): Promise<void> {
  const cert = event.payload as any;
  const { user_id: userId, course_id: courseId, level } = cert;
  const nextLevel = getNextLevel(level);

  console.log(`[Learning] Certification issued for user ${userId} at level ${level}`);

  if (!nextLevel) {
    console.log(`[Learning] User ${userId} at max level (${level}) — no next level`);
    return;
  }

  // Find courses at the next level that require the certified course
  const nextCourses = await query<any>(`
    SELECT id, title, prerequisites FROM academy_core.courses
    WHERE level = $1 AND status = 'published' AND $2 = ANY(prerequisites)
  `, [nextLevel, courseId]);

  for (const course of nextCourses) {
    const prereqs: string[] = course.prerequisites || [];
    if (prereqs.length === 0) continue;

    const certs = await query<any>(`
      SELECT course_id FROM academy_core.certifications
      WHERE user_id = $1 AND status = 'issued' AND course_id = ANY($2)
    `, [userId, prereqs]);

    if (certs.length >= prereqs.length) {
      console.log(`[Learning] User ${userId} unlocked course ${course.id} (${nextLevel})`);

      const existing = await queryOne(
        'SELECT id FROM academy_core.enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, course.id],
      );

      if (!existing) {
        const enrollment = await queryOne(`
          INSERT INTO academy_core.enrollments (user_id, course_id, current_level)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, course_id) DO NOTHING
          RETURNING *
        `, [userId, course.id, nextLevel]);

        if (enrollment) {
          await publishEvent(TOPICS.ENROLLMENT_CREATED, enrollment, event.tenantId, userId);
          console.log(`[Learning] Auto-enrolled user ${userId} in course ${course.id}`);
        }
      }
    }
  }
}

async function handleLiveRecorded(event: AcademyEvent): Promise<void> {
  const { sessionId, recordingUrl, courseId } = event.payload as any;

  console.log(`[Learning] Live session ${sessionId} recorded — creating replay lesson`);

  if (!courseId) {
    console.log(`[Learning] No courseId for session ${sessionId} — skipping replay`);
    return;
  }

  const session = await queryOne<any>(
    'SELECT * FROM academy_core.live_sessions WHERE id = $1',
    [sessionId],
  );
  if (!session) {
    console.log(`[Learning] Session ${sessionId} not found — skipping replay`);
    return;
  }

  const lastModule = await queryOne<any>(`
    SELECT id FROM academy_core.modules
    WHERE course_id = $1 ORDER BY sort_order DESC LIMIT 1
  `, [courseId]);
  if (!lastModule) {
    console.log(`[Learning] No modules for course ${courseId} — skipping replay`);
    return;
  }

  const lastLesson = await queryOne<any>(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
    FROM academy_core.lessons WHERE module_id = $1
  `, [lastModule.id]);

  const sessionTitle = typeof session.title === 'object' ? session.title : { fr: session.title };
  const replayTitle: Record<string, string> = {};
  for (const [lang, text] of Object.entries(sessionTitle)) {
    replayTitle[lang] = `Replay: ${text}`;
  }

  // Idempotent check
  const existing = await queryOne(
    `SELECT id FROM academy_core.lessons
     WHERE module_id = $1 AND type = 'replay' AND content->>'sessionId' = $2`,
    [lastModule.id, sessionId],
  );
  if (existing) {
    console.log(`[Learning] Replay for session ${sessionId} already exists — skipping`);
    return;
  }

  const lesson = await queryOne<any>(`
    INSERT INTO academy_core.lessons
      (module_id, title, type, video_url, content, sort_order, is_required, duration_minutes)
    VALUES ($1, $2, 'replay', $3, $4, $5, false, $6)
    RETURNING *
  `, [
    lastModule.id,
    JSON.stringify(replayTitle),
    recordingUrl,
    JSON.stringify({ sessionId, recordedAt: new Date().toISOString() }),
    lastLesson.next_order,
    session.recording_duration_seconds ? Math.ceil(session.recording_duration_seconds / 60) : null,
  ]);

  console.log(`[Learning] Replay lesson created: ${lesson.id} for session ${sessionId}`);
  await cacheDel('courses:*');
}

// ---------------------------------------------------------------------------
// Notification creator helper
// ---------------------------------------------------------------------------

async function createNotification(
  userId: string,
  tenantId: string,
  type: string,
  title: Record<string, string>,
  body: Record<string, string>,
  data: Record<string, unknown> = {},
): Promise<void> {
  try {
    await queryOne(
      `INSERT INTO academy_core.notifications
         (user_id, tenant_id, type, title, body, data)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb)
       RETURNING id`,
      [userId, tenantId, type, JSON.stringify(title), JSON.stringify(body), JSON.stringify(data)],
    );
  } catch (err) {
    console.error('[Learning] Failed to create notification:', err);
  }
}

// ---------------------------------------------------------------------------
// ENROLLMENT_CREATED handler → notify learner
// ---------------------------------------------------------------------------

async function handleEnrollmentCreated(event: AcademyEvent): Promise<void> {
  const { user_id: userId, course_id: courseId } = event.payload as any;
  if (!userId || !event.tenantId) return;

  const course = await queryOne<any>(
    'SELECT title FROM academy_core.courses WHERE id = $1',
    [courseId],
  );
  const courseTitle = course?.title || {};

  await createNotification(
    userId,
    event.tenantId,
    'enrollment',
    { fr: 'Inscription confirmee', en: 'Enrollment confirmed' },
    {
      fr: `Vous etes inscrit au cours "${courseTitle.fr || courseTitle.en || ''}"`,
      en: `You have been enrolled in "${courseTitle.en || courseTitle.fr || ''}"`,
    },
    { courseId },
  );
}

// ---------------------------------------------------------------------------
// CERTIFICATION_ISSUED handler → notify + progression
// ---------------------------------------------------------------------------

async function handleCertificationNotification(event: AcademyEvent): Promise<void> {
  const { user_id: userId, course_id: courseId, certificate_number: certNumber } = event.payload as any;
  if (!userId || !event.tenantId) return;

  await createNotification(
    userId,
    event.tenantId,
    'certification',
    { fr: 'Certification obtenue !', en: 'Certification earned!' },
    {
      fr: `Felicitations ! Votre certificat ${certNumber || ''} est disponible.`,
      en: `Congratulations! Your certificate ${certNumber || ''} is now available.`,
    },
    { courseId, certNumber },
  );
}

// ---------------------------------------------------------------------------
// LIVE_STARTED handler → notify enrolled users
// ---------------------------------------------------------------------------

async function handleLiveStarted(event: AcademyEvent): Promise<void> {
  const { id: sessionId, course_id: courseId, title: sessionTitle } = event.payload as any;
  if (!event.tenantId) return;

  const localTitle = typeof sessionTitle === 'object' ? sessionTitle : { fr: sessionTitle };

  // Find enrolled users for this course (or all tenant users if no course)
  let users: any[];
  if (courseId) {
    users = await query<any>(
      `SELECT DISTINCT e.user_id, u.tenant_id
       FROM academy_core.enrollments e
       JOIN academy_core.users u ON u.id = e.user_id
       WHERE e.course_id = $1 AND e.status = 'active'`,
      [courseId],
    );
  } else {
    users = [];
  }

  for (const u of users) {
    await createNotification(
      u.user_id,
      u.tenant_id,
      'live_started',
      { fr: 'Session live en cours !', en: 'Live session started!' },
      {
        fr: `La session "${localTitle.fr || localTitle.en || ''}" a commence.`,
        en: `The session "${localTitle.en || localTitle.fr || ''}" has started.`,
      },
      { sessionId, courseId },
    );
  }
}

// ---------------------------------------------------------------------------
// PROGRESS_UPDATED handler → leaderboard + streak + course completion check
// ---------------------------------------------------------------------------

async function handleProgressUpdated(event: AcademyEvent): Promise<void> {
  const { user_id: userId, enrollment_id: enrollmentId, course_id: courseId } = event.payload as any;
  if (!userId || !event.tenantId) return;

  try {
    await Promise.all([
      updateLeaderboard(userId, event.tenantId),
      updateStreak(userId),
    ]);
  } catch (err) {
    console.error('[Learning] Failed to update leaderboard/streak:', err);
  }

  // --- Course completion check ---
  if (!enrollmentId && !courseId) return;

  try {
    // Resolve the courseId from the enrollment if not provided directly
    let resolvedCourseId = courseId;
    if (!resolvedCourseId && enrollmentId) {
      const enrollment = await queryOne<any>(
        'SELECT course_id FROM academy_core.enrollments WHERE id = $1',
        [enrollmentId],
      );
      if (!enrollment) return;
      resolvedCourseId = enrollment.course_id;
    }

    // Check if ALL required lessons for the course are completed by this user
    const stats = await queryOne<any>(`
      WITH course_stats AS (
        SELECT
          (SELECT COUNT(*) FROM academy_core.lessons l
            JOIN academy_core.modules m ON m.id = l.module_id
            WHERE m.course_id = $1 AND l.is_required = true) AS total_required,
          (SELECT COUNT(*) FROM academy_core.progress_tracking pt
            JOIN academy_core.lessons l ON l.id = pt.lesson_id
            JOIN academy_core.modules m ON m.id = l.module_id
            WHERE pt.user_id = $2 AND pt.is_completed = true
              AND m.course_id = $1 AND l.is_required = true) AS completed_required
      )
      SELECT * FROM course_stats
    `, [resolvedCourseId, userId]);

    if (!stats || parseInt(stats.total_required) === 0) return;

    const totalRequired = parseInt(stats.total_required);
    const completedRequired = parseInt(stats.completed_required);

    if (completedRequired >= totalRequired) {
      // Mark the enrollment as completed if not already
      await queryOne(`
        UPDATE academy_core.enrollments
        SET status = 'completed', progress_percent = 100, completed_at = NOW()
        WHERE user_id = $1 AND course_id = $2 AND status = 'active'
        RETURNING id
      `, [userId, resolvedCourseId]);

      // Publish COURSE_COMPLETED event for downstream services (assessment, certification)
      console.log(`[Learning] User ${userId} completed all ${totalRequired} required lessons in course ${resolvedCourseId}`);
      await publishEvent(TOPICS.COURSE_COMPLETED, {
        user_id: userId,
        course_id: resolvedCourseId,
        enrollment_id: enrollmentId,
        completed_at: new Date().toISOString(),
      }, event.tenantId, userId);

      // Notify the learner
      const course = await queryOne<any>(
        'SELECT title FROM academy_core.courses WHERE id = $1',
        [resolvedCourseId],
      );
      const courseTitle = course?.title || {};

      await createNotification(
        userId,
        event.tenantId,
        'course_completed',
        { fr: 'Cours termine !', en: 'Course completed!' },
        {
          fr: `Felicitations ! Vous avez termine toutes les lecons du cours "${courseTitle.fr || courseTitle.en || ''}"`,
          en: `Congratulations! You have completed all lessons in "${courseTitle.en || courseTitle.fr || ''}"`,
        },
        { courseId: resolvedCourseId },
      );
    }
  } catch (err) {
    console.error('[Learning] Failed to check course completion:', err);
  }
}

// ---------------------------------------------------------------------------
// Init all consumers + background flush job
// ---------------------------------------------------------------------------

let flushInterval: ReturnType<typeof setInterval> | null = null;

export async function initConsumers(): Promise<void> {
  // Catalog sync
  await createConsumer(
    'learning-catalog-sync',
    [TOPICS.COURSE_PUBLISHED, TOPICS.COURSE_UPDATED],
    async (topic, event) => {
      if (topic === TOPICS.COURSE_PUBLISHED) await handleCoursePublished(event);
      else if (topic === TOPICS.COURSE_UPDATED) await handleCourseUpdated(event);
    },
  );

  // Progression (certification → auto-enroll next level + notification)
  await createConsumer(
    'learning-progression',
    [TOPICS.CERTIFICATION_ISSUED],
    async (_topic, event) => {
      await handleCertificationIssued(event);
      await handleCertificationNotification(event);
    },
  );

  // Enrollment notifications
  await createConsumer(
    'learning-enrollment-notif',
    [TOPICS.ENROLLMENT_CREATED],
    async (_topic, event) => {
      await handleEnrollmentCreated(event);
    },
  );

  // Live session started notifications
  await createConsumer(
    'learning-live-notif',
    [TOPICS.LIVE_STARTED],
    async (_topic, event) => {
      await handleLiveStarted(event);
    },
  );

  // Replay creator
  await createConsumer(
    'learning-replay-creator',
    [TOPICS.LIVE_RECORDED],
    async (_topic, event) => {
      await handleLiveRecorded(event);
    },
  );

  // Leaderboard + streak updater
  await createConsumer(
    'learning-leaderboard',
    [TOPICS.PROGRESS_UPDATED],
    async (_topic, event) => {
      await handleProgressUpdated(event);
    },
  );

  // Background job: flush video heartbeats from Redis → DB every 5 minutes
  const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
  flushInterval = setInterval(async () => {
    try {
      await flushVideoHeartbeats();
    } catch (err) {
      console.error('[Learning] Heartbeat flush error:', err);
    }
  }, FLUSH_INTERVAL_MS);

  console.log('[academy-learning] All consumers initialized');
  console.log(`[academy-learning] Video heartbeat flush scheduled every ${FLUSH_INTERVAL_MS / 1000}s`);
}

export function stopConsumers(): void {
  if (flushInterval) {
    clearInterval(flushInterval);
    flushInterval = null;
  }
}
