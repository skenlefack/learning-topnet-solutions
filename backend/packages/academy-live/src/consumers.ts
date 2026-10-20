// ============================================================================
// Topnet Solutions Academy — Live Service Consumers
// Listens: ENROLLMENT_CREATED, academy.live.recording-ready
// Publishes: academy.notification.* via ARIS Message Service
// ============================================================================
import { createConsumer, TOPICS, query, queryOne, publishEvent } from '@topnet-academy/shared';
import type { AcademyEvent } from '@topnet-academy/shared';

// ---------------------------------------------------------------------------
// ENROLLMENT_CREATED → auto-register for upcoming live sessions of the course
// ---------------------------------------------------------------------------

async function handleEnrollmentCreated(event: AcademyEvent): Promise<void> {
  const enrollment = event.payload as any;
  const { user_id: userId, course_id: courseId } = enrollment;

  if (!userId || !courseId) {
    console.log('[Live] Missing userId or courseId in ENROLLMENT_CREATED event — skipping');
    return;
  }

  console.log(`[Live] New enrollment: user ${userId} in course ${courseId} — checking upcoming sessions`);

  // Find upcoming live sessions for this course
  const upcomingSessions = await query(`
    SELECT id, title, scheduled_at, tenant_id FROM academy_core.live_sessions
    WHERE course_id = $1 AND status = 'scheduled' AND scheduled_at > NOW()
    ORDER BY scheduled_at ASC
  `, [courseId]);

  if (upcomingSessions.length === 0) {
    console.log(`[Live] No upcoming sessions for course ${courseId}`);
    return;
  }

  for (const session of upcomingSessions) {
    // Idempotent: ON CONFLICT DO NOTHING
    const attendance = await queryOne(`
      INSERT INTO academy_core.live_attendance (session_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (session_id, user_id) DO NOTHING
      RETURNING *
    `, [session.id, userId]);

    if (attendance) {
      console.log(`[Live] Auto-registered user ${userId} for session ${session.id} (${session.scheduled_at})`);

      // Notify the user about the upcoming session via ARIS Message Service
      await publishEvent('academy.notification.session_registered', {
        sessionId: session.id,
        sessionTitle: session.title,
        scheduledAt: session.scheduled_at,
        userId,
        courseId,
      }, session.tenant_id, userId);
    }
  }

  console.log(
    `[Live] User ${userId} auto-registered for ${upcomingSessions.length} upcoming session(s) of course ${courseId}`
  );
}

// ---------------------------------------------------------------------------
// RECORDING_READY → notify enrolled users that a recording is available
// ---------------------------------------------------------------------------

async function handleRecordingReady(event: AcademyEvent): Promise<void> {
  const data = event.payload as any;
  const { sessionId, courseId, recordId, url } = data;

  if (!sessionId) {
    console.log('[Live] Missing sessionId in recording-ready event — skipping');
    return;
  }

  console.log(`[Live] Recording ready for session ${sessionId} — notifying enrolled users`);

  // Fetch session details
  const session = await queryOne(`
    SELECT id, title, course_id, tenant_id, scheduled_at
    FROM academy_core.live_sessions WHERE id = $1
  `, [sessionId]);

  if (!session) {
    console.log(`[Live] Session ${sessionId} not found — skipping recording notification`);
    return;
  }

  const effectiveCourseId = courseId || session.course_id;

  // Find all enrolled users for this course (or session attendees if no course)
  let usersToNotify: Array<{ user_id: string }> = [];

  if (effectiveCourseId) {
    // Notify all enrolled users in the course
    usersToNotify = await query(`
      SELECT DISTINCT user_id FROM academy_core.enrollments
      WHERE course_id = $1 AND status = 'active'
    `, [effectiveCourseId]);
  } else {
    // No course linked — notify session attendees instead
    usersToNotify = await query(`
      SELECT DISTINCT user_id FROM academy_core.live_attendance
      WHERE session_id = $1
    `, [sessionId]);
  }

  if (usersToNotify.length === 0) {
    console.log(`[Live] No users to notify about recording for session ${sessionId}`);
    return;
  }

  // Send notification to each user
  for (const { user_id: userId } of usersToNotify) {
    await publishEvent('academy.notification.recording_available', {
      sessionId: session.id,
      sessionTitle: session.title,
      courseId: effectiveCourseId,
      recordId,
      recordingUrl: url,
      scheduledAt: session.scheduled_at,
      userId,
    }, session.tenant_id, userId);
  }

  console.log(
    `[Live] Notified ${usersToNotify.length} user(s) about recording for session ${sessionId}`
  );
}

// ---------------------------------------------------------------------------
// Consumer initialization
// ---------------------------------------------------------------------------

export async function initConsumers(): Promise<void> {
  // Consumer 1: Auto-register enrolled users for upcoming live sessions
  await createConsumer(
    'live-auto-register',
    [TOPICS.ENROLLMENT_CREATED],
    async (_topic, event) => {
      await handleEnrollmentCreated(event);
    }
  );

  // Consumer 2: Notify enrolled users when recording becomes available
  await createConsumer(
    'live-recording-notify',
    ['academy.live.recording-ready'],
    async (_topic, event) => {
      await handleRecordingReady(event);
    }
  );

  console.log('[academy-live] All consumers initialized');
}
