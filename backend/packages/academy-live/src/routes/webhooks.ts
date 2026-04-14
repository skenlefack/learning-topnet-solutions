// ============================================================================
// ARIS Academy — BBB Webhook Handler
// POST /webhooks/bbb — Receives callbacks from BigBlueButton server
// No auth required (BBB signs webhooks with shared secret checksum)
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { query, queryOne, publishEvent, TOPICS } from '@aris-academy/shared';
import { processRecording } from '../services/recording-processor';

const BBB_SECRET = process.env.BBB_SECRET || 'bbb-shared-secret';

// ---------------------------------------------------------------------------
// Checksum validation — BBB signs webhook payloads with SHA-1(callbackData + secret)
// ---------------------------------------------------------------------------

function validateWebhookChecksum(payload: string, receivedChecksum: string): boolean {
  const expected = createHash('sha1')
    .update(payload + BBB_SECRET)
    .digest('hex');
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== receivedChecksum.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ receivedChecksum.charCodeAt(i);
  }
  return mismatch === 0;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleMeetingEnded(
  data: Record<string, any>,
  log: FastifyInstance['log'],
): Promise<void> {
  const meetingId = data.meetingID || data.meeting_id;
  if (!meetingId) {
    log.warn('[BBB Webhook] meeting-ended event missing meetingID');
    return;
  }

  log.info(`[BBB Webhook] meeting-ended for ${meetingId}`);

  const session = await queryOne(
    'SELECT * FROM academy_core.live_sessions WHERE bbb_meeting_id = $1',
    [meetingId],
  );

  if (!session) {
    log.warn(`[BBB Webhook] No session found for meeting ${meetingId}`);
    return;
  }

  // Update session status to ended
  await query(`
    UPDATE academy_core.live_sessions
    SET status = 'ended', updated_at = NOW()
    WHERE id = $1 AND status = 'live'
  `, [session.id]);

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
    meetingId,
    courseId: session.course_id,
    endedAt: new Date().toISOString(),
  }, session.tenant_id, session.trainer_id);

  log.info(`[BBB Webhook] Session ${session.id} marked as ended`);
}

async function handleRecordingReady(
  data: Record<string, any>,
  log: FastifyInstance['log'],
): Promise<void> {
  const meetingId = data.meetingID || data.meeting_id;
  const recordId = data.recordID || data.record_id;
  const recordingUrl = data.playback?.format?.url || data.url || data.recordingURL;
  const duration = data.playback?.format?.length
    || data.duration
    || data.length;
  const format = data.playback?.format?.type || data.format || 'presentation';

  if (!meetingId) {
    log.warn('[BBB Webhook] recording-ready event missing meetingID');
    return;
  }

  log.info(`[BBB Webhook] recording-ready for meeting ${meetingId}, record ${recordId}`);

  const session = await queryOne(
    'SELECT * FROM academy_core.live_sessions WHERE bbb_meeting_id = $1',
    [meetingId],
  );

  if (!session) {
    log.warn(`[BBB Webhook] No session found for meeting ${meetingId}`);
    return;
  }

  // Store recording duration if provided
  if (duration) {
    await query(
      'UPDATE academy_core.live_sessions SET recording_duration_seconds = $2, updated_at = NOW() WHERE id = $1',
      [session.id, typeof duration === 'number' ? duration : parseInt(duration, 10)],
    );
  }

  // Process recording asynchronously (download from BBB -> upload to MinIO -> create replay lesson)
  if (recordingUrl) {
    processRecording(session.id, recordingUrl).catch(err => {
      log.error({ err }, `[BBB Webhook] Recording processing failed for session ${session.id}`);
    });
  }

  // Publish Kafka event for downstream consumers
  await publishEvent('academy.live.recording-ready', {
    sessionId: session.id,
    meetingId,
    recordId,
    format,
    url: recordingUrl,
    duration,
    courseId: session.course_id,
  }, session.tenant_id, session.trainer_id);

  log.info(`[BBB Webhook] Recording ready event processed for session ${session.id}`);
}

async function handleUserJoined(
  data: Record<string, any>,
  log: FastifyInstance['log'],
): Promise<void> {
  const meetingId = data.meetingID || data.meeting_id;
  const externalUserId = data.externalUserID || data.userID || data.user_id;

  if (!meetingId || !externalUserId) {
    log.warn('[BBB Webhook] user-joined event missing meetingID or userID');
    return;
  }

  log.info(`[BBB Webhook] user-joined: user ${externalUserId} in meeting ${meetingId}`);

  const session = await queryOne(
    'SELECT id FROM academy_core.live_sessions WHERE bbb_meeting_id = $1',
    [meetingId],
  );

  if (!session) {
    log.warn(`[BBB Webhook] No session found for meeting ${meetingId}`);
    return;
  }

  // Upsert attendance record with fresh joined_at timestamp
  await queryOne(`
    INSERT INTO academy_core.live_attendance (session_id, user_id, joined_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (session_id, user_id)
    DO UPDATE SET joined_at = NOW(), left_at = NULL, duration_seconds = NULL
    RETURNING *
  `, [session.id, externalUserId]);

  // Update attendee count on the session
  await query(`
    UPDATE academy_core.live_sessions SET
      attendee_count = (SELECT COUNT(*) FROM academy_core.live_attendance WHERE session_id = $1 AND left_at IS NULL),
      updated_at = NOW()
    WHERE id = $1
  `, [session.id]);

  log.info(`[BBB Webhook] Attendance recorded for user ${externalUserId} in session ${session.id}`);
}

async function handleUserLeft(
  data: Record<string, any>,
  log: FastifyInstance['log'],
): Promise<void> {
  const meetingId = data.meetingID || data.meeting_id;
  const externalUserId = data.externalUserID || data.userID || data.user_id;

  if (!meetingId || !externalUserId) {
    log.warn('[BBB Webhook] user-left event missing meetingID or userID');
    return;
  }

  log.info(`[BBB Webhook] user-left: user ${externalUserId} from meeting ${meetingId}`);

  const session = await queryOne(
    'SELECT id FROM academy_core.live_sessions WHERE bbb_meeting_id = $1',
    [meetingId],
  );

  if (!session) {
    log.warn(`[BBB Webhook] No session found for meeting ${meetingId}`);
    return;
  }

  // Update attendance record with leave time and computed duration
  await query(`
    UPDATE academy_core.live_attendance SET
      left_at = NOW(),
      duration_seconds = EXTRACT(EPOCH FROM (NOW() - joined_at))::INTEGER
    WHERE session_id = $1 AND user_id = $2 AND left_at IS NULL
  `, [session.id, externalUserId]);

  // Update attendee count (only currently-connected users)
  await query(`
    UPDATE academy_core.live_sessions SET
      attendee_count = (SELECT COUNT(*) FROM academy_core.live_attendance WHERE session_id = $1 AND left_at IS NULL),
      updated_at = NOW()
    WHERE id = $1
  `, [session.id]);

  log.info(`[BBB Webhook] User ${externalUserId} left session ${session.id}`);
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function webhookRoutes(app: FastifyInstance) {

  // ==========================================================================
  // POST /webhooks/bbb — Main BBB webhook endpoint
  // ==========================================================================
  app.post('/bbb', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;

    // --- Checksum validation ---
    // BBB typically sends the checksum in a query param or in the body
    const receivedChecksum = (req.query as any)?.checksum
      || body?.checksum
      || (req.headers['x-bbb-checksum'] as string);

    if (receivedChecksum) {
      // Build the payload string for verification
      // BBB sends the raw callback data; we verify against the stringified body
      const payloadString = typeof body === 'string' ? body : JSON.stringify(body);
      if (!validateWebhookChecksum(payloadString, receivedChecksum)) {
        app.log.warn('[BBB Webhook] Invalid checksum — rejecting request');
        return reply.code(403).send({ success: false, error: 'Invalid webhook checksum' });
      }
    } else {
      // In production, reject unsigned webhooks; in dev, allow for testing
      if (process.env.NODE_ENV === 'production') {
        app.log.warn('[BBB Webhook] Missing checksum in production — rejecting');
        return reply.code(403).send({ success: false, error: 'Missing webhook checksum' });
      }
      app.log.warn('[BBB Webhook] No checksum provided — allowing in non-production mode');
    }

    // --- Event routing ---
    // BBB webhook events can come as an array or single event
    const events = Array.isArray(body?.events) ? body.events : [body];

    for (const event of events) {
      const eventType = event?.event || event?.header?.name || event?.type || 'unknown';
      const eventData = event?.data || event?.attributes || event || {};

      try {
        switch (eventType) {
          case 'meeting-ended':
          case 'meeting_destroyed_event':
          case 'MeetingEndedEvtMsg':
            await handleMeetingEnded(eventData, app.log);
            break;

          case 'recording-ready':
          case 'rap-publish-ended':
          case 'RecordingStatusChangedEvtMsg':
            await handleRecordingReady(eventData, app.log);
            break;

          case 'user-joined':
          case 'user_joined_message':
          case 'UserJoinedMeetingEvtMsg':
            await handleUserJoined(eventData, app.log);
            break;

          case 'user-left':
          case 'user_left_message':
          case 'UserLeftMeetingEvtMsg':
            await handleUserLeft(eventData, app.log);
            break;

          default:
            app.log.info(`[BBB Webhook] Unhandled event type: ${eventType}`);
            break;
        }
      } catch (err) {
        app.log.error({ err, eventType }, '[BBB Webhook] Error processing event');
        // Continue processing remaining events even if one fails
      }
    }

    // Always return 200 to acknowledge receipt (BBB will retry on non-2xx)
    return reply.send({ success: true });
  });

  // ==========================================================================
  // GET /webhooks/health — Health check for webhook endpoint
  // ==========================================================================
  app.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ success: true, service: 'bbb-webhooks', status: 'ok' });
  });
}
