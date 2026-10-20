// ============================================================================
// Topnet Solutions Academy — Auth Plugin (Fastify)
// Registers: authenticate, requireRole, tenant context extraction
// Usage: fastify.register(authPlugin)
// ============================================================================
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload, UserRole, TenantLevel } from '../types';

// ---------------------------------------------------------------------------
// Type augmentations — declare on 'fastify' directly so the shared package
// compiles without needing @fastify/jwt type resolution.  The consuming
// service registers @fastify/jwt which provides the runtime jwtVerify/user.
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (
      ...roles: UserRole[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    jwtVerify<T = JwtPayload>(options?: unknown): Promise<T>;
    user: JwtPayload;
    tenantId: string;
    tenantLevel: TenantLevel;
  }
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

async function authPlugin(fastify: FastifyInstance): Promise<void> {
  // -- authenticate: verifies the JWT and populates request.user -----------
  fastify.decorate(
    'authenticate',
    async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
      try {
        await request.jwtVerify();
        // Populate tenant context after successful verification
        request.tenantId = request.user.tenantId;
        request.tenantLevel = request.user.tenantLevel;
      } catch (_err) {
        reply.code(401).send({ success: false, error: 'Unauthorized' });
      }
    },
  );

  // -- requireRole: returns a preHandler that checks the user's role ------
  fastify.decorate(
    'requireRole',
    function requireRole(...roles: UserRole[]) {
      return async function checkRole(
        request: FastifyRequest,
        reply: FastifyReply,
      ): Promise<void> {
        const user = request.user;
        if (!user || !roles.includes(user.role)) {
          reply.code(403).send({
            success: false,
            error: 'Forbidden: insufficient role',
          });
        }
      };
    },
  );

  // -- Tenant context on every request ------------------------------------
  fastify.decorateRequest('tenantId', '');
  fastify.decorateRequest('tenantLevel', 'country' as TenantLevel);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    if (request.user) {
      request.tenantId = request.user.tenantId;
      request.tenantLevel = request.user.tenantLevel;
    }
  });
}

export default fp(authPlugin, {
  name: 'academy-auth',
  dependencies: ['@fastify/jwt'],
});
