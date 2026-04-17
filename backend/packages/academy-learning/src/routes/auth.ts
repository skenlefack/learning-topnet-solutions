// ============================================================================
// ARIS Academy — Auth Route
// POST /auth/login — DEV: seed credentials, PRODUCTION: DB + bcrypt
// ============================================================================
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
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
}
