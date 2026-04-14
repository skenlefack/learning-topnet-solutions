import jwt from 'jsonwebtoken';

const SECRET = 'test-secret-key-for-vitest';

export type TestRole = 'learner' | 'trainer' | 'admin_country' | 'admin_rec' | 'admin_continental';
export type TestTenantLevel = 'continental' | 'rec' | 'country';

interface TokenOptions {
  sub: string;
  email?: string;
  role: TestRole;
  tenantId: string;
  tenantLevel: TestTenantLevel;
  firstName?: string;
  lastName?: string;
}

export function createTestToken(opts: TokenOptions): string {
  return jwt.sign(
    {
      sub: opts.sub,
      email: opts.email || `test-${opts.sub.slice(0, 8)}@test.com`,
      role: opts.role,
      tenantId: opts.tenantId,
      tenantLevel: opts.tenantLevel,
      firstName: opts.firstName || 'Test',
      lastName: opts.lastName || 'User',
    },
    SECRET,
    { expiresIn: '1h' },
  );
}

// Pre-built tokens for common test scenarios
export const TOKENS = {
  continentalAdmin: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000201',
      email: 'serge@au-ibar.org',
      role: 'admin_continental',
      tenantId: '00000000-0000-0000-0000-000000000001',
      tenantLevel: 'continental',
      firstName: 'Serge',
      lastName: 'Admin',
    }),

  kenyaAdmin: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000901',
      email: 'admin@kenya.go.ke',
      role: 'admin_country',
      tenantId: '00000000-0000-0000-0000-000000000100',
      tenantLevel: 'country',
      firstName: 'Kenya',
      lastName: 'Admin',
    }),

  nigeriaAdmin: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000902',
      email: 'admin@nigeria.gov.ng',
      role: 'admin_country',
      tenantId: '00000000-0000-0000-0000-000000000101',
      tenantLevel: 'country',
      firstName: 'Nigeria',
      lastName: 'Admin',
    }),

  eacAdmin: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000903',
      email: 'admin@eac.int',
      role: 'admin_rec',
      tenantId: '00000000-0000-0000-0000-000000000011',
      tenantLevel: 'rec',
      firstName: 'EAC',
      lastName: 'Admin',
    }),

  trainer: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000202',
      email: 'amina.osei@au-ibar.org',
      role: 'trainer',
      tenantId: '00000000-0000-0000-0000-000000000001',
      tenantLevel: 'continental',
      firstName: 'Amina',
      lastName: 'Osei',
    }),

  kenyaLearner: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000904',
      email: 'learner@kenya.go.ke',
      role: 'learner',
      tenantId: '00000000-0000-0000-0000-000000000100',
      tenantLevel: 'country',
      firstName: 'Learner',
      lastName: 'Kenya',
    }),

  nigeriaLearner: () =>
    createTestToken({
      sub: '00000000-0000-0000-0000-000000000905',
      email: 'learner@nigeria.gov.ng',
      role: 'learner',
      tenantId: '00000000-0000-0000-0000-000000000101',
      tenantLevel: 'country',
      firstName: 'Learner',
      lastName: 'Nigeria',
    }),
};
