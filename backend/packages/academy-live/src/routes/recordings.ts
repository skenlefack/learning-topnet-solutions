// ============================================================================
// ARIS Academy — Recording Routes
// Manage recorded sessions: list, stream, delete, per-session listings, process
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  query, queryOne, paginate, publishEvent,
  UuidParam, UuidParamNamed, PaginationQuery, BearerSecurity,
} from '@aris-academy/shared';
import { getPresignedUrl, deleteRecordingObject, processRecording } from '../services/recording-processor';
import { bbbClient } from '../services/bbb-client';

export async function recordingRoutes(app: FastifyInstance) {

  // ==========================================================================
  // GET /recordings — Paginated list of available recordings
  // ==========================================================================
  app.get('/', {
    schema: {
      summary: 'Paginated list of available recordings',
      tags: ['Recordings'],
      security: BearerSecurity,
      querystring: {
        type: 'object' as const,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          courseId: { type: 'string', format: 'uuid' },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = req.user;
    const qs = req.query as { page?: string; limit?: string; courseId?: string };
    const page = Math.max(parseInt(qs.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(qs.limit || '20', 10), 1), 100);

    let baseQuery = `
      SELECT ls.id, ls.title, ls.description, ls.recording_url,
             ls.recording_duration_seconds, ls.scheduled_at, ls.course_id,
             ls.trainer_id, ls.tenant_id,
             u.first_name AS trainer_first_name, u.last_name AS trainer_last_name,
             c.title AS course_title
      FROM academy_core.live_sessions ls
      JOIN academy_core.users u ON u.id = ls.trainer_id
      LEFT JOIN academy_core.courses c ON c.id = ls.course_id
      WHERE ls.recording_url IS NOT NULL
        AND (ls.tenant_id = $1 OR ls.tenant_id = '00000000-0000-0000-0000-000000000001')
    `;
    const params: unknown[] = [user.tenantId];

    if (qs.courseId) {
      params.push(qs.courseId);
      baseQuery += ` AND ls.course_id = $${params.length}`;
    }

    baseQuery += ' ORDER BY ls.scheduled_at DESC';

    const result = await paginate(baseQuery, params, page, limit);
    return reply.send({ success: true, data: result.data, meta: result.meta });
  });

  // ==========================================================================
  // GET /recordings/:id/stream — Presigned MinIO URL for streaming (2h expiry)
  // ==========================================================================
  app.get<{ Params: { id: string } }>('/:id/stream', {
    schema: {
      summary: 'Get presigned streaming URL',
      tags: ['Recordings'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const session = await queryOne(
      'SELECT id, recording_url, tenant_id FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );

    if (!session || !session.recording_url) {
      return reply.code(404).send({ success: false, error: 'Recording not found' });
    }

    // Extract object name from minio:// URL
    const minioPrefix = 'minio://academy-recordings/';
    if (!session.recording_url.startsWith(minioPrefix)) {
      // Legacy URL — return it directly
      return reply.send({ success: true, data: { streamUrl: session.recording_url, expiresIn: null } });
    }

    const objectName = session.recording_url.slice(minioPrefix.length);

    try {
      const streamUrl = await getPresignedUrl(objectName);
      return reply.send({
        success: true,
        data: {
          streamUrl,
          expiresIn: 7200, // 2 hours in seconds
        },
      });
    } catch (err) {
      app.log.error({ err }, '[Recordings] Failed to generate presigned URL');
      return reply.code(500).send({ success: false, error: 'Failed to generate streaming URL' });
    }
  });

  // ==========================================================================
  // DELETE /recordings/:id — Delete a recording
  // ==========================================================================
  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Delete a recording',
      tags: ['Recordings'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req, reply) => {
    const user = req.user;

    if (!['trainer', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const session = await queryOne(
      'SELECT id, recording_url, trainer_id, tenant_id FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );

    if (!session || !session.recording_url) {
      return reply.code(404).send({ success: false, error: 'Recording not found' });
    }

    // Trainers can only delete their own recordings
    if (user.role === 'trainer' && user.sub !== session.trainer_id) {
      return reply.code(403).send({ success: false, error: 'You can only delete your own recordings' });
    }

    // Delete from MinIO if it's a MinIO URL
    const minioPrefix = 'minio://academy-recordings/';
    if (session.recording_url.startsWith(minioPrefix)) {
      const objectName = session.recording_url.slice(minioPrefix.length);
      try {
        await deleteRecordingObject(objectName);
      } catch (err) {
        app.log.error({ err }, '[Recordings] Failed to delete from MinIO');
        // Continue to clear DB reference even if MinIO delete fails
      }
    }

    // Clear recording fields in DB
    await query(`
      UPDATE academy_core.live_sessions
      SET recording_url = NULL, recording_duration_seconds = NULL, updated_at = NOW()
      WHERE id = $1
    `, [req.params.id]);

    // Also remove any auto-created replay lessons pointing to this recording
    await query(`
      DELETE FROM academy_core.lessons WHERE video_url = $1 AND type = 'replay'
    `, [session.recording_url]);

    return reply.send({ success: true, data: { deleted: true } });
  });

  // ==========================================================================
  // GET /recordings/session/:sessionId — List recordings for a specific session
  // Queries DB first, falls back to BBB API for any additional recordings
  // ==========================================================================
  app.get<{ Params: { sessionId: string } }>('/session/:sessionId', {
    schema: {
      summary: 'Recordings for a specific session',
      tags: ['Recordings'],
      security: BearerSecurity,
      params: UuidParamNamed('sessionId'),
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
    const { sessionId } = req.params;

    const session = await queryOne(
      'SELECT id, bbb_meeting_id, recording_url, recording_duration_seconds, title, tenant_id FROM academy_core.live_sessions WHERE id = $1',
      [sessionId],
    );

    if (!session) {
      return reply.code(404).send({ success: false, error: 'Session not found' });
    }

    // Build recording list from DB data
    const dbRecordings: Array<Record<string, any>> = [];
    if (session.recording_url) {
      dbRecordings.push({
        source: 'minio',
        sessionId: session.id,
        url: session.recording_url,
        durationSeconds: session.recording_duration_seconds,
        title: session.title,
      });
    }

    // Try to fetch recordings from BBB API as a fallback / supplement
    let bbbRecordings: Array<Record<string, any>> = [];
    if (session.bbb_meeting_id) {
      try {
        const bbbResults = await bbbClient.getRecordings(session.bbb_meeting_id);
        bbbRecordings = bbbResults.map(r => ({
          source: 'bbb',
          recordId: r.recordId,
          format: r.format,
          url: r.url,
          durationMinutes: r.length,
        }));
      } catch (err) {
        app.log.warn({ err }, '[Recordings] Failed to fetch recordings from BBB — using DB data only');
        // Graceful degradation: return what we have from the DB
      }
    }

    // Merge: DB recordings take priority, BBB recordings fill in gaps
    // Avoid duplicates by checking if the BBB recording URL is already in the DB set
    const dbUrls = new Set(dbRecordings.map(r => r.url));
    const mergedRecordings = [
      ...dbRecordings,
      ...bbbRecordings.filter(r => !dbUrls.has(r.url)),
    ];

    return reply.send({
      success: true,
      data: {
        sessionId,
        recordings: mergedRecordings,
        total: mergedRecordings.length,
      },
    });
  });

  // ==========================================================================
  // POST /recordings/:id/process — Trigger recording processing
  // Downloads recording from BBB, uploads to MinIO, publishes Kafka event
  // ==========================================================================
  app.post<{ Params: { id: string } }>('/:id/process', {
    schema: {
      summary: 'Trigger recording processing',
      tags: ['Recordings'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const user = req.user;

    // Only trainer/admins can trigger processing
    if (!['trainer', 'admin_country', 'admin_rec', 'admin_continental'].includes(user.role)) {
      return reply.code(403).send({ success: false, error: 'Insufficient permissions' });
    }

    const session = await queryOne(
      'SELECT * FROM academy_core.live_sessions WHERE id = $1',
      [req.params.id],
    );

    if (!session) {
      return reply.code(404).send({ success: false, error: 'Session not found' });
    }

    // Trainers can only process their own session recordings
    if (user.role === 'trainer' && user.sub !== session.trainer_id) {
      return reply.code(403).send({ success: false, error: 'You can only process your own session recordings' });
    }

    // If recording is already processed (has MinIO URL), return it
    if (session.recording_url && session.recording_url.startsWith('minio://')) {
      return reply.send({
        success: true,
        data: {
          alreadyProcessed: true,
          recordingUrl: session.recording_url,
          sessionId: session.id,
        },
      });
    }

    // Try to get recording URL from BBB
    let bbbRecordingUrl: string | null = null;
    if (session.bbb_meeting_id) {
      try {
        const bbbRecordings = await bbbClient.getRecordings(session.bbb_meeting_id);
        if (bbbRecordings.length > 0) {
          // Use the first available recording
          bbbRecordingUrl = bbbRecordings[0].url;
        }
      } catch (err) {
        app.log.error({ err }, '[Recordings] Failed to fetch recording URL from BBB');
      }
    }

    // If a URL was passed in the body, use that as override
    const body = req.body as any;
    const recordingUrl = body?.recordingUrl || bbbRecordingUrl;

    if (!recordingUrl) {
      return reply.code(404).send({
        success: false,
        error: 'No recording available for this session. The recording may not have been generated by BBB yet.',
      });
    }

    // Process asynchronously: download from BBB -> upload to MinIO -> create replay lesson
    processRecording(session.id, recordingUrl)
      .then(async (result) => {
        if (result) {
          // Publish Kafka event for downstream consumers
          await publishEvent('academy.live.recording-processed', {
            sessionId: session.id,
            recordingUrl: result.minioUrl,
            objectName: result.objectName,
            courseId: session.course_id,
          }, session.tenant_id, user.sub);
        }
      })
      .catch(err => {
        app.log.error({ err }, `[Recordings] Processing failed for session ${session.id}`);
      });

    return reply.send({
      success: true,
      data: {
        processing: true,
        sessionId: session.id,
        message: 'Recording processing started. The recording will be available shortly.',
      },
    });
  });
}
