// ============================================================================
// ARIS Academy — Profile Routes
// GET /users/me, PUT /users/me, POST /users/me/avatar
// ============================================================================
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query,
  queryOne,
  validateBody,
} from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  preferredLanguage: z.enum(['en', 'fr', 'ar', 'pt']).optional(),
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export default async function profileRoutes(app: FastifyInstance): Promise<void> {

  // GET /users/me — return current user profile
  app.get('/users/me', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    try {
      const profile = await queryOne(
        `SELECT id, email, first_name, last_name, role, tenant_id,
                preferred_language, avatar_url, created_at
         FROM academy_core.users
         WHERE id = $1`,
        [user.sub],
      );

      if (!profile) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }

      // Include tenant info
      const tenant = await queryOne(
        `SELECT id, name, code, level FROM academy_core.tenants WHERE id = $1`,
        [profile.tenant_id],
      );

      return reply.send({
        success: true,
        data: {
          ...profile,
          tenant: tenant || null,
        },
      });
    } catch (err: any) {
      console.warn(`[profile] GET /users/me failed: ${err.message}`);
      return reply.code(500).send({ success: false, error: 'Failed to fetch profile' });
    }
  });

  // PUT /users/me — update current user profile
  app.put('/users/me', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = validateBody(updateProfileSchema, request.body);
    const user = request.user;

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.firstName !== undefined) {
      sets.push(`first_name = $${idx}`);
      params.push(body.firstName);
      idx++;
    }
    if (body.lastName !== undefined) {
      sets.push(`last_name = $${idx}`);
      params.push(body.lastName);
      idx++;
    }
    if (body.preferredLanguage !== undefined) {
      sets.push(`preferred_language = $${idx}`);
      params.push(body.preferredLanguage);
      idx++;
    }

    if (sets.length === 0) {
      return reply.code(400).send({ success: false, error: 'No fields to update' });
    }

    sets.push(`updated_at = NOW()`);
    params.push(user.sub);

    try {
      const updated = await queryOne(
        `UPDATE academy_core.users
         SET ${sets.join(', ')}
         WHERE id = $${idx}
         RETURNING id, email, first_name, last_name, role, tenant_id,
                   preferred_language, avatar_url, created_at, updated_at`,
        params,
      );

      if (!updated) {
        return reply.code(404).send({ success: false, error: 'User not found' });
      }

      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      console.warn(`[profile] PUT /users/me failed: ${err.message}`);
      return reply.code(500).send({ success: false, error: 'Failed to update profile' });
    }
  });

  // POST /users/me/avatar — upload avatar to MinIO
  app.post('/users/me/avatar', {
    preHandler: [app.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;

    try {
      // Parse multipart body
      const data = await request.file();
      if (!data) {
        return reply.code(400).send({ success: false, error: 'No file uploaded' });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(data.mimetype)) {
        return reply.code(400).send({ success: false, error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' });
      }

      // Upload to MinIO via shared service
      const { uploadFile } = await import('../services/minio');
      const ext = data.filename.split('.').pop() || 'jpg';
      const objectName = `avatars/${user.sub}.${ext}`;
      const buffer = await data.toBuffer();
      const avatarUrl = await uploadFile('avatars', objectName, buffer, data.mimetype);

      // Update user record
      const updated = await queryOne(
        `UPDATE academy_core.users
         SET avatar_url = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, avatar_url`,
        [avatarUrl, user.sub],
      );

      return reply.send({ success: true, data: updated });
    } catch (err: any) {
      console.warn(`[profile] POST /users/me/avatar failed: ${err.message}`);
      return reply.code(500).send({ success: false, error: 'Failed to upload avatar' });
    }
  });
}
