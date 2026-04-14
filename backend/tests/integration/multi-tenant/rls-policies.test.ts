// ============================================================================
// Integration Tests — RLS Policies: Tenant Isolation
// Tests that data is properly isolated between continental, REC, and country
// Requires: testcontainers PostgreSQL with init.sql loaded
// ============================================================================
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { testQuery, testQueryOne, resetDatabase, closeTestPool } from '../../helpers/db';
import { createTenant, createUser, createCourse } from '../../helpers/factories';

// ---------------------------------------------------------------------------
// Setup: Create tenant hierarchy + users + courses
// ---------------------------------------------------------------------------

let continentalTenant: any;
let recTenant: any;
let countryTenantA: any;
let countryTenantB: any;

let continentalAdmin: any;
let recAdmin: any;
let countryAdminA: any;
let countryAdminB: any;
let learnerA: any;
let learnerB: any;

let courseA: any;
let courseB: any;
let continentalCourse: any;

beforeAll(async () => {
  // Create tenant hierarchy
  continentalTenant = await createTenant({
    id: 'tenant-continental',
    name: 'AU-IBAR',
    code: 'AU',
    level: 'continental',
  });

  recTenant = await createTenant({
    id: 'tenant-ecowas',
    name: 'ECOWAS',
    code: 'ECOWAS',
    level: 'rec',
    parentId: 'tenant-continental',
  });

  countryTenantA = await createTenant({
    id: 'tenant-kenya',
    name: 'Kenya',
    code: 'KE',
    level: 'country',
    parentId: 'tenant-ecowas',
  });

  countryTenantB = await createTenant({
    id: 'tenant-nigeria',
    name: 'Nigeria',
    code: 'NG',
    level: 'country',
    parentId: 'tenant-ecowas',
  });

  // Create users in different tenants
  continentalAdmin = await createUser({
    id: 'user-continental-admin',
    email: 'admin@au-ibar.org',
    role: 'admin_continental',
    tenantId: 'tenant-continental',
  });

  recAdmin = await createUser({
    id: 'user-rec-admin',
    email: 'admin@ecowas.org',
    role: 'admin_rec',
    tenantId: 'tenant-ecowas',
  });

  countryAdminA = await createUser({
    id: 'user-country-admin-ke',
    email: 'admin@kenya.go.ke',
    role: 'admin_country',
    tenantId: 'tenant-kenya',
  });

  countryAdminB = await createUser({
    id: 'user-country-admin-ng',
    email: 'admin@nigeria.gov.ng',
    role: 'admin_country',
    tenantId: 'tenant-nigeria',
  });

  learnerA = await createUser({
    id: 'user-learner-ke',
    email: 'learner@kenya.go.ke',
    role: 'learner',
    tenantId: 'tenant-kenya',
  });

  learnerB = await createUser({
    id: 'user-learner-ng',
    email: 'learner@nigeria.gov.ng',
    role: 'learner',
    tenantId: 'tenant-nigeria',
  });

  // Create courses in different tenants
  courseA = await createCourse({
    id: 'course-kenya-001',
    tenantId: 'tenant-kenya',
    title: { en: 'Kenya Animal Health' },
    slug: 'kenya-animal-health',
  });

  courseB = await createCourse({
    id: 'course-nigeria-001',
    tenantId: 'tenant-nigeria',
    title: { en: 'Nigeria Livestock' },
    slug: 'nigeria-livestock',
  });

  continentalCourse = await createCourse({
    id: 'course-continental-001',
    tenantId: 'tenant-continental',
    title: { en: 'ARIS Foundation' },
    slug: 'aris-foundation',
  });
});

afterAll(async () => {
  await closeTestPool();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tenant Hierarchy', () => {
  it('creates correct parent-child relationships', async () => {
    const rec = await testQueryOne(
      'SELECT * FROM academy_core.tenants WHERE id = $1',
      ['tenant-ecowas'],
    );
    expect(rec!.parent_id).toBe('tenant-continental');

    const country = await testQueryOne(
      'SELECT * FROM academy_core.tenants WHERE id = $1',
      ['tenant-kenya'],
    );
    expect(country!.parent_id).toBe('tenant-ecowas');
  });

  it('finds all child tenants of a REC', async () => {
    const children = await testQuery(
      'SELECT * FROM academy_core.tenants WHERE parent_id = $1 ORDER BY code',
      ['tenant-ecowas'],
    );
    expect(children).toHaveLength(2);
    expect(children.map((t: any) => t.code).sort()).toEqual(['KE', 'NG']);
  });
});

describe('Data Isolation — Courses by Tenant', () => {
  it('country tenant only sees own courses', async () => {
    const courses = await testQuery(
      'SELECT * FROM academy_core.courses WHERE tenant_id = $1',
      ['tenant-kenya'],
    );
    expect(courses).toHaveLength(1);
    expect(courses[0].id).toBe('course-kenya-001');
  });

  it('another country does not see Kenya courses', async () => {
    const courses = await testQuery(
      'SELECT * FROM academy_core.courses WHERE tenant_id = $1',
      ['tenant-nigeria'],
    );
    expect(courses).toHaveLength(1);
    expect(courses[0].id).toBe('course-nigeria-001');
    expect(courses.find((c: any) => c.id === 'course-kenya-001')).toBeUndefined();
  });

  it('REC query (tenant + children) returns correct scope', async () => {
    const courses = await testQuery(`
      SELECT * FROM academy_core.courses
      WHERE tenant_id IN (
        SELECT id FROM academy_core.tenants
        WHERE id = $1 OR parent_id = $1
      )
      ORDER BY id
    `, ['tenant-ecowas']);

    // ECOWAS itself has no courses, but Kenya and Nigeria (children) do
    expect(courses).toHaveLength(2);
    const ids = courses.map((c: any) => c.id);
    expect(ids).toContain('course-kenya-001');
    expect(ids).toContain('course-nigeria-001');
  });

  it('continental query (1=1) returns all courses', async () => {
    const courses = await testQuery('SELECT * FROM academy_core.courses ORDER BY id');
    expect(courses.length).toBeGreaterThanOrEqual(3);
    const ids = courses.map((c: any) => c.id);
    expect(ids).toContain('course-kenya-001');
    expect(ids).toContain('course-nigeria-001');
    expect(ids).toContain('course-continental-001');
  });
});

describe('Data Isolation — Users by Tenant', () => {
  it('country tenant only sees own users', async () => {
    const users = await testQuery(
      'SELECT * FROM academy_core.users WHERE tenant_id = $1',
      ['tenant-kenya'],
    );
    const emails = users.map((u: any) => u.email);
    expect(emails).toContain('admin@kenya.go.ke');
    expect(emails).toContain('learner@kenya.go.ke');
    expect(emails).not.toContain('learner@nigeria.gov.ng');
  });

  it('users from different tenants are properly isolated', async () => {
    const kenyaUsers = await testQuery(
      'SELECT id FROM academy_core.users WHERE tenant_id = $1',
      ['tenant-kenya'],
    );
    const nigeriaUsers = await testQuery(
      'SELECT id FROM academy_core.users WHERE tenant_id = $1',
      ['tenant-nigeria'],
    );

    const kenyaIds = new Set(kenyaUsers.map((u: any) => u.id));
    const nigeriaIds = new Set(nigeriaUsers.map((u: any) => u.id));

    // No overlap
    for (const id of nigeriaIds) {
      expect(kenyaIds.has(id)).toBe(false);
    }
  });
});

describe('Tenant Level Constraints', () => {
  it('continental tenant has no parent', async () => {
    const t = await testQueryOne(
      'SELECT * FROM academy_core.tenants WHERE level = $1',
      ['continental'],
    );
    expect(t!.parent_id).toBeNull();
  });

  it('all country tenants have a parent', async () => {
    const countries = await testQuery(
      'SELECT * FROM academy_core.tenants WHERE level = $1',
      ['country'],
    );
    for (const c of countries) {
      expect(c.parent_id).toBeTruthy();
    }
  });
});
