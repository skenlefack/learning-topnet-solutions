# Topnet Solutions Academy — Testing Guide

## Test Architecture

The project uses a layered testing strategy:

```
Unit Tests          → fast, no I/O, mocked dependencies
Route Tests         → Fastify inject, mocked DB/Kafka/Redis
Integration Tests   → real PostgreSQL via Testcontainers
E2E Tests           → Playwright against built Next.js app
```

### Backend (Vitest)

| Layer        | Config                      | Command               | Requires   |
|--------------|-----------------------------|------------------------|------------|
| Unit         | `vitest.unit.config.ts`     | `npm run test:unit`    | Nothing    |
| Routes       | `vitest.routes.config.ts`   | `npm run test:routes`  | Nothing    |
| Integration  | `vitest.config.ts`          | `npm test`             | Docker     |

### Frontend (Vitest + Playwright)

| Layer        | Config                   | Command                | Requires          |
|--------------|--------------------------|-------------------------|--------------------|
| Components   | `vitest.config.ts`       | `npm test`              | Nothing            |
| E2E          | `playwright.config.ts`   | `npm run test:e2e`      | `next build`       |

## Running Tests

```bash
# Backend — all unit tests (no Docker needed)
cd backend && npm run test:unit

# Backend — route tests (no Docker needed)
cd backend && npm run test:routes

# Backend — integration tests (needs Docker for Testcontainers)
cd backend && npm test

# Frontend — component/hook tests
cd frontend && npm test

# Frontend — E2E (needs built app)
cd frontend && npm run test:e2e

# Frontend — E2E with browser visible
cd frontend && npm run test:e2e:headed
```

## Test Conventions

### File Naming

- Unit tests: `tests/unit/<service>/<name>.test.ts`
- Route tests: `tests/routes/<name>-routes.test.ts`
- Integration tests: `tests/integration/<name>.test.ts`
- Frontend component tests: `tests/components/<Component>.test.tsx`
- E2E tests: `tests/e2e/<flow>.spec.ts`

### Mocking Pattern (Backend)

All route/unit tests must mock `@fastify/rate-limit` due to the shared barrel import:

```typescript
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));
```

When using `importOriginal` for `@topnet-academy/shared`:

```typescript
vi.mock('@topnet-academy/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@topnet-academy/shared')>();
  return {
    ...original,
    query: (...args: any[]) => mockQuery(...args),
    queryOne: (...args: any[]) => mockQueryOne(...args),
    publishEvent: vi.fn().mockResolvedValue(undefined),
    auditLog: vi.fn().mockResolvedValue(undefined),
  };
});
```

### JWT Test Helpers

```typescript
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'test-secret';

function signToken(overrides = {}) {
  return jwt.sign({
    sub: 'user-1',
    email: 'test@topnet-solutions.com',
    role: 'learner',
    tenantId: 'topnet-solutions',
    tenantLevel: 'continental',
    ...overrides,
  }, TEST_SECRET, { expiresIn: '1h' });
}
```

### Fastify Route Testing

Use `app.inject()` — no HTTP server needed:

```typescript
const app = Fastify({ logger: false });
await app.register(fastifyJwt, { secret: TEST_SECRET });
await app.register(authPlugin);
await app.register(myRoutes);
await app.ready();

const res = await app.inject({
  method: 'GET',
  url: '/my-route',
  headers: { authorization: `Bearer ${signToken()}` },
});

expect(res.statusCode).toBe(200);
```

### Frontend Mocks (MSW)

API calls are mocked with Mock Service Worker in `tests/mocks/`:

- `server.ts` — MSW server setup
- `handlers.ts` — API request handlers
- `data.ts` — Mock data for all endpoints

## Coverage

Coverage is tracked with v8 provider and uploaded to Codecov in CI.

**Backend thresholds:** 60% lines, 50% branches, 55% functions
**Frontend thresholds:** 50% lines, 40% branches, 45% functions

Run coverage locally:

```bash
# Backend
cd backend && npx vitest run --coverage

# Frontend
cd frontend && npx vitest run --coverage
```

## CI/CD Integration

- **ci.yml** — Runs on PR + push to main/develop: type-check, lint, unit tests + coverage, Codecov upload
- **e2e.yml** — Runs on PR (frontend changes) + weekly Monday 6:00 UTC: Playwright chromium
- **deploy.yml** — Push to main: build + deploy (no test gate)

## Testcontainers (Integration Tests)

Integration tests use `testcontainers` to start a real PostgreSQL 16 instance:

- Setup: `tests/setup.ts` — starts container, runs `init.sql` + `seed.sql`
- Teardown: stops container automatically
- Env: `DATABASE_URL` is set dynamically

Requires Docker running locally. In CI, GitHub Actions runners have Docker pre-installed.

## Kafka Tests

Kafka is mocked in unit tests via `vi.mock('kafkajs')`. Tests verify:

- Event structure (eventId, eventType, version, tenantId, payload)
- Consumer subscription patterns
- Handler invocation with parsed messages
- Graceful degradation when Kafka is unavailable

See `tests/unit/shared/kafka.test.ts` for patterns.
