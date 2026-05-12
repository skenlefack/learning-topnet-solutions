// ============================================================================
// ARIS Academy — Auth Route
// POST /auth/login — DEV: seed credentials, PRODUCTION: DB + bcrypt
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import {
  query,
  queryOne,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
} from '@aris-academy/shared';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
});
const forgotSchema = z.object({ email: z.string().email() });
const resetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

// ---------------------------------------------------------------------------
// DEV-ONLY demo credentials (disabled in production)
// ---------------------------------------------------------------------------

const DEV_PASSWORD = 'academy2026';

const DEMO_USERS: Record<string, {
  id: string; firstName: string; lastName: string;
  role: string; tenantId: string; tenantLevel: string; preferredLanguage: string;
}> = {
  'serge@au-ibar.org': {
    id: 'usr_serge_001',
    firstName: 'Serge',
    lastName: 'Nakouzi',
    role: 'admin_continental',
    tenantId: 'au-ibar',
    tenantLevel: 'continental',
    preferredLanguage: 'fr',
  },
  'amina@au-ibar.org': {
    id: 'usr_amina_002',
    firstName: 'Amina',
    lastName: 'Diallo',
    role: 'trainer',
    tenantId: 'au-ibar',
    tenantLevel: 'continental',
    preferredLanguage: 'fr',
  },
  'learner@kenya.go.ke': {
    id: 'usr_learner_003',
    firstName: 'James',
    lastName: 'Ochieng',
    role: 'learner',
    tenantId: 'kenya',
    tenantLevel: 'country',
    preferredLanguage: 'en',
  },
};

export default async function authRoutes(app: FastifyInstance) {

  app.post(
    '/auth/login',
    {
      schema: {
        summary: 'Authenticate user and obtain JWT',
        tags: ['Auth'],
        body: {
          type: 'object' as const,
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: 'Email and password are required' });
      }

      const { email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      // ---------------------------------------------------------------
      // PRODUCTION: authenticate against database with bcrypt
      // ---------------------------------------------------------------
      if (process.env.NODE_ENV === 'production') {
        try {
          const bcrypt = await import('bcryptjs');
          const { query } = await import('@aris-academy/shared');

          const rows = await query<{
            id: string;
            email: string;
            first_name: string;
            last_name: string;
            role: string;
            tenant_id: string;
            preferred_language: string;
            password_hash: string | null;
            is_active: boolean;
          }>(
            `SELECT u.id, u.email, u.first_name, u.last_name, u.role,
                    u.tenant_id, u.preferred_language, u.password_hash, u.is_active,
                    t.level as tenant_level
             FROM academy_core.users u
             JOIN academy_core.tenants t ON t.id = u.tenant_id
             WHERE u.email = $1
             LIMIT 1`,
            [normalizedEmail],
          );

          const dbUser = rows[0] as any;
          if (!dbUser) {
            return reply.code(401).send({ success: false, error: 'Invalid credentials' });
          }
          if (!dbUser.is_active) {
            return reply.code(403).send({ success: false, error: 'Account disabled' });
          }
          if (!dbUser.password_hash) {
            return reply.code(401).send({ success: false, error: 'Password not set — use SSO login' });
          }

          const valid = await bcrypt.compare(password, dbUser.password_hash);
          if (!valid) {
            return reply.code(401).send({ success: false, error: 'Invalid credentials' });
          }

          const token = app.jwt.sign({
            sub: dbUser.id,
            email: dbUser.email,
            firstName: dbUser.first_name,
            lastName: dbUser.last_name,
            role: dbUser.role,
            tenantId: dbUser.tenant_id,
            tenantLevel: dbUser.tenant_level,
            preferredLanguage: dbUser.preferred_language,
          });

          // Update last_login_at
          query('UPDATE academy_core.users SET last_login_at = NOW() WHERE id = $1', [dbUser.id]).catch(() => {});

          return reply.send({
            success: true,
            token,
            user: {
              id: dbUser.id,
              email: dbUser.email,
              firstName: dbUser.first_name,
              lastName: dbUser.last_name,
              role: dbUser.role,
              tenantId: dbUser.tenant_id,
              tenantLevel: dbUser.tenant_level,
              preferredLanguage: dbUser.preferred_language,
            },
          });
        } catch (err: any) {
          app.log.error(`[auth] Production login error: ${err.message}`);
          return reply.code(500).send({ success: false, error: 'Authentication service unavailable' });
        }
      }

      // ---------------------------------------------------------------
      // DEV / STAGING: demo credentials
      // ---------------------------------------------------------------
      if (password !== DEV_PASSWORD) {
        return reply.code(401).send({ success: false, error: 'Invalid credentials' });
      }

      const demoUser = DEMO_USERS[normalizedEmail];

      const user = demoUser
        ? { ...demoUser, email: normalizedEmail }
        : {
            id: `usr_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`,
            email: normalizedEmail,
            firstName: normalizedEmail.split('@')[0].split('.')[0].replace(/^\w/, (c: string) => c.toUpperCase()),
            lastName: normalizedEmail.split('@')[0].split('.').slice(1).join(' ').replace(/^\w/, (c: string) => c.toUpperCase()) || 'User',
            role: 'learner',
            tenantId: normalizedEmail.split('@')[1]?.split('.')[0] || 'default',
            tenantLevel: 'country',
            preferredLanguage: 'en',
          };

      const token = app.jwt.sign({
        sub: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        tenantId: user.tenantId,
        tenantLevel: user.tenantLevel,
        preferredLanguage: user.preferredLanguage,
      });

      return reply.send({ success: true, token, user });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /auth/forgot-password — Request password reset (public)
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/auth/forgot-password',
    {
      schema: {
        summary: 'Request password reset email',
        tags: ['Auth'],
        body: {
          type: 'object' as const,
          required: ['email'],
          properties: { email: { type: 'string', format: 'email' } },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = forgotSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: 'Valid email required' });
      }

      const email = parsed.data.email.toLowerCase().trim();

      // Always return 200 to prevent email enumeration
      try {
        const user = await queryOne<{
          id: string; email: string; first_name: string;
          last_name: string; preferred_language: string;
        }>(
          'SELECT id, email, first_name, last_name, preferred_language FROM academy_core.users WHERE email = $1 AND is_active = true',
          [email],
        );

        if (user) {
          // Generate token
          const rawToken = crypto.randomBytes(32).toString('hex');
          const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Invalidate previous tokens
          await query(
            'UPDATE academy_core.password_reset_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
            [user.id],
          );

          // Store hashed token
          await query(
            'INSERT INTO academy_core.password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [user.id, tokenHash, expiresAt.toISOString()],
          );

          // Send email (non-blocking)
          sendPasswordResetEmail(
            { email: user.email, firstName: user.first_name, preferredLanguage: user.preferred_language },
            rawToken,
          ).catch((err: any) => app.log.error(`[auth] Reset email failed: ${err.message}`));
        }
      } catch (err: any) {
        app.log.error(`[auth] Forgot password error: ${err.message}`);
      }

      return reply.send({
        success: true,
        message: 'If this email exists, a reset link has been sent.',
      });
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /auth/reset-password — Set new password with token (public)
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/auth/reset-password',
    {
      schema: {
        summary: 'Reset password with token',
        tags: ['Auth'],
        body: {
          type: 'object' as const,
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = resetSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: 'Token and new password (min 8 chars) required' });
      }

      const { token, newPassword } = parsed.data;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      try {
        // Find valid token
        const resetRow = await queryOne<{
          id: string; user_id: string; expires_at: string; used_at: string | null;
        }>(
          'SELECT id, user_id, expires_at, used_at FROM academy_core.password_reset_tokens WHERE token_hash = $1',
          [tokenHash],
        );

        if (!resetRow) {
          return reply.code(400).send({ success: false, error: 'Invalid or expired token' });
        }
        if (resetRow.used_at) {
          return reply.code(400).send({ success: false, error: 'Token already used' });
        }
        if (new Date(resetRow.expires_at) < new Date()) {
          return reply.code(400).send({ success: false, error: 'Token expired' });
        }

        // Hash new password
        const bcrypt = await import('bcryptjs');
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update password + mark token as used
        await query(
          'UPDATE academy_core.users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
          [passwordHash, resetRow.user_id],
        );
        await query(
          'UPDATE academy_core.password_reset_tokens SET used_at = NOW() WHERE id = $1',
          [resetRow.id],
        );

        // Send confirmation email (non-blocking)
        const user = await queryOne<{
          email: string; first_name: string; preferred_language: string;
        }>(
          'SELECT email, first_name, preferred_language FROM academy_core.users WHERE id = $1',
          [resetRow.user_id],
        );
        if (user) {
          sendPasswordChangedEmail({
            email: user.email, firstName: user.first_name, preferredLanguage: user.preferred_language,
          }).catch((err: any) => app.log.error(`[auth] Password changed email failed: ${err.message}`));
        }

        return reply.send({ success: true, message: 'Password updated successfully' });
      } catch (err: any) {
        app.log.error(`[auth] Reset password error: ${err.message}`);
        return reply.code(500).send({ success: false, error: 'Service error' });
      }
    },
  );

  // ─────────────────────────────────────────────────────────────────────────
  // POST /auth/register — Self-registration (public)
  // ─────────────────────────────────────────────────────────────────────────
  app.post(
    '/auth/register',
    {
      schema: {
        summary: 'Register a new learner account',
        tags: ['Auth'],
        body: {
          type: 'object' as const,
          required: ['firstName', 'lastName', 'email', 'password'],
          properties: {
            firstName: { type: 'string', minLength: 1, maxLength: 100 },
            lastName: { type: 'string', minLength: 1, maxLength: 100 },
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
      },
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ success: false, error: 'All fields are required (password min 8 chars)' });
      }

      const { firstName, lastName, email, password } = parsed.data;
      const normalizedEmail = email.toLowerCase().trim();

      // ── DEV / STAGING ──────────────────────────────────────────────────
      if (process.env.NODE_ENV !== 'production') {
        const user = {
          id: `usr_${normalizedEmail.replace(/[^a-z0-9]/g, '_')}`,
          email: normalizedEmail,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role: 'learner',
          tenantId: 'au-ibar',
          tenantLevel: 'continental',
          preferredLanguage: 'fr',
        };

        const token = app.jwt.sign({
          sub: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenantLevel: user.tenantLevel,
          preferredLanguage: user.preferredLanguage,
        });

        return reply.send({ success: true, token, user });
      }

      // ── PRODUCTION ─────────────────────────────────────────────────────
      try {
        const bcrypt = await import('bcryptjs');

        // Check if email already exists
        const existing = await queryOne<{ id: string }>(
          'SELECT id FROM academy_core.users WHERE email = $1',
          [normalizedEmail],
        );
        if (existing) {
          return reply.code(409).send({ success: false, error: 'Email already registered' });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        // Default tenant: AU-IBAR Continental
        const defaultTenantId = '00000000-0000-0000-0000-000000000001';

        const newUser = await queryOne<{
          id: string; email: string; first_name: string; last_name: string;
          role: string; tenant_id: string; preferred_language: string;
        }>(
          `INSERT INTO academy_core.users (email, first_name, last_name, role, tenant_id, password_hash, preferred_language)
           VALUES ($1, $2, $3, 'learner', $4, $5, 'fr')
           RETURNING id, email, first_name, last_name, role, tenant_id, preferred_language`,
          [normalizedEmail, firstName.trim(), lastName.trim(), defaultTenantId, passwordHash],
        );

        if (!newUser) {
          return reply.code(500).send({ success: false, error: 'Registration failed' });
        }

        const token = app.jwt.sign({
          sub: newUser.id,
          email: newUser.email,
          firstName: newUser.first_name,
          lastName: newUser.last_name,
          role: newUser.role,
          tenantId: newUser.tenant_id,
          tenantLevel: 'continental',
          preferredLanguage: newUser.preferred_language,
        });

        return reply.send({
          success: true,
          token,
          user: {
            id: newUser.id,
            email: newUser.email,
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            role: newUser.role,
            tenantId: newUser.tenant_id,
            tenantLevel: 'continental',
            preferredLanguage: newUser.preferred_language,
          },
        });
      } catch (err: any) {
        app.log.error(`[auth] Register error: ${err.message}`);
        return reply.code(500).send({ success: false, error: 'Registration service unavailable' });
      }
    },
  );
}
