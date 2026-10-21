// ============================================================================
// Skills Routes — Standalone skill test tracks and test-taking flow
// GET  /skills/tracks              — list skill tracks (public)
// GET  /skills/tracks/:code        — get track detail (public)
// GET  /skills/formats             — list test formats
// POST /skills/start               — start a skill test
// POST /skills/submit              — submit answers and get scored results
// GET  /skills/result/:attemptId   — get result detail
// GET  /skills/history             — user's test history
// GET  /skills/verify/:certCode    — public certificate verification
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import {
  query, queryOne, validateBody, publishEvent, TOPICS, BearerSecurity,
} from '@topnet-academy/shared';
import {
  selectSkillQuestions,
  scoreSkillAttempt,
  getAnswerKey,
} from '../services/scoring-engine';

const startTestSchema = z.object({
  trackCode: z.string().min(1).max(30),
  format: z.string().min(1).max(20),
});

const submitTestSchema = z.object({
  attemptId: z.string().uuid(),
  token: z.string().min(1),
  answers: z.record(z.string(), z.number()),
  tabSwitches: z.number().int().min(0).default(0),
  timeUp: z.boolean().default(false),
});

export async function skillRoutes(app: FastifyInstance) {

  // =========================================================================
  // PUBLIC — browse skill tracks
  // =========================================================================

  // GET /skills/tracks — list all active skill tracks
  app.get('/tracks', async (req: any, reply) => {
    const tenantId = req.headers['x-tenant-id'] || null;
    let rows;
    if (tenantId) {
      rows = await query(
        `SELECT st.*,
           (SELECT COUNT(*)::int FROM academy_core.questions q WHERE q.skill_track_id = st.id) AS question_count
         FROM academy_core.skill_tracks st
         WHERE st.tenant_id = $1 AND st.is_active = true
         ORDER BY st.sort_order, st.name->>'fr'`,
        [tenantId],
      );
    } else {
      rows = await query(
        `SELECT st.*,
           (SELECT COUNT(*)::int FROM academy_core.questions q WHERE q.skill_track_id = st.id) AS question_count
         FROM academy_core.skill_tracks st
         WHERE st.is_active = true
         ORDER BY st.sort_order, st.name->>'fr'`,
      );
    }
    return reply.send({ success: true, data: rows });
  });

  // GET /skills/tracks/:code — track detail with domain list
  app.get('/tracks/:code', async (req: any, reply) => {
    const track = await queryOne<any>(
      `SELECT st.*,
         (SELECT COUNT(*)::int FROM academy_core.questions q WHERE q.skill_track_id = st.id) AS question_count
       FROM academy_core.skill_tracks st
       WHERE st.code = $1 AND st.is_active = true`,
      [req.params.code],
    );
    if (!track) return reply.code(404).send({ success: false, error: 'Track not found' });
    return reply.send({ success: true, data: track });
  });

  // GET /skills/formats — list test formats
  app.get('/formats', async (req: any, reply) => {
    const tenantId = req.headers['x-tenant-id'] || null;
    let rows;
    if (tenantId) {
      rows = await query(
        `SELECT * FROM academy_core.skill_test_formats
         WHERE tenant_id = $1 AND is_active = true ORDER BY sort_order`,
        [tenantId],
      );
    } else {
      rows = await query(
        `SELECT * FROM academy_core.skill_test_formats WHERE is_active = true ORDER BY sort_order`,
      );
    }
    return reply.send({ success: true, data: rows });
  });

  // =========================================================================
  // AUTHENTICATED — take tests
  // =========================================================================

  // POST /skills/start — start a skill test
  app.post('/start', {
    schema: { summary: 'Start a skill test', tags: ['Skills'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(startTestSchema, req.body);
    const userId = req.user.sub;
    const tenantId = req.user.tenantId;

    // Load track
    const track = await queryOne<any>(
      `SELECT * FROM academy_core.skill_tracks
       WHERE code = $1 AND tenant_id = $2 AND is_active = true`,
      [data.trackCode, tenantId],
    );
    if (!track) return reply.code(404).send({ success: false, error: 'Track not found' });

    // Load format
    const format = await queryOne<any>(
      `SELECT * FROM academy_core.skill_test_formats
       WHERE code = $1 AND tenant_id = $2 AND is_active = true`,
      [data.format, tenantId],
    );
    if (!format) return reply.code(400).send({ success: false, error: 'Unknown test format' });

    // Check format applicability
    if (!format.applicable_to.includes(track.kind)) {
      return reply.code(400).send({ success: false, error: 'Format not available for this track type' });
    }

    // Determine question count and duration
    let questionCount = format.question_count;
    let durationSec = format.duration_sec;
    const isCert = track.kind === 'cert';

    if (isCert && data.format === 'certif') {
      // Full certification exam: all questions, exam duration
      const totalQ = await queryOne<any>(
        `SELECT COUNT(*)::int AS count FROM academy_core.questions WHERE skill_track_id = $1`,
        [track.id],
      );
      questionCount = totalQ?.count || 60;
      durationSec = track.exam_duration_sec || 7200;
    } else if (isCert && data.format === 'decouverte') {
      // Discovery: proportional duration
      const totalQ = await queryOne<any>(
        `SELECT COUNT(*)::int AS count FROM academy_core.questions WHERE skill_track_id = $1`,
        [track.id],
      );
      const allCount = totalQ?.count || 60;
      durationSec = Math.max(600, Math.round((track.exam_duration_sec || 7200) * questionCount / allCount / 300) * 300);
    }

    // Check user wallet for credits/free tests
    let wallet = await queryOne<any>(
      `SELECT * FROM academy_core.user_wallets
       WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    let via: string | null = null;
    let unlocked = true;

    if (wallet?.unlimited_until && new Date(wallet.unlimited_until) > new Date()) {
      via = 'unlimited';
    } else if (format.is_free) {
      if (wallet && wallet.free_tests > 0) {
        await query(
          `UPDATE academy_core.user_wallets SET free_tests = free_tests - 1
           WHERE user_id = $1 AND tenant_id = $2 AND free_tests > 0`,
          [userId, tenantId],
        );
        via = 'free';
        unlocked = false; // free tests have locked results
      } else {
        via = 'free';
        unlocked = false;
      }
    } else if (wallet && wallet.credits > 0) {
      await query(
        `UPDATE academy_core.user_wallets SET credits = credits - 1
         WHERE user_id = $1 AND tenant_id = $2 AND credits > 0`,
        [userId, tenantId],
      );
      via = 'credit';
    }

    if (!via) {
      return reply.code(402).send({
        success: false,
        error: format.is_free
          ? 'Free tests exhausted. Choose an offer to continue.'
          : 'This test requires a paid offer.',
        code: 'payment_required',
      });
    }

    // Select questions (stratified by domain)
    const { questionIds, questions } = await selectSkillQuestions(track.id, questionCount);

    if (questionIds.length === 0) {
      return reply.code(500).send({ success: false, error: 'No questions available for this track' });
    }

    // Create attempt
    const token = randomBytes(16).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const attempt = await queryOne<any>(`
      INSERT INTO academy_core.assessment_attempts
        (user_id, assessment_id, skill_track_id, format, question_order,
         via, unlocked, token_hash, started_at)
      VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, started_at`,
      [userId, track.id, data.format, questionIds, via, unlocked, tokenHash],
    );

    return reply.code(201).send({
      success: true,
      data: {
        attemptId: attempt.id,
        token,
        startedAt: attempt.started_at,
        durationSec,
        questionCount: questionIds.length,
        questions,
        trackName: track.name,
        format: data.format,
        via,
      },
    });
  });

  // POST /skills/submit — submit answers
  app.post('/submit', {
    schema: { summary: 'Submit skill test answers', tags: ['Skills'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(submitTestSchema, req.body);
    const userId = req.user.sub;

    // Load attempt
    const attempt = await queryOne<any>(
      `SELECT * FROM academy_core.assessment_attempts
       WHERE id = $1 AND user_id = $2`,
      [data.attemptId, userId],
    );
    if (!attempt) return reply.code(404).send({ success: false, error: 'Attempt not found' });

    // Verify token
    const tokenHash = createHash('sha256').update(data.token).digest('hex');
    if (attempt.token_hash !== tokenHash) {
      return reply.code(403).send({ success: false, error: 'Invalid token' });
    }

    // Already submitted?
    if (attempt.submitted_at) {
      return reply.code(409).send({ success: false, error: 'Test already submitted' });
    }

    // Load track for domain weights
    const track = attempt.skill_track_id
      ? await queryOne<any>('SELECT * FROM academy_core.skill_tracks WHERE id = $1', [attempt.skill_track_id])
      : null;

    const isCert = track?.kind === 'cert';
    const weights = track?.weights || {};

    // Filter valid answers (only for questions in the order)
    const order: string[] = attempt.question_order || [];
    const validAnswers: Record<string, number> = {};
    for (const [qId, val] of Object.entries(data.answers)) {
      if (order.includes(qId) && typeof val === 'number' && val >= -1 && val <= 3) {
        validAnswers[qId] = val;
      }
    }

    // Score
    const result = await scoreSkillAttempt(order, validAnswers, weights, isCert);
    const timeTaken = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);

    // Generate cert code if unlocked
    let certCode: string | null = null;
    if (attempt.unlocked) {
      for (let i = 0; i < 5; i++) {
        const code = 'TN-' + randomBytes(2).toString('hex').toUpperCase() + '-' + randomBytes(2).toString('hex').toUpperCase();
        const exists = await queryOne('SELECT cert_code FROM academy_core.assessment_attempts WHERE cert_code = $1', [code]);
        if (!exists) { certCode = code; break; }
      }
    }

    // Update attempt
    await query(`
      UPDATE academy_core.assessment_attempts
      SET submitted_at = NOW(),
          answers = $1,
          score = $2,
          passed = $3,
          time_taken_seconds = $4,
          tab_switches = $5,
          time_up = $6,
          skill_level = $7,
          readiness = $8,
          domain_scores = $9,
          cert_code = $10
      WHERE id = $11`,
      [
        JSON.stringify(validAnswers),
        result.percentage,
        result.passed,
        timeTaken,
        data.tabSwitches,
        data.timeUp,
        result.skillLevel,
        result.readiness,
        JSON.stringify(result.domains),
        certCode,
        attempt.id,
      ],
    );

    // Build response
    const response: any = {
      attemptId: attempt.id,
      score: {
        percentage: result.percentage,
        correct: result.totalScore,
        max: result.maxScore,
        total: order.length,
        skillLevel: result.skillLevel,
        readiness: result.readiness,
        readinessLevel: result.readinessLevel,
      },
      domains: result.domains,
      timeTakenSeconds: timeTaken,
      tabSwitches: data.tabSwitches,
      certCode,
      unlocked: attempt.unlocked,
    };

    // Include corrections if unlocked
    if (attempt.unlocked) {
      response.key = await getAnswerKey(order);
    }

    try {
      await publishEvent(
        TOPICS.ASSESSMENT_COMPLETED,
        {
          attemptId: attempt.id,
          skillTrackId: attempt.skill_track_id,
          percentage: result.percentage,
          skillLevel: result.skillLevel,
          passed: result.passed,
        },
        req.user.tenantId,
        userId,
      );
    } catch { /* non-blocking */ }

    return reply.send({ success: true, data: response });
  });

  // GET /skills/result/:attemptId — get result detail
  app.get('/result/:attemptId', {
    schema: { summary: 'Get skill test result', tags: ['Skills'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const attempt = await queryOne<any>(
      `SELECT a.*, st.name AS track_name, st.kind AS track_kind, st.domains AS track_domains
       FROM academy_core.assessment_attempts a
       LEFT JOIN academy_core.skill_tracks st ON st.id = a.skill_track_id
       WHERE a.id = $1 AND (a.user_id = $2 OR $3 = true)`,
      [req.params.attemptId, req.user.sub, req.user.role?.includes('admin')],
    );
    if (!attempt) return reply.code(404).send({ success: false, error: 'Result not found' });

    const result: any = {
      id: attempt.id,
      trackName: attempt.track_name,
      trackKind: attempt.track_kind,
      format: attempt.format,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      timeTakenSeconds: attempt.time_taken_seconds,
      tabSwitches: attempt.tab_switches,
      timeUp: attempt.time_up,
      score: attempt.score,
      skillLevel: attempt.skill_level,
      readiness: attempt.readiness,
      domains: attempt.domain_scores,
      trackDomains: attempt.track_domains,
      certCode: attempt.unlocked ? attempt.cert_code : null,
      unlocked: attempt.unlocked,
      via: attempt.via,
      passed: attempt.passed,
    };

    // Include corrections if unlocked
    if (attempt.unlocked && attempt.question_order) {
      result.key = await getAnswerKey(attempt.question_order);
      result.answers = attempt.answers;
      result.questionOrder = attempt.question_order;
    }

    return reply.send({ success: true, data: result });
  });

  // GET /skills/history — user's skill test history
  app.get('/history', {
    schema: { summary: 'Skill test history', tags: ['Skills'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const rows = await query(
      `SELECT a.id, a.format, a.started_at, a.submitted_at, a.score, a.passed,
              a.skill_level, a.readiness, a.unlocked, a.cert_code, a.via,
              a.time_taken_seconds, a.tab_switches,
              st.code AS track_code, st.name AS track_name, st.kind AS track_kind
       FROM academy_core.assessment_attempts a
       JOIN academy_core.skill_tracks st ON st.id = a.skill_track_id
       WHERE a.user_id = $1 AND a.skill_track_id IS NOT NULL
       ORDER BY a.started_at DESC LIMIT 200`,
      [req.user.sub],
    );
    return reply.send({ success: true, data: rows });
  });

  // GET /skills/result/:attemptId/recommendations — course suggestions for weak domains
  app.get('/result/:attemptId/recommendations', {
    schema: { summary: 'Course recommendations based on test results', tags: ['Skills'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const attempt = await queryOne<any>(
      `SELECT a.domain_scores, a.skill_track_id, st.code AS track_code, st.domains AS track_domains
       FROM academy_core.assessment_attempts a
       LEFT JOIN academy_core.skill_tracks st ON st.id = a.skill_track_id
       WHERE a.id = $1 AND (a.user_id = $2 OR $3 = true)`,
      [req.params.attemptId, req.user.sub, req.user.role?.includes('admin')],
    );
    if (!attempt || !attempt.domain_scores) {
      return reply.send({ success: true, data: { weakDomains: [], courses: [] } });
    }

    // Identify weak domains (score < 70%)
    const domainScores = typeof attempt.domain_scores === 'string'
      ? JSON.parse(attempt.domain_scores) : attempt.domain_scores;
    const trackDomains = typeof attempt.track_domains === 'string'
      ? JSON.parse(attempt.track_domains) : (attempt.track_domains || {});

    const weakDomains: Array<{ code: string; label: string; pct: number }> = [];
    for (const [code, data] of Object.entries(domainScores as Record<string, any>)) {
      if (data.pct < 70) {
        weakDomains.push({
          code,
          label: trackDomains[code] || code,
          pct: data.pct,
        });
      }
    }
    weakDomains.sort((a, b) => a.pct - b.pct); // weakest first

    // Search courses that match weak domain tags or track code
    const searchTags = [
      attempt.track_code,
      ...weakDomains.map(d => d.code),
    ];

    const courses = await query(
      `SELECT id, title, description, slug, level, status, thumbnail_url, estimated_hours, tags
       FROM academy_core.courses
       WHERE status = 'published' AND tags && $1::text[]
       ORDER BY
         CASE level WHEN 'beginner' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 ELSE 4 END
       LIMIT 10`,
      [searchTags],
    );

    // If no tag-matched courses, return general courses
    let recommendedCourses = courses;
    if (courses.length === 0) {
      recommendedCourses = await query(
        `SELECT id, title, description, slug, level, status, thumbnail_url, estimated_hours, tags
         FROM academy_core.courses
         WHERE status = 'published'
         ORDER BY created_at DESC
         LIMIT 6`,
      );
    }

    return reply.send({
      success: true,
      data: {
        weakDomains,
        courses: recommendedCourses,
        trackCode: attempt.track_code,
      },
    });
  });

  // GET /skills/verify/:certCode — public verification
  app.get('/verify/:certCode', async (req: any, reply) => {
    const attempt = await queryOne<any>(
      `SELECT a.*, st.name AS track_name, st.kind AS track_kind,
              u.first_name, u.last_name
       FROM academy_core.assessment_attempts a
       JOIN academy_core.skill_tracks st ON st.id = a.skill_track_id
       JOIN academy_core.users u ON u.id = a.user_id
       WHERE a.cert_code = $1 AND a.unlocked = true AND a.submitted_at IS NOT NULL`,
      [req.params.certCode.toUpperCase()],
    );
    if (!attempt) return reply.send({ success: true, data: { valid: false } });

    return reply.send({
      success: true,
      data: {
        valid: true,
        name: `${attempt.first_name} ${attempt.last_name}`,
        track: attempt.track_name,
        kind: attempt.track_kind,
        format: attempt.format,
        date: attempt.submitted_at,
        percentage: attempt.score,
        skillLevel: attempt.skill_level,
        readiness: attempt.readiness,
        certCode: attempt.cert_code,
        domains: attempt.domain_scores,
      },
    });
  });
}
