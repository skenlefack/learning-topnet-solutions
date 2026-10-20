// ============================================================================
// Topnet Solutions Academy — Path Composite Exam Routes
// Start and submit exams that pull questions from all courses in a path
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, transaction, validateBody, publishEvent, TOPICS,
  BearerSecurity,
} from '@topnet-academy/shared';

const startSchema = z.object({ pathId: z.string().uuid() });
const submitSchema = z.object({
  attemptId: z.string().uuid(),
  answers: z.record(z.any()),
});

export async function pathExamRoutes(app: FastifyInstance) {

  // =========================================================================
  // POST /path-exam/start — Start a composite path exam
  // =========================================================================
  app.post('/path-exam/start', {
    schema: { summary: 'Start a composite path exam', tags: ['Path Exam'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    const { pathId } = validateBody(startSchema, req.body);

    // Verify path exists and is published
    const path = await queryOne(
      'SELECT id, title, passing_score FROM academy_core.learning_paths WHERE id = $1 AND is_published = true',
      [pathId],
    );
    if (!path) return reply.code(404).send({ success: false, error: 'Path not found' });

    // Verify user is enrolled in path
    const enrollment = await queryOne(
      'SELECT id FROM academy_core.learning_path_enrollments WHERE user_id = $1 AND path_id = $2',
      [user.sub, pathId],
    );
    if (!enrollment) return reply.code(403).send({ success: false, error: 'Not enrolled in this path' });

    // Get all courses in this path
    const pathCourses = await query(
      'SELECT course_id FROM academy_core.learning_path_courses WHERE path_id = $1 ORDER BY sort_order',
      [pathId],
    );
    if (pathCourses.length === 0) {
      return reply.code(400).send({ success: false, error: 'Path has no courses' });
    }

    const courseIds = pathCourses.map((c: any) => c.course_id);

    // Pull questions from final assessments of each course (2-3 per course)
    const questions: any[] = [];
    for (const courseId of courseIds) {
      const courseQuestions = await query(
        `SELECT q.id, q.question_text, q.question_type, q.options, q.difficulty, q.points
         FROM academy_core.questions q
         JOIN academy_core.assessments a ON a.id = q.assessment_id
         WHERE a.course_id = $1 AND a.is_final = true
         ORDER BY RANDOM()
         LIMIT 3`,
        [courseId],
      );
      // If no final assessment, pull from any assessment
      if (courseQuestions.length === 0) {
        const fallback = await query(
          `SELECT q.id, q.question_text, q.question_type, q.options, q.difficulty, q.points
           FROM academy_core.questions q
           JOIN academy_core.assessments a ON a.id = q.assessment_id
           WHERE a.course_id = $1
           ORDER BY RANDOM()
           LIMIT 3`,
          [courseId],
        );
        questions.push(...fallback);
      } else {
        questions.push(...courseQuestions);
      }
    }

    if (questions.length === 0) {
      return reply.code(400).send({ success: false, error: 'No questions available for this path exam' });
    }

    // Create attempt record
    const attempt = await queryOne(
      `INSERT INTO academy_core.assessment_attempts
         (user_id, assessment_id, enrollment_id, path_id, started_at)
       VALUES ($1, NULL, $2, $3, NOW())
       RETURNING id, started_at`,
      [user.sub, enrollment.id, pathId],
    );

    // Sanitize questions (remove correct answers)
    const sanitized = questions.map((q: any) => ({
      id: q.id,
      questionText: q.question_text,
      questionType: q.question_type,
      options: (q.options || []).map((o: any) => ({
        id: o.id,
        text: o.text,
        // Strip isCorrect from client
      })),
      difficulty: q.difficulty,
      points: q.points,
    }));

    return reply.send({
      success: true,
      data: {
        attemptId: attempt.id,
        pathTitle: path.title,
        passingScore: path.passing_score,
        questions: sanitized,
        totalQuestions: sanitized.length,
        timeLimit: sanitized.length * 2, // 2 minutes per question
      },
    });
  });

  // =========================================================================
  // POST /path-exam/submit — Submit composite path exam
  // =========================================================================
  app.post('/path-exam/submit', {
    schema: { summary: 'Submit composite path exam', tags: ['Path Exam'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    const { attemptId, answers } = validateBody(submitSchema, req.body);

    // Verify attempt
    const attempt = await queryOne(
      `SELECT id, user_id, path_id, submitted_at FROM academy_core.assessment_attempts WHERE id = $1`,
      [attemptId],
    );
    if (!attempt) return reply.code(404).send({ success: false, error: 'Attempt not found' });
    if (attempt.user_id !== user.sub) return reply.code(403).send({ success: false, error: 'Not your attempt' });
    if (attempt.submitted_at) return reply.code(400).send({ success: false, error: 'Already submitted' });

    // Get path passing score
    const path = await queryOne(
      'SELECT passing_score, title FROM academy_core.learning_paths WHERE id = $1',
      [attempt.path_id],
    );
    const passingScore = path?.passing_score || 70;

    // Score each answer
    const questionIds = Object.keys(answers);
    let earnedPoints = 0;
    let maxPoints = 0;
    const results: any[] = [];

    for (const qId of questionIds) {
      const question = await queryOne(
        'SELECT id, question_text, options, correct_answer, points, explanation FROM academy_core.questions WHERE id = $1',
        [qId],
      );
      if (!question) continue;

      const pts = question.points || 1;
      maxPoints += pts;

      const userAnswer = answers[qId];
      let isCorrect = false;

      // Check correctness based on options
      if (question.options && Array.isArray(question.options)) {
        const correctIds = question.options.filter((o: any) => o.isCorrect).map((o: any) => o.id);
        if (Array.isArray(userAnswer)) {
          isCorrect = userAnswer.length === correctIds.length && userAnswer.every((a: string) => correctIds.includes(a));
        } else {
          isCorrect = correctIds.includes(userAnswer);
        }
      } else if (question.correct_answer) {
        const ca = typeof question.correct_answer === 'string' ? question.correct_answer : JSON.stringify(question.correct_answer);
        const ua = typeof userAnswer === 'string' ? userAnswer : JSON.stringify(userAnswer);
        isCorrect = ca.toLowerCase() === ua.toLowerCase();
      }

      if (isCorrect) earnedPoints += pts;
      results.push({ questionId: qId, isCorrect, points: isCorrect ? pts : 0, explanation: question.explanation });
    }

    const score = maxPoints > 0 ? Math.round((earnedPoints / maxPoints) * 100) : 0;
    const passed = score >= passingScore;

    // Update attempt
    await query(
      `UPDATE academy_core.assessment_attempts
       SET score = $2, answers = $3::jsonb, passed = $4, submitted_at = NOW(),
           time_taken_seconds = EXTRACT(EPOCH FROM (NOW() - started_at))::int
       WHERE id = $1`,
      [attemptId, score, JSON.stringify(answers), passed],
    );

    // If passed, issue path certification
    let certification = null;
    if (passed) {
      // Update path enrollment
      await query(
        `UPDATE academy_core.learning_path_enrollments SET status = 'completed', progress_percent = 100, completed_at = NOW()
         WHERE user_id = $1 AND path_id = $2`,
        [user.sub, attempt.path_id],
      );

      // Issue path certification
      const certNumber = `TOPNET-PATH-${new Date().getFullYear()}-${attempt.path_id.substring(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      certification = await queryOne(
        `INSERT INTO academy_core.certifications
           (user_id, course_id, path_id, level, status, certificate_number, issued_at, expires_at)
         VALUES ($1, NULL, $2, 'expert', 'issued', $3, NOW(), NOW() + INTERVAL '3 years')
         RETURNING id, certificate_number, issued_at`,
        [user.sub, attempt.path_id, certNumber],
      );

      publishEvent(TOPICS.CERTIFICATION_ISSUED, {
        user_id: user.sub, path_id: attempt.path_id, certificate_number: certNumber,
      }, user.tenantId, user.sub).catch(() => {});
    }

    return reply.send({
      success: true,
      data: {
        score,
        passed,
        passingScore,
        earnedPoints,
        maxPoints,
        totalQuestions: questionIds.length,
        correctAnswers: results.filter(r => r.isCorrect).length,
        results,
        certification,
      },
    });
  });
}
