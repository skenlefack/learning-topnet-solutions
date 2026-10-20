// ============================================================================
// Topnet Solutions Academy — Tenant Scope Plugin (Fastify)
// Injects search_path + request.tenantFilter() for multi-tenant SQL queries
// Usage: fastify.register(tenantScopePlugin) — after authPlugin
// ============================================================================
import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { UserRole } from '../types';
import { query } from '../db';

// ---------------------------------------------------------------------------
// Tenant filter result type
// ---------------------------------------------------------------------------

export interface TenantFilterResult {
  /** SQL WHERE clause fragment (e.g. "tenant_id = $1" or "1=1") */
  clause: string;
  /** Parameter values to bind — append to your existing params array */
  params: string[];
}

// ---------------------------------------------------------------------------
// Type augmentation
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    tenantFilter(paramOffset?: number): TenantFilterResult;
  }
}

// ---------------------------------------------------------------------------
// Plugin implementation
// ---------------------------------------------------------------------------

async function tenantScopePlugin(fastify: FastifyInstance): Promise<void> {
  // Provide a safe default so Fastify can decorate the request prototype.
  // The real implementation is attached per-request in the preHandler below.
  fastify.decorateRequest('tenantFilter', null);

  fastify.addHook('preHandler', async (request: FastifyRequest) => {
    // Set search_path for the connection used in this tick
    await query('SET search_path TO academy_core, public');

    request.tenantFilter = (paramOffset = 1): TenantFilterResult => {
      // Read from request at invocation time (after authenticate has run)
      const role: UserRole | undefined = request.user?.role;
      const tenantId: string = request.tenantId || '';

      // Unauthenticated — block everything
      if (!role) {
        return { clause: '1=0', params: [] };
      }

      // Continental admin sees all tenants
      if (role === 'admin_continental') {
        return { clause: '1=1', params: [] };
      }

      // REC admin sees own tenant + child country tenants
      if (role === 'admin_rec') {
        return {
          clause: `tenant_id IN (SELECT id FROM academy_core.tenants WHERE id = $${paramOffset} OR parent_id = $${paramOffset})`,
          params: [tenantId],
        };
      }

      // admin_country, trainer, learner — strict single-tenant filter
      return {
        clause: `tenant_id = $${paramOffset}`,
        params: [tenantId],
      };
    };
  });
}

export default fp(tenantScopePlugin, {
  name: 'academy-tenant-scope',
  dependencies: ['academy-auth'],
});
