// ============================================================================
// Unit Tests — Tenant scope plugin: tenantFilter() for each role
// ============================================================================
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { signTestJwt } from '../../helpers/auth';

// Mock external deps that @topnet-academy/shared barrel transitively imports
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));

// Mock the DB query used by tenant-scope plugin (SET search_path)
vi.mock('../../../packages/shared/src/db/index', () => ({
  query: vi.fn().mockResolvedValue({ rows: [] }),
  queryOne: vi.fn().mockResolvedValue(null),
  getPool: vi.fn(),
}));

const JWT_SECRET = 'test-secret'; // Must match signTestJwt default

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  await app.register(fastifyJwt, { secret: JWT_SECRET });

  const { default: authPlugin } = await import(
    '../../../packages/shared/src/plugins/auth'
  );
  const { default: tenantScopePlugin } = await import(
    '../../../packages/shared/src/plugins/tenant-scope'
  );

  await app.register(authPlugin);
  await app.register(tenantScopePlugin);

  // Test route that returns the tenant filter result
  app.get('/test-filter', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const filter = req.tenantFilter(1);
    return { clause: filter.clause, params: filter.params };
  });

  // Route for paramOffset test — must be registered before app.ready()
  app.get('/test-filter-offset', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const filter = req.tenantFilter(5);
    return { clause: filter.clause, params: filter.params };
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('tenantFilter()', () => {
  it('returns 1=1 for admin_continental (sees everything)', async () => {
    const token = signTestJwt({
      role: 'admin_continental',
      tenantId: 'tenant-au',
      tenantLevel: 'continental',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-filter',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.clause).toBe('1=1');
    expect(body.params).toEqual([]);
  });

  it('returns IN subquery for admin_rec (own tenant + children)', async () => {
    const token = signTestJwt({
      role: 'admin_rec',
      tenantId: 'tenant-ecowas',
      tenantLevel: 'rec',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-filter',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.clause).toContain('tenant_id IN');
    expect(body.clause).toContain('parent_id');
    expect(body.params).toEqual(['tenant-ecowas']);
  });

  it('returns strict tenant_id = $N for admin_country', async () => {
    const token = signTestJwt({
      role: 'admin_country',
      tenantId: 'tenant-kenya',
      tenantLevel: 'country',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-filter',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.clause).toBe('tenant_id = $1');
    expect(body.params).toEqual(['tenant-kenya']);
  });

  it('returns strict tenant_id filter for learner role', async () => {
    const token = signTestJwt({
      role: 'learner',
      tenantId: 'tenant-senegal',
      tenantLevel: 'country',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-filter',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.clause).toBe('tenant_id = $1');
    expect(body.params).toEqual(['tenant-senegal']);
  });

  it('returns strict tenant_id filter for trainer role', async () => {
    const token = signTestJwt({
      role: 'trainer',
      tenantId: 'tenant-nigeria',
      tenantLevel: 'country',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-filter',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(res.statusCode).toBe(200);
    expect(body.clause).toBe('tenant_id = $1');
    expect(body.params).toEqual(['tenant-nigeria']);
  });

  it('respects paramOffset parameter', async () => {
    const token = signTestJwt({
      role: 'learner',
      tenantId: 'tenant-ghana',
      tenantLevel: 'country',
    });

    const res = await app.inject({
      method: 'GET',
      url: '/test-filter-offset',
      headers: { authorization: `Bearer ${token}` },
    });

    const body = JSON.parse(res.body);
    expect(body.clause).toBe('tenant_id = $5');
  });

  it('returns 401 for unauthenticated requests', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/test-filter',
    });

    expect(res.statusCode).toBe(401);
  });
});
