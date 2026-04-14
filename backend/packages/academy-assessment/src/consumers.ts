// ============================================================================
// ARIS Academy — Assessment Service Consumers
// Listens: LESSON_COMPLETED, ASSESSMENT_COMPLETED, CERTIFICATION_PENDING
// ============================================================================
import { createConsumer, TOPICS, query, queryOne, publishEvent } from '@aris-academy/shared';
import type { AcademyEvent } from '@aris-academy/shared';

async function handleLessonCompleted(event: AcademyEvent): Promise<void> {
  const { enrollmentId, userId } = event.payload as any;

  if (!enrollmentId || !userId) {
    console.log('[Assessment] Missing enrollmentId or userId in LESSON_COMPLETED event — skipping');
    return;
  }

  // Get the enrollment to find the course
  const enrollment = await queryOne(
    'SELECT * FROM academy_core.enrollments WHERE id = $1',
    [enrollmentId]
  );
  if (!enrollment) return;

  // Check if ALL required lessons of the course are now completed
  const stats = await queryOne(`
    WITH course_stats AS (
      SELECT
        (SELECT COUNT(*) FROM academy_core.lessons l
          JOIN academy_core.modules m ON m.id = l.module_id
          WHERE m.course_id = $1 AND l.is_required = true) AS total_required,
        (SELECT COUNT(*) FROM academy_core.progress_tracking pt
          JOIN academy_core.lessons l ON l.id = pt.lesson_id
          JOIN academy_core.modules m ON m.id = l.module_id
          WHERE pt.enrollment_id = $2 AND pt.is_completed = true AND l.is_required = true) AS completed_required
    )
    SELECT * FROM course_stats
  `, [enrollment.course_id, enrollmentId]);

  if (!stats || stats.total_required === 0) return;

  const totalRequired = parseInt(stats.total_required);
  const completedRequired = parseInt(stats.completed_required);

  if (completedRequired >= totalRequired) {
    // Check if a final assessment exists for this course
    const finalAssessment = await queryOne(
      'SELECT id, title FROM academy_core.assessments WHERE course_id = $1 AND is_final = true',
      [enrollment.course_id]
    );

    if (!finalAssessment) {
      console.log(`[Assessment] No final assessment for course ${enrollment.course_id} — skipping notification`);
      return;
    }

    // Idempotent: check if the user already passed or has a pending attempt
    const existingAttempt = await queryOne(`
      SELECT id FROM academy_core.assessment_attempts
      WHERE user_id = $1 AND assessment_id = $2 AND passed = true
    `, [userId, finalAssessment.id]);

    if (existingAttempt) {
      console.log(`[Assessment] User ${userId} already passed final assessment — skipping notification`);
      return;
    }

    console.log(
      `[Assessment] All ${totalRequired} required lessons completed for user ${userId} ` +
      `in course ${enrollment.course_id} — exam "${finalAssessment.id}" now available`
    );

    // Store a notification record for the frontend to pick up
    // Using audit_log as a lightweight notification mechanism
    await queryOne(`
      INSERT INTO academy_core.audit_log (user_id, tenant_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, 'exam_available', 'assessment', $3, $4)
      ON CONFLICT DO NOTHING
    `, [
      userId,
      event.tenantId,
      finalAssessment.id,
      JSON.stringify({
        courseId: enrollment.course_id,
        enrollmentId,
        message: 'All required lessons completed — final exam is now available',
      }),
    ]).catch(() => {
      // Idempotent: ignore duplicate notification
    });
  }
}

// ---------------------------------------------------------------------------
// ASSESSMENT_COMPLETED handler → if passed, publish CERTIFICATION_PENDING
// ---------------------------------------------------------------------------

async function handleAssessmentCompleted(event: AcademyEvent): Promise<void> {
  const {
    user_id: userId,
    assessment_id: assessmentId,
    attempt_id: attemptId,
    score,
    passed,
  } = event.payload as any;

  if (!userId || !assessmentId) {
    console.log('[Assessment] Missing userId or assessmentId in ASSESSMENT_COMPLETED — skipping');
    return;
  }

  if (!passed) {
    console.log(`[Assessment] User ${userId} did not pass assessment ${assessmentId} (score: ${score}) — no certification`);
    return;
  }

  // Look up the assessment to get course info
  const assessment = await queryOne<any>(
    'SELECT id, course_id, is_final, title FROM academy_core.assessments WHERE id = $1',
    [assessmentId],
  );
  if (!assessment) {
    console.log(`[Assessment] Assessment ${assessmentId} not found — skipping`);
    return;
  }

  // Only trigger certification for final assessments
  if (!assessment.is_final) {
    console.log(`[Assessment] Assessment ${assessmentId} is not final — skipping certification flow`);
    return;
  }

  // Idempotent: check if a certification is already pending or issued
  const existingCert = await queryOne<any>(`
    SELECT id, status FROM academy_core.certifications
    WHERE user_id = $1 AND course_id = $2 AND status IN ('pending', 'issued')
  `, [userId, assessment.course_id]);

  if (existingCert) {
    console.log(`[Assessment] Certification already ${existingCert.status} for user ${userId} in course ${assessment.course_id} — skipping`);
    return;
  }

  console.log(`[Assessment] User ${userId} passed final assessment ${assessmentId} — publishing CERTIFICATION_PENDING`);

  await publishEvent(TOPICS.CERTIFICATION_PENDING, {
    user_id: userId,
    course_id: assessment.course_id,
    assessment_id: assessmentId,
    attempt_id: attemptId,
    score,
    passed_at: new Date().toISOString(),
  }, event.tenantId, userId);
}

// ---------------------------------------------------------------------------
// CERTIFICATION_PENDING handler → auto-generate certificate if conditions met
// ---------------------------------------------------------------------------

async function handleCertificationPending(event: AcademyEvent): Promise<void> {
  const {
    user_id: userId,
    course_id: courseId,
    assessment_id: assessmentId,
    score,
  } = event.payload as any;

  if (!userId || !courseId) {
    console.log('[Assessment] Missing userId or courseId in CERTIFICATION_PENDING — skipping');
    return;
  }

  // Verify: all required lessons completed
  const lessonStats = await queryOne<any>(`
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
  `, [courseId, userId]);

  if (!lessonStats) return;

  const totalRequired = parseInt(lessonStats.total_required) || 0;
  const completedRequired = parseInt(lessonStats.completed_required) || 0;

  if (totalRequired > 0 && completedRequired < totalRequired) {
    console.log(
      `[Assessment] User ${userId} completed ${completedRequired}/${totalRequired} required lessons ` +
      `for course ${courseId} — cannot issue certificate yet`
    );
    return;
  }

  // Verify: final assessment passed
  const passedAttempt = await queryOne<any>(`
    SELECT id, score FROM academy_core.assessment_attempts
    WHERE user_id = $1 AND assessment_id = $2 AND passed = true
    ORDER BY completed_at DESC LIMIT 1
  `, [userId, assessmentId]);

  if (!passedAttempt) {
    console.log(`[Assessment] No passed attempt found for user ${userId} on assessment ${assessmentId} — skipping`);
    return;
  }

  // Get course details for the certificate
  const course = await queryOne<any>(
    'SELECT title, level FROM academy_core.courses WHERE id = $1',
    [courseId],
  );
  if (!course) return;

  // Idempotent: check again for existing certification
  const existingCert = await queryOne<any>(`
    SELECT id FROM academy_core.certifications
    WHERE user_id = $1 AND course_id = $2 AND status IN ('pending', 'issued')
  `, [userId, courseId]);

  if (existingCert) {
    console.log(`[Assessment] Certification already exists for user ${userId} in course ${courseId} — skipping`);
    return;
  }

  // Generate a unique certificate number: ARIS-{LEVEL_PREFIX}-{YEAR}-{RANDOM}
  const levelPrefix = (course.level || 'GEN').substring(0, 3).toUpperCase();
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  const certNumber = `ARIS-${levelPrefix}-${year}-${randomPart}`;

  // Create the certification record
  const certification = await queryOne<any>(`
    INSERT INTO academy_core.certifications
      (user_id, course_id, level, status, certificate_number, score, issued_at, tenant_id)
    VALUES ($1, $2, $3, 'issued', $4, $5, NOW(), $6)
    ON CONFLICT DO NOTHING
    RETURNING *
  `, [userId, courseId, course.level, certNumber, score || passedAttempt.score, event.tenantId]);

  if (!certification) {
    console.log(`[Assessment] Failed to create certification (likely duplicate) for user ${userId} in course ${courseId}`);
    return;
  }

  console.log(`[Assessment] Certificate ${certNumber} issued for user ${userId} in course ${courseId}`);

  // Publish CERTIFICATION_ISSUED for downstream processing (learning service handles notifications + auto-enrollment)
  await publishEvent(TOPICS.CERTIFICATION_ISSUED, {
    id: certification.id,
    user_id: userId,
    course_id: courseId,
    level: course.level,
    certificate_number: certNumber,
    score: certification.score,
    issued_at: certification.issued_at,
  }, event.tenantId, userId);
}

// ---------------------------------------------------------------------------
// Consumer initialization
// ---------------------------------------------------------------------------

export async function initConsumers(): Promise<void> {
  // Existing: notify when all lessons are done and exam is available
  await createConsumer(
    'assessment-exam-notifier',
    [TOPICS.LESSON_COMPLETED],
    async (_topic, event) => {
      await handleLessonCompleted(event);
    }
  );

  // New: when an assessment is completed and passed, trigger certification flow
  await createConsumer(
    'assessment-certification-trigger',
    [TOPICS.ASSESSMENT_COMPLETED],
    async (_topic, event) => {
      await handleAssessmentCompleted(event);
    }
  );

  // New: when certification is pending, validate conditions and auto-generate certificate
  await createConsumer(
    'assessment-certification-generator',
    [TOPICS.CERTIFICATION_PENDING],
    async (_topic, event) => {
      await handleCertificationPending(event);
    }
  );

  console.log('[academy-assessment] All consumers initialized');
}
