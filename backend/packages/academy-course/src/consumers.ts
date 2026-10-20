// ============================================================================
// Topnet Solutions Academy — Course Service Kafka Consumers
// Listens for events that require cache invalidation or side effects
// ============================================================================
import {
  createConsumer,
  TOPICS,
  cacheDel,
  queryOne,
  type AcademyEvent,
} from '@topnet-academy/shared';
import { invalidateResolvedCache } from './services/course-resolver';

// ---------------------------------------------------------------------------
// ENROLLMENT_CREATED handler → increment enrollment count on the course
// ---------------------------------------------------------------------------

async function handleEnrollmentCreated(event: AcademyEvent): Promise<void> {
  const { course_id: courseId } = event.payload as any;

  if (!courseId) {
    console.log('[Course] Missing courseId in ENROLLMENT_CREATED event — skipping');
    return;
  }

  try {
    // Atomically increment the enrollment_count (or a computed count)
    // Using a subquery count for accuracy — avoids drift from missed events
    const updated = await queryOne<any>(`
      UPDATE academy_core.courses
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'),
        '{enrollment_count}',
        (
          SELECT to_jsonb(COUNT(*))
          FROM academy_core.enrollments
          WHERE course_id = $1 AND status IN ('active', 'completed')
        )
      ),
      updated_at = NOW()
      WHERE id = $1
      RETURNING id, metadata->>'enrollment_count' AS enrollment_count
    `, [courseId]);

    if (updated) {
      console.log(`[Course] Updated enrollment count for course ${courseId}: ${updated.enrollment_count}`);
    }

    // Invalidate caches so the new count is picked up
    await invalidateResolvedCache(courseId);
    await cacheDel(`courses:${courseId}*`);
  } catch (err) {
    console.error(`[Course] Failed to update enrollment count for course ${courseId}:`, err);
  }
}

// ---------------------------------------------------------------------------
// Consumer initialization
// ---------------------------------------------------------------------------

export async function initConsumers(): Promise<void> {
  // Cache invalidation on course updates/publishes
  await createConsumer(
    'course-cache-invalidator',
    [TOPICS.COURSE_UPDATED, TOPICS.COURSE_PUBLISHED],
    async (_topic: string, event: AcademyEvent) => {
      const payload = event.payload as { id?: string };
      if (payload?.id) {
        await invalidateResolvedCache(payload.id);
      }
      // Also clear list caches
      await cacheDel('courses:*');
    },
  );

  // Enrollment count tracker
  await createConsumer(
    'course-enrollment-counter',
    [TOPICS.ENROLLMENT_CREATED],
    async (_topic: string, event: AcademyEvent) => {
      await handleEnrollmentCreated(event);
    },
  );

  console.log('[academy-course] All consumers initialized');
}
