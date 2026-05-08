// ============================================================================
// ARIS Academy — Lesson Routes
// CRUD + video/file upload via MinIO + reordering
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import path from 'path';
import { isConvertible, convertToPdf } from '../services/document-converter';
import {
  query,
  queryOne,
  transaction,
  cacheDel,
  validateBody,
  multiLangTextSchema,
  uuidSchema,
  auditLog,
  UuidParam,
  UuidParamNamed,
  MultiLangTextSchema,
  BearerSecurity,
} from '@aris-academy/shared';
import { uploadFile, BUCKETS } from '../services/minio';
import { invalidateResolvedCache } from '../services/course-resolver';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createLessonSchema = z.object({
  moduleId: z.string().uuid(),
  title: multiLangTextSchema,
  type: z.enum(['video', 'text', 'quiz', 'practical', 'replay']),
  content: z.record(z.unknown()).optional(),
  videoUrl: z.string().url().optional(),
  durationMinutes: z.number().int().positive().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
});

const updateLessonSchema = z.object({
  title: multiLangTextSchema.optional(),
  type: z.enum(['video', 'text', 'quiz', 'practical', 'replay']).optional(),
  content: z.record(z.unknown()).optional(),
  videoUrl: z.string().url().optional(),
  durationMinutes: z.number().int().positive().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

const reorderSchema = z.object({
  lessonIds: z.array(z.string().uuid()).min(1),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
]);
const ALLOWED_AUDIO_TYPES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm',
]);
const ALLOWED_DOC_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',  // .pptx
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',     // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',           // .xlsx
  'application/vnd.oasis.opendocument.text',        // .odt
  'application/vnd.oasis.opendocument.spreadsheet',  // .ods
  'application/vnd.oasis.opendocument.presentation', // .odp
  'text/html',                                       // .html
]);
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB

async function getCourseIdForLesson(lessonId: string): Promise<string | null> {
  const row = await queryOne<{ course_id: string }>(
    `SELECT m.course_id FROM academy_core.lessons l
     JOIN academy_core.modules m ON m.id = l.module_id
     WHERE l.id = $1`,
    [lessonId],
  );
  return row?.course_id ?? null;
}

async function getCourseIdForModule(moduleId: string): Promise<string | null> {
  const row = await queryOne<{ course_id: string }>(
    'SELECT course_id FROM academy_core.modules WHERE id = $1',
    [moduleId],
  );
  return row?.course_id ?? null;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export async function lessonRoutes(app: FastifyInstance): Promise<void> {

  // =========================================================================
  // GET /module/:moduleId — List lessons for a module
  // =========================================================================
  app.get<{ Params: { moduleId: string } }>('/module/:moduleId', {
    schema: {
      summary: 'List lessons for a module',
      tags: ['Lessons'],
      security: BearerSecurity,
      params: UuidParamNamed('moduleId'),
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.moduleId);

    const lessons = await query(
      'SELECT * FROM academy_core.lessons WHERE module_id = $1 ORDER BY sort_order',
      [request.params.moduleId],
    );
    return reply.send({ success: true, data: lessons });
  });

  // =========================================================================
  // GET /:id — Get single lesson
  // =========================================================================
  app.get<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Get lesson by ID',
      tags: ['Lessons'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);

    const lesson = await queryOne(
      'SELECT * FROM academy_core.lessons WHERE id = $1',
      [request.params.id],
    );
    if (!lesson) {
      return reply.code(404).send({ success: false, error: 'Lesson not found' });
    }
    return reply.send({ success: true, data: lesson });
  });

  // =========================================================================
  // POST / — Create lesson
  // =========================================================================
  app.post('/', {
    schema: {
      summary: 'Create lesson',
      tags: ['Lessons'],
      security: BearerSecurity,
      body: {
        type: 'object',
        required: ['moduleId', 'title', 'type'],
        properties: {
          moduleId: { type: 'string', format: 'uuid' },
          title: MultiLangTextSchema,
          type: { type: 'string', enum: ['video', 'text', 'quiz', 'practical', 'replay'] },
          content: { type: 'object', additionalProperties: true },
          videoUrl: { type: 'string', format: 'uri' },
          durationMinutes: { type: 'integer', exclusiveMinimum: 0 },
          sortOrder: { type: 'integer', minimum: 0, default: 0 },
          isRequired: { type: 'boolean', default: true },
        },
      },
    },
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(createLessonSchema, request.body);
    const user = request.user;

    const lesson = await queryOne(
      `INSERT INTO academy_core.lessons
         (module_id, title, type, content, video_url, duration_minutes, sort_order, is_required)
       VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6, $7, $8)
       RETURNING *`,
      [
        body.moduleId, JSON.stringify(body.title), body.type,
        body.content ? JSON.stringify(body.content) : null,
        body.videoUrl ?? null, body.durationMinutes ?? null,
        body.sortOrder, body.isRequired,
      ],
    );

    const courseId = await getCourseIdForModule(body.moduleId);
    if (courseId) {
      await cacheDel('courses:*');
      await invalidateResolvedCache(courseId);
    }
    await auditLog(user.sub, user.tenantId, 'lesson.created', 'lesson', lesson.id, { type: body.type }, request.ip);

    return reply.code(201).send({ success: true, data: lesson });
  });

  // =========================================================================
  // PUT /:id — Update lesson
  // =========================================================================
  app.put<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Update lesson',
      tags: ['Lessons'],
      security: BearerSecurity,
      params: UuidParam,
      body: {
        type: 'object',
        properties: {
          title: MultiLangTextSchema,
          type: { type: 'string', enum: ['video', 'text', 'quiz', 'practical', 'replay'] },
          content: { type: 'object', additionalProperties: true },
          videoUrl: { type: 'string', format: 'uri' },
          durationMinutes: { type: 'integer', exclusiveMinimum: 0 },
          sortOrder: { type: 'integer', minimum: 0 },
          isRequired: { type: 'boolean' },
        },
      },
    },
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const body = validateBody(updateLessonSchema, request.body);
    const user = request.user;

    const lesson = await queryOne(
      `UPDATE academy_core.lessons SET
         title = COALESCE($2::jsonb, title),
         type = COALESCE($3, type),
         content = COALESCE($4::jsonb, content),
         video_url = COALESCE($5, video_url),
         duration_minutes = COALESCE($6, duration_minutes),
         sort_order = COALESCE($7, sort_order),
         is_required = COALESCE($8, is_required)
       WHERE id = $1 RETURNING *`,
      [
        request.params.id,
        body.title ? JSON.stringify(body.title) : null,
        body.type ?? null,
        body.content ? JSON.stringify(body.content) : null,
        body.videoUrl ?? null, body.durationMinutes ?? null,
        body.sortOrder ?? null, body.isRequired ?? null,
      ],
    );

    if (!lesson) {
      return reply.code(404).send({ success: false, error: 'Lesson not found' });
    }

    const courseId = await getCourseIdForLesson(request.params.id);
    if (courseId) {
      await cacheDel('courses:*');
      await invalidateResolvedCache(courseId);
    }
    await auditLog(user.sub, user.tenantId, 'lesson.updated', 'lesson', lesson.id, {}, request.ip);

    return reply.send({ success: true, data: lesson });
  });

  // =========================================================================
  // DELETE /:id — Delete lesson
  // =========================================================================
  app.delete<{ Params: { id: string } }>('/:id', {
    schema: {
      summary: 'Delete lesson',
      tags: ['Lessons'],
      security: BearerSecurity,
      params: UuidParam,
    },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    const courseId = await getCourseIdForLesson(request.params.id);

    const deleted = await queryOne(
      'DELETE FROM academy_core.lessons WHERE id = $1 RETURNING id',
      [request.params.id],
    );
    if (!deleted) {
      return reply.code(404).send({ success: false, error: 'Lesson not found' });
    }

    if (courseId) {
      await cacheDel('courses:*');
      await invalidateResolvedCache(courseId);
    }
    await auditLog(user.sub, user.tenantId, 'lesson.deleted', 'lesson', request.params.id, {}, request.ip);

    return reply.code(204).send();
  });

  // =========================================================================
  // POST /:id/upload — Upload video/document to MinIO
  // =========================================================================
  app.post<{ Params: { id: string } }>('/:id/upload', {
    schema: {
      summary: 'Upload file to lesson',
      description: 'Upload a video (mp4, webm, ogg, mov) or document (pdf, pptx, docx) — max 500 MB',
      tags: ['Lessons'],
      security: BearerSecurity,
      params: UuidParam,
      consumes: ['multipart/form-data'],
    },
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request, reply) => {
    validateBody(uuidSchema, request.params.id);
    const user = request.user;

    // Verify lesson exists
    const lesson = await queryOne(
      'SELECT id, module_id, type FROM academy_core.lessons WHERE id = $1',
      [request.params.id],
    );
    if (!lesson) {
      return reply.code(404).send({ success: false, error: 'Lesson not found' });
    }

    // Process multipart upload
    const file = await request.file();
    if (!file) {
      return reply.code(400).send({ success: false, error: 'No file provided' });
    }

    const mimeType = file.mimetype;
    const isVideo = ALLOWED_VIDEO_TYPES.has(mimeType);
    const isAudio = ALLOWED_AUDIO_TYPES.has(mimeType);
    const isDoc = ALLOWED_DOC_TYPES.has(mimeType);

    if (!isVideo && !isAudio && !isDoc) {
      return reply.code(400).send({
        success: false,
        error: `Unsupported file type: ${mimeType}. Allowed: video, audio, pdf, office documents, html`,
      });
    }

    // Read file into buffer
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of file.file) {
      totalSize += chunk.length;
      if (totalSize > MAX_FILE_SIZE) {
        return reply.code(413).send({ success: false, error: 'File exceeds 500 MB limit' });
      }
      chunks.push(chunk);
    }

    // Check if the stream was truncated (fastify/multipart limit exceeded)
    if (file.file.truncated) {
      return reply.code(413).send({ success: false, error: 'File exceeds upload limit' });
    }

    const buffer = Buffer.concat(chunks);
    const ext = path.extname(file.filename) || (isVideo ? '.mp4' : isAudio ? '.mp3' : '.pdf');
    const bucket = (isVideo || isAudio) ? BUCKETS.VIDEOS : BUCKETS.DOCUMENTS;
    const key = `${request.params.id}/${randomUUID()}${ext}`;

    // Upload original file
    const url = await uploadFile(bucket, key, buffer, mimeType);

    // For Office documents, also convert to PDF and upload the preview
    let pdfPreviewUrl: string | undefined;
    if (isConvertible(mimeType)) {
      try {
        const pdfBuffer = await convertToPdf(buffer, file.filename);
        if (pdfBuffer) {
          const pdfKey = `${request.params.id}/${randomUUID()}.pdf`;
          pdfPreviewUrl = await uploadFile(BUCKETS.DOCUMENTS, pdfKey, pdfBuffer, 'application/pdf');
          app.log.info(`[upload] Converted ${file.filename} to PDF preview`);
        }
      } catch (err: any) {
        app.log.warn(`[upload] PDF conversion failed for ${file.filename}: ${err.message}`);
      }
    }

    // Update lesson with the file URL
    const column = (isVideo || isAudio) ? 'video_url' : 'content';
    let value: string;
    if (isVideo || isAudio) {
      value = url;
    } else {
      const existingContent = typeof lesson.content === 'object' ? lesson.content : {};
      value = JSON.stringify({
        ...existingContent,
        documentUrl: url,
        documentType: mimeType,
        documentName: file.filename,
        pdfPreviewUrl: pdfPreviewUrl || (mimeType === 'application/pdf' ? url : undefined),
      });
    }

    const updated = await queryOne(
      `UPDATE academy_core.lessons SET ${column} = $2 WHERE id = $1 RETURNING *`,
      [request.params.id, value],
    );

    const courseId = await getCourseIdForModule(lesson.module_id);
    if (courseId) await invalidateResolvedCache(courseId);

    await auditLog(
      user.sub, user.tenantId, 'lesson.file.uploaded', 'lesson', request.params.id,
      { bucket, key, size: buffer.length, mimeType }, request.ip,
    );

    return reply.send({
      success: true,
      data: {
        lesson: updated,
        upload: { url, bucket, key, size: buffer.length, mimeType },
      },
    });
  });

  // =========================================================================
  // POST /reorder — Batch update sort_order for lessons within a module
  // =========================================================================
  app.post('/reorder', {
    schema: {
      summary: 'Reorder lessons',
      tags: ['Lessons'],
      security: BearerSecurity,
      body: {
        type: 'object',
        required: ['lessonIds'],
        properties: { lessonIds: { type: 'array', items: { type: 'string', format: 'uuid' }, minItems: 1 } },
      },
    },
    preHandler: [app.authenticate, app.requireRole('trainer', 'admin_country', 'admin_rec', 'admin_continental')],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { lessonIds } = validateBody(reorderSchema, request.body);
    const user = request.user;

    let courseId: string | null = null;

    await transaction(async (client) => {
      for (let i = 0; i < lessonIds.length; i++) {
        await client.query(
          'UPDATE academy_core.lessons SET sort_order = $2 WHERE id = $1',
          [lessonIds[i], i],
        );
      }
    });

    // Resolve course for cache invalidation from first lesson
    if (lessonIds.length > 0) {
      courseId = await getCourseIdForLesson(lessonIds[0]);
    }

    if (courseId) {
      await cacheDel('courses:*');
      await invalidateResolvedCache(courseId);
    }
    await auditLog(user.sub, user.tenantId, 'lessons.reordered', 'lesson', undefined, { lessonIds }, request.ip);

    return reply.send({ success: true, data: { reordered: lessonIds.length } });
  });
}
