// ============================================================================
// ARIS Academy — Live Session Routes
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  query, queryOne, publishEvent, paginate, TOPICS,
  UuidParam, PaginationQuery, MultiLangTextSchema, BearerSecurity,
} from '@aris-academy/shared';
import { bbbClient } from '../services/bbb-client';
import { processRecording } from '../services/recording-processor';

// ---------------------------------------------------------------------------
// Mock data for when DB is unavailable
// ---------------------------------------------------------------------------
const MOCK_SESSIONS = [
  {
    id: 'mock-session-1',
    title: { fr: 'Formation ARIS 3.0 — Introduction', en: 'ARIS 3.0 Training — Introduction' },
    description: { fr: 'Session de formation introductive' },
    status: 'scheduled',
    scheduled_at: new Date(Date.now() + 2 * 86400000).toISOString(),
    duration_minutes: 90,
    max_participants: 300,
    trainer_first_name: 'Dr. Amina',
    trainer_last_name: 'Diallo',
    course_title: { fr: 'Introduction à ARIS 3.0' },
    current_attendees: 0,
    registered_count: 45,
  },
  {
    id: 'mock-session-2',
    title: { fr: 'Atelier surveillance épidémiologique', en: 'Epidemiological Surveillance Workshop' },
    description: { fr: 'Atelier pratique de surveillance' },
    status: 'scheduled',
    scheduled_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    duration_minutes: 120,
    max_participants: 200,
    trainer_first_name: 'Prof. Kofi',
    trainer_last_name: 'Mensah',
    course_title: { fr: 'Surveillance épidémiologique' },
    current_attendees: 0,
    registered_count: 28,
  },
];

export async function sessionRoutes(app: FastifyInstance) {

  // ==========================================================================
  // GET /sessions — List upcoming & live sessions
  // ==========================================================================
  app.get('/', {
    schema: {
      summary: 'List upcoming & live sessions',
      tags: ['Sessions'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = req.user;
      const sessions = await query(`
        SELECT ls.*,
          u.first_name AS trainer_first_name, u.last_name AS trainer_last_name,
          c.title AS course_title,
          (SELECT COUNT(*) FROM academy_core.live_attendance la WHERE la.session_id = ls.id) AS current_attendees
        FROM academy_core.live_sessions ls
        JOIN academy_core.users u ON u.id = ls.trainer_id
        LEFT JOIN academy_core.courses c ON c.id = ls.course_id
        WHERE ls.status IN ('scheduled', 'live')
          AND (ls.tenant_id = $1 OR ls.tenant_id = '00000000-0000-0000-0000-000000000001')
        ORDER BY ls.scheduled_at ASC
      `, [user.tenantId]);
      return reply.send({ success: true, data: sessions });
    } catch (err: any) {
      console.warn(`[academy-live] DB unavailable, returning mock sessions: ${err.message}`);
      return reply.send({ success: true, data: MOCK_SESSIONS });
    }
  });

  // ==========================================================================
  // GET /sessions/upcoming — Sessions in the next 7 days
  // ==========================================================================
  app.get('/upcoming', {
    schema: {
      summary: 'Sessions in the next 7 days',
      tags: ['Sessions'],
      security: BearerSecurity,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = req.user;
      const sessions = await query(`
        SELECT ls.*,
          u.first_name AS trainer_first_name, u.last_name AS trainer_last_name,
          c.title AS course_title,
          (SELECT COUNT(*) FROM academy_core.live_attendance la WHERE la.session_id = ls.id) AS registered_count
        FROM academy_core.live_sessions ls
        JOIN academy_core.users u ON u.id = ls.trainer_id
        LEFT JOIN academy_core.courses c ON c.id = ls.course_id
        WHERE ls.status = 'scheduled'
          AND ls.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
          AND (ls.tenant_id = $1 OR ls.tenant_id = '00000000-0000-0000-0000-000000000001')
        ORDER BY ls.scheduled_at ASC
      `, [user.tenantId]);
      return reply.send({ success: true, data: sessions });
    } catch (err: any) {
      console.warn(`[academy-live] DB unavailable, returning mock upcoming sessions: ${err.message}`);
      return reply.send({ success: true, data: MOCK_SESSIONS });
    }
  });

  // ==========================================================================
  // GET /sessions/recordings — All sessions with recordings
  // ==========================================================================
  app.get('/recordings', {
    schema: {
      summary: 'All sessions with recordings (paginated)',
      tags: ['Sessions'],
      security: BearerSecurity,
      querystring: PaginationQuery,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    const qs = req.query as { page?: string; limit?: string };
    const page = Math.max(parseInt(qs.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(qs.limit || '20', 10), 1), 100);

    const result = await paginate(
      `SELECT ls.id, ls.title, ls.recording_url, ls.recording_duration_seconds,
              ls.scheduled_at, ls.course_id, ls.trainer_id,
              u.first_name AS trainer_first_name, u.last_name AS trainer_last_name,
              c.title AS course_title
       FROM academy_core.live_sessions ls
       JOIN academy_core.users u ON u.id = ls.trainer_id
       LEFT JOIN academy_core.courses c ON c.id = ls.course_id
       WHERE ls.recording_url IS NOT NULL
         AND (ls.tenant_id = $1 OR ls.tenant_id = '00000000-0000-0000-0000-000000000001')
       ORDER BY ls.scheduled_at DESC`,
      [user.tenantId],
      page,
      limit,
    );

    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  // ==========================================================================
  // GET /sessions/:id — Session detail with attendance stats
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Get session detail',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const session = await queryOne(`
      SELECT ls.*,
        u.first_name AS trainer_first_name, u.last_name AS trainer_last_name,
        c.title AS course_title,
        (SELECT COUNT(*) FROM academy_core.live_attendance la WHERE la.session_id = ls.id) AS total_attendees,
        (SELECT COUNT(*) FROM academy_core.live_attendance la WHERE la.session_id = ls.id AND la.left_at IS NULL AND ls.status = 'live') AS current_attendees,
        (SELECT AVG(la.duration_seconds) FROM academy_core.live_attendance la WHERE la.session_id = ls.id AND la.duration_seconds IS NOT NULL) AS avg_duration_seconds
      FROM academy_core.live_sessions ls
      JOIN academy_core.users u ON u.id = ls.trainer_id
      LEFT JOIN academy_core.courses c ON c.id = ls.course_id
      WHERE ls.id = $1
    `, [req.params.id]);

    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    // Check BBB status if session is live
    let bbbInfo = null;
    if (session.status === 'live' && session.bbb_meeting_id) {
      try {
        bbbInfo = await bbbClient.getMeetingInfo(session.bbb_meeting_id);
      } catch {
        // BBB unavailable — graceful degradation
      }
    }

    return reply.send({ success: true, data: { ...session, bbbInfo } });
  });

  // ==========================================================================
  // POST /sessions — Schedule a new session
  // ==========================================================================
  app.post('/', {
    schema: {
      summary: 'Schedule a new session',
      tags: ['Sessions'],
      security: BearerSecurity,
      body: {
        type: 'object' as const,
        required: ['title', 'scheduledAt'],
        properties: {
          title: MultiLangTextSchema,
          description: MultiLangTextSchema,
          courseId: { type: 'string', format: 'uuid' },
          scheduledAt: { type: 'string', format: 'date-time' },
          durationMinutes: { type: 'integer', default: 60 },
          maxParticipants: { type: 'integer', default: 300 },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const body = req.body as any;
    const meetingId = `aris-academy-${Date.now()}`;

    const session = await queryOne(`
      INSERT INTO academy_core.live_sessions
        (course_id, title, description, trainer_id, tenant_id, status, bbb_meeting_id, scheduled_at, duration_minutes, max_participants)
      VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9) RETURNING *
    `, [
      body.courseId, JSON.stringify(body.title), JSON.stringify(body.description),
      user.sub, user.tenantId, meetingId, body.scheduledAt,
      body.durationMinutes || 60, body.maxParticipants || 300,
    ]);

    await publishEvent(TOPICS.LIVE_SCHEDULED, session, user.tenantId, user.sub);
    return reply.code(201).send({ success: true, data: session });
  });

  // ==========================================================================
  // PUT /sessions/:id — Update a planned session
  // ==========================================================================
  app.put<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Update a planned session',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
      body: {
        type: 'object' as const,
        properties: {
          title: MultiLangTextSchema,
          description: MultiLangTextSchema,
          courseId: { type: 'string', format: 'uuid' },
          scheduledAt: { type: 'string', format: 'date-time' },
          durationMinutes: { type: 'integer' },
          maxParticipants: { type: 'integer' },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const existing = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!existing) return reply.code(404).send({ success: false, error: 'Session not found' });

    // Only scheduled sessions can be modified
    if (existing.status !== 'scheduled') {
      return reply.code(409).send({ success: false, error: 'Only scheduled sessions can be modified' });
    }

    // Only the trainer or admins can edit
    if (user.sub !== existing.trainer_id && !['admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Only the trainer or admins can modify this session' });
    }

    const body = req.body as any;

    const updated = await queryOne(`
      UPDATE academy_core.live_sessions SET
        title = COALESCE($2, title),
        description = COALESCE($3, description),
        scheduled_at = COALESCE($4, scheduled_at),
        duration_minutes = COALESCE($5, duration_minutes),
        max_participants = COALESCE($6, max_participants),
        course_id = COALESCE($7, course_id),
        updated_at = NOW()
      WHERE id = $1 RETURNING *
    `, [
      req.params.id,
      body.title ? JSON.stringify(body.title) : null,
      body.description ? JSON.stringify(body.description) : null,
      body.scheduledAt || null,
      body.durationMinutes || null,
      body.maxParticipants || null,
      body.courseId || null,
    ]);

    return reply.send({ success: true, data: updated });
  });

  // ==========================================================================
  // DELETE /sessions/:id — Cancel a session (notify registered participants)
  // ==========================================================================
  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Cancel a session',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;
    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    // Only the trainer or admins can cancel
    if (user.sub !== session.trainer_id && !['admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    // If session is live on BBB, end it first
    if (session.status === 'live' && session.bbb_meeting_id) {
      try {
        await bbbClient.endMeeting(session.bbb_meeting_id);
      } catch {
        // BBB might already be down, continue with cancellation
      }
    }

    await queryOne(
      "UPDATE academy_core.live_sessions SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *",
      [req.params.id],
    );

    // Fetch registered participants to notify them
    const attendees = await query(
      'SELECT user_id FROM academy_core.live_attendance WHERE session_id = $1',
      [req.params.id],
    );

    // Notify each registered participant via ARIS Message Service
    for (const att of attendees) {
      await publishEvent('academy.notification.session_cancelled', {
        sessionId: session.id,
        sessionTitle: session.title,
        scheduledAt: session.scheduled_at,
        userId: att.user_id,
      }, session.tenant_id, user.sub);
    }

    reply.header('X-Notified-Count', String(attendees.length));
    return reply.code(204).send();
  });

  // ==========================================================================
  // GET /sessions/:id/join — Get BBB join URL
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id/join', {
    schema: {
      summary: 'Get BBB join URL',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;
    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    if (session.status === 'cancelled') {
      return reply.code(410).send({ success: false, error: 'Session has been cancelled' });
    }

    const isModerator = user.sub === session.trainer_id ||
      ['admin_rec', 'admin_continental'].includes(user.role);

    // Non-moderators must be enrolled in the linked course (if course_id is set)
    if (!isModerator && session.course_id) {
      const enrollment = await queryOne(
        "SELECT id FROM academy_core.enrollments WHERE user_id = $1 AND course_id = $2 AND status = 'active'",
        [user.sub, session.course_id],
      );
      if (!enrollment) {
        return reply.code(403).send({
          success: false,
          error: 'You must be enrolled in the course to join this live session',
        });
      }
    }

    // Create or recreate meeting on BBB if needed
    let needsCreate = session.status === 'scheduled';

    // If session is 'live', verify the meeting still exists on BBB (it may have expired)
    if (session.status === 'live') {
      try {
        const running = await bbbClient.isMeetingRunning(session.bbb_meeting_id);
        if (!running) {
          // Meeting expired on BBB — recreate it
          app.log.info({ meetingId: session.bbb_meeting_id }, '[BBB] Meeting expired, recreating');
          needsCreate = true;
        }
      } catch {
        // getMeetingInfo/isMeetingRunning failed — meeting likely gone, recreate
        needsCreate = true;
      }
    }

    if (needsCreate) {
      const sessionTitle = typeof session.title === 'object'
        ? (session.title.fr || session.title.en)
        : session.title;

      try {
        const result = await bbbClient.createMeeting({
          meetingID: session.bbb_meeting_id,
          name: sessionTitle,
          record: true,
          maxParticipants: session.max_participants,
        });

        await query(`
          UPDATE academy_core.live_sessions
          SET status = 'live', bbb_internal_meeting_id = $2, updated_at = NOW()
          WHERE id = $1
        `, [session.id, result.internalMeetingId]);

        if (session.status === 'scheduled') {
          await publishEvent(TOPICS.LIVE_STARTED, { sessionId: session.id }, user.tenantId, user.sub);
        }
      } catch (err) {
        app.log.error({ err }, '[BBB] Failed to create meeting');
        return reply.code(503).send({
          success: false,
          error: 'BigBlueButton is temporarily unavailable. Please try again.',
        });
      }
    }

    // Generate join URL
    const fullName = `${(user as any).firstName || 'User'} ${(user as any).lastName || ''}`.trim();
    const joinUrl = bbbClient.joinMeeting(
      session.bbb_meeting_id,
      fullName,
      isModerator ? 'MODERATOR' : 'VIEWER',
      user.sub,
    );

    // Track attendance (upsert)
    await queryOne(`
      INSERT INTO academy_core.live_attendance (session_id, user_id)
      VALUES ($1, $2) ON CONFLICT (session_id, user_id) DO UPDATE SET joined_at = NOW()
      RETURNING *
    `, [session.id, user.sub]);

    // Update attendee count
    await query(`
      UPDATE academy_core.live_sessions SET
        attendee_count = (SELECT COUNT(*) FROM academy_core.live_attendance WHERE session_id = $1),
        updated_at = NOW()
      WHERE id = $1
    `, [session.id]);

    return reply.send({ success: true, data: { joinUrl, isModerator } });
  });

  // ==========================================================================
  // POST /sessions/:id/start — Start a BBB meeting for a scheduled session
  // ==========================================================================
  app.post<{ Params: { id: string } }>('/:id/start', {
    schema: {
      summary: 'Start a BBB meeting',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;

    // Only trainer/admins can start sessions
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    // Only the trainer or admins can start
    if (user.sub !== session.trainer_id && !['admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Only the trainer or admins can start this session' });
    }

    // Session must be in 'scheduled' status to start
    if (session.status === 'live') {
      return reply.code(409).send({ success: false, error: 'Session is already live' });
    }
    if (session.status !== 'scheduled') {
      return reply.code(409).send({ success: false, error: `Cannot start a session with status '${session.status}'` });
    }

    const sessionTitle = typeof session.title === 'object'
      ? (session.title.fr || session.title.en || 'ARIS Session')
      : (session.title || 'ARIS Session');

    try {
      const result = await bbbClient.createMeeting({
        meetingID: session.bbb_meeting_id,
        name: sessionTitle,
        record: true,
        maxParticipants: session.max_participants,
        welcomeMessage: `Bienvenue dans la session: ${sessionTitle}`,
      });

      const updated = await queryOne(`
        UPDATE academy_core.live_sessions
        SET status = 'live', bbb_internal_meeting_id = $2, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [session.id, result.internalMeetingId]);

      // Publish Kafka event
      await publishEvent(TOPICS.LIVE_STARTED, {
        sessionId: session.id,
        meetingId: session.bbb_meeting_id,
        courseId: session.course_id,
        trainerId: session.trainer_id,
        startedAt: new Date().toISOString(),
      }, user.tenantId, user.sub);

      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      app.log.error({ err }, '[BBB] Failed to create meeting for session start');
      return reply.code(503).send({
        success: false,
        error: 'BigBlueButton is temporarily unavailable. Please try again.',
      });
    }
  });

  // ==========================================================================
  // GET /sessions/:id/status — Real-time meeting status from BBB
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id/status', {
    schema: {
      summary: 'Real-time meeting status',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const session = await queryOne(
      'SELECT id, status, bbb_meeting_id, scheduled_at, duration_minutes FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    // Default response from DB state
    const statusData: Record<string, any> = {
      sessionId: session.id,
      dbStatus: session.status,
      isRunning: false,
      participantCount: 0,
      moderatorCount: 0,
      startTime: null,
      scheduledAt: session.scheduled_at,
      durationMinutes: session.duration_minutes,
    };

    // If session has a BBB meeting ID, try to get live status from BBB
    if (session.bbb_meeting_id) {
      try {
        const [isRunning, meetingInfo] = await Promise.allSettled([
          bbbClient.isMeetingRunning(session.bbb_meeting_id),
          bbbClient.getMeetingInfo(session.bbb_meeting_id),
        ]);

        statusData.isRunning = isRunning.status === 'fulfilled' ? isRunning.value : false;

        if (meetingInfo.status === 'fulfilled') {
          statusData.participantCount = meetingInfo.value.participantCount;
          statusData.moderatorCount = meetingInfo.value.moderatorCount;
          statusData.startTime = meetingInfo.value.startTime > 0
            ? new Date(meetingInfo.value.startTime).toISOString()
            : null;
        }
      } catch (err) {
        app.log.warn({ err }, '[BBB] Failed to get meeting status — returning DB state only');
        // Graceful degradation: return what we know from the DB
      }
    }

    return reply.send({ success: true, data: statusData });
  });

  // ==========================================================================
  // POST /sessions/:id/end — End a session
  // ==========================================================================
  app.post<{ Params: { id: string } }>('/:id/end', {
    schema: {
      summary: 'End a session',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;
    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    if (user.sub !== session.trainer_id && !['admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Only the trainer can end a session' });
    }

    // End meeting on BBB
    if (session.bbb_meeting_id) {
      try {
        await bbbClient.endMeeting(session.bbb_meeting_id);
      } catch (err) {
        app.log.error({ err }, '[BBB] Failed to end meeting');
      }
    }

    const updated = await queryOne(
      "UPDATE academy_core.live_sessions SET status = 'ended', updated_at = NOW() WHERE id = $1 RETURNING *",
      [session.id],
    );

    // Finalize attendance durations for participants still connected
    await query(`
      UPDATE academy_core.live_attendance SET
        left_at = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::INTEGER
      WHERE session_id = $1 AND left_at IS NULL
    `, [session.id]);

    // Publish Kafka event
    await publishEvent('academy.live.session-ended', {
      sessionId: session.id,
      meetingId: session.bbb_meeting_id,
      courseId: session.course_id,
      endedAt: new Date().toISOString(),
    }, session.tenant_id || user.tenantId, user.sub);

    return reply.send({ success: true, data: updated });
  });

  // ==========================================================================
  // GET /sessions/:id/attendance — Participant list with durations
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id/attendance', {
    schema: {
      summary: 'Participant list with durations',
      tags: ['Sessions'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;

    // Only trainer/admins can see full attendance
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );
    if (!session) return reply.code(404).send({ success: false, error: 'Session not found' });

    const attendance = await query(`
      SELECT la.user_id, la.joined_at, la.left_at, la.duration_seconds,
        u.first_name, u.last_name, u.email,
        CASE
          WHEN la.left_at IS NOT NULL THEN la.duration_seconds
          WHEN ls.status = 'live' THEN EXTRACT(EPOCH FROM (NOW() - la.joined_at))::INTEGER
          ELSE la.duration_seconds
        END AS effective_duration_seconds
      FROM academy_core.live_attendance la
      JOIN academy_core.users u ON u.id = la.user_id
      JOIN academy_core.live_sessions ls ON ls.id = la.session_id
      WHERE la.session_id = $1
      ORDER BY la.joined_at ASC
    `, [req.params.id]);

    const stats = {
      totalParticipants: attendance.length,
      avgDurationSeconds: attendance.length > 0
        ? Math.round(attendance.reduce((sum: number, a: any) => sum + (a.effective_duration_seconds || 0), 0) / attendance.length)
        : 0,
      sessionDurationMinutes: session.duration_minutes,
    };

    return reply.send({ success: true, data: { attendance, stats } });
  });

  // ==========================================================================
  // POST /webhooks/recording — BBB recording ready callback
  // ==========================================================================
  app.post('/webhooks/recording', {
    schema: {
      summary: 'BBB recording ready callback',
      tags: ['Sessions'],
      body: {
        type: 'object' as const,
        properties: {
          meetingID: { type: 'string' },
          recordingURL: { type: 'string' },
          duration: { type: 'integer' },
        },
      },
    },
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const { meetingID, recordingURL, duration } = req.body as any;
    app.log.info(`[BBB Webhook] Recording ready for ${meetingID}`);

    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE bbb_meeting_id = $1',
      [meetingID],
    );

    if (!session) {
      app.log.warn(`[BBB Webhook] No session found for meeting ${meetingID}`);
      return reply.code(404).send({ success: false, error: 'Session not found' });
    }

    // Update duration from BBB
    if (duration) {
      await query(
        'UPDATE academy_core.live_sessions SET recording_duration_seconds = $2, updated_at = NOW() WHERE id = $1',
        [session.id, duration],
      );
    }

    // Process recording asynchronously (download → MinIO → replay lesson)
    processRecording(session.id, recordingURL).catch(err => {
      app.log.error({ err }, `[RecordingProcessor] Async processing failed for session ${session.id}`);
    });

    return reply.send({ success: true });
  });
}
