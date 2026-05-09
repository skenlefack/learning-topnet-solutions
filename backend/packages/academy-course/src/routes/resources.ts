// ============================================================================
// ARIS Academy — Resources Routes
// List all documents/files published by trainers across courses
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query, BearerSecurity } from '@aris-academy/shared';

export async function resourceRoutes(app: FastifyInstance) {
  // GET / — List all resources (lessons with documents or videos)
  app.get('/', {
    schema: {
      summary: 'List all course resources (documents, videos)',
      tags: ['Resources'],
      security: BearerSecurity,
      querystring: {
        type: 'object',
        properties: {
          courseId: { type: 'string' },
          type: { type: 'string', enum: ['video', 'document', 'all'] },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 },
        },
      },
    },
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { courseId, type, limit = 50, offset = 0 } = request.query as any;

    const conditions = [
      `(l.video_url IS NOT NULL OR l.content ? 'documentUrl')`,
    ];
    const params: any[] = [];
    let idx = 1;

    if (courseId) {
      conditions.push(`m.course_id = $${idx++}`);
      params.push(courseId);
    }

    if (type === 'video') {
      conditions.splice(0, 1, `l.video_url IS NOT NULL`);
    } else if (type === 'document') {
      conditions.splice(0, 1, `l.content ? 'documentUrl'`);
    }

    const where = conditions.join(' AND ');

    const rows = await query(
      `SELECT
        l.id, l.title, l.type AS lesson_type, l.video_url, l.duration_minutes,
        l.content->>'documentUrl' AS document_url,
        l.content->>'documentName' AS document_name,
        l.content->>'documentType' AS document_type,
        l.content->>'pdfPreviewUrl' AS pdf_preview_url,
        l.created_at,
        m.title AS module_title, m.course_id,
        c.title AS course_title, c.slug AS course_slug
      FROM academy_core.lessons l
      JOIN academy_core.modules m ON m.id = l.module_id
      JOIN academy_core.courses c ON c.id = m.course_id
      WHERE ${where} AND c.status = 'published'
      ORDER BY l.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset],
    );

    return reply.send({ success: true, data: rows, meta: { limit, offset } });
  });
}
