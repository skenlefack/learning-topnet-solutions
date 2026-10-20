# Topnet Solutions Academy

**LMS multi-tenant certifiant pour Topnet Solutions / Topnet Solutions — 55 pays africains**

Production: [https://learning.topnet-solutions.com](https://learning.topnet-solutions.com)

---

## Architecture

```
                         ┌──────────────────────────────────────────┐
                         │              Traefik v3                  │
                         │         (Let's Encrypt TLS)              │
                         └──────┬──────────┬──────────┬─────────────┘
                                │          │          │
                    ┌───────────▼──┐  ┌────▼────┐  ┌─▼──────────────┐
                    │   Frontend   │  │   API   │  │   Monitoring   │
                    │  Next.js 14  │  │ Gateway │  │ Grafana :3000  │
                    │   :3000      │  │         │  │ Prometheus     │
                    └──────────────┘  └────┬────┘  └────────────────┘
                                           │
              ┌───────────┬────────────┬───┴────────┐
              │           │            │            │
        ┌─────▼─────┐ ┌──▼──────┐ ┌───▼─────┐ ┌───▼────┐
        │  Course   │ │Learning │ │Assess-  │ │  Live  │
        │  Service  │ │ Service │ │  ment   │ │Service │
        │  :4001    │ │  :4002  │ │ :4003   │ │ :4004  │
        └─────┬─────┘ └──┬─────┘ └───┬─────┘ └───┬────┘
              │          │            │            │
              └──────────┴─────┬──────┴────────────┘
                               │
          ┌──────────┬─────────┼──────────┬──────────┐
          │          │         │          │          │
     ┌────▼───┐ ┌───▼──┐ ┌───▼───┐ ┌────▼───┐ ┌───▼──────┐
     │Postgres│ │Redis │ │ Kafka │ │ MinIO  │ │   BBB    │
     │  16    │ │  7   │ │(KRaft)│ │  (S3)  │ │(separate │
     │  RLS   │ │      │ │       │ │        │ │   VM)    │
     └────────┘ └──────┘ └───────┘ └────────┘ └──────────┘
```

### Multi-tenant hierarchy (Row-Level Security)

```
Continental (AU) ─► REC (ECOWAS, SADC, ...) ─► Country (55 member states)
```

---

## Quick Start (Development)

### Prerequisites

- Docker and Docker Compose v2+
- Node.js 20+ and npm
- Git

### Setup

```bash
# Clone
git clone <repository-url>
cd learn.topnet-solutions.com

# Environment
cp .env.example .env
# Edit .env with local development values

# Start infrastructure
docker compose up -d postgres redis kafka minio

# Install dependencies
npm install --workspaces

# Run database migrations
npm run migrate --workspace=services/course-service

# Start all services (dev mode)
npm run dev
```

The frontend will be available at `http://localhost:3000`.

---

## Project Structure

```
learn.topnet-solutions.com/
├── frontend/                  # Next.js 14 application
│   ├── app/                   # App Router pages
│   ├── components/            # React components
│   ├── lib/                   # Utilities, API client, i18n
│   ├── public/                # Static assets
│   └── tests/                 # Frontend tests (Vitest + Playwright)
├── services/
│   ├── course-service/        # Course catalog & content (port 4001)
│   ├── learning-service/      # Enrollments & progress (port 4002)
│   ├── assessment-service/    # Quizzes & certification (port 4003)
│   └── live-service/          # BBB integration & attendance (port 4004)
├── packages/
│   └── shared/                # @topnet-academy/shared (types, auth, plugins)
├── infra/
│   ├── docker/                # Dockerfiles
│   ├── scripts/               # Backup, restore, seed, health-check
│   ├── monitoring/            # Prometheus, Grafana, AlertManager configs
│   └── traefik/               # Traefik configuration
├── db/
│   └── migrations/            # PostgreSQL migrations (RLS, triggers)
├── docs/                      # Documentation
├── docker-compose.yml         # Development stack
├── docker-compose.prod.yml    # Production overlay
└── .env.example               # Environment template
```

---

## Services

| Service      | Port | Stack           | Responsibility                                      |
|--------------|------|-----------------|-----------------------------------------------------|
| **course**   | 4001 | Fastify         | Course catalog, content management, multi-lang       |
| **learning** | 4002 | Fastify         | Enrollments, progress tracking, completion           |
| **assessment** | 4003 | Fastify       | Quizzes, exams, grading, certification               |
| **live**     | 4004 | Fastify         | BigBlueButton sessions, webhooks, attendance         |
| **frontend** | 3000 | Next.js 14      | SSR/CSR UI, Zustand state, i18n (FR/EN/AR/PT)       |
| **postgres** | 5432 | PostgreSQL 16   | Primary database with RLS multi-tenant               |
| **redis**    | 6379 | Redis 7         | Sessions, caching, rate-limiting                     |
| **kafka**    | 9092 | Kafka (KRaft)   | Event bus (enrollments, completions, live events)     |
| **minio**    | 9000 | MinIO           | S3-compatible object storage (videos, docs, certs)    |
| **traefik**  | 80/443 | Traefik v3    | Reverse proxy, TLS termination (Let's Encrypt)       |

---

## API Documentation

Each backend service exposes Swagger UI for interactive API exploration:

- Course Service: `http://localhost:4001/docs`
- Learning Service: `http://localhost:4002/docs`
- Assessment Service: `http://localhost:4003/docs`
- Live Service: `http://localhost:4004/docs`

Full API reference: [docs/API.md](docs/API.md)

---

## Testing

The project includes 388 tests across unit, integration, and end-to-end levels.

```bash
# Run all tests
npm test --workspaces

# Run frontend tests
cd frontend && npm test

# Run a specific service's tests
cd services/course-service && npm test

# Run E2E tests (Playwright)
cd frontend && npx playwright test
```

Test framework: **Vitest** (unit/integration) + **Playwright** (E2E)

Full testing guide: [docs/TESTING.md](docs/TESTING.md)

---

## Deployment

### Production (Docker Compose)

```bash
# On VM-ACADEMY
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Infrastructure

| VM           | vCPU | RAM   | Storage | Role                            |
|--------------|------|-------|---------|---------------------------------|
| VM-ACADEMY   | 8    | 32 GB | 300 GB  | Platform (all services + infra) |
| VM-BBB       | 8    | 16 GB | 200 GB  | BigBlueButton (video conferencing) |

Full deployment guide: [docs/deployment.md](docs/deployment.md)

---

## Monitoring

The monitoring stack runs alongside the application:

- **Prometheus** — metrics collection from all services
- **Grafana** — dashboards and visualization
- **AlertManager** — alerting rules and notification routing
- **Exporters** — node-exporter, postgres-exporter, redis-exporter

Each Fastify service exposes a `/metrics` endpoint (Prometheus format).

Operations guide: [docs/OPERATIONS.md](docs/OPERATIONS.md)
Disaster recovery: [docs/DISASTER-RECOVERY.md](docs/DISASTER-RECOVERY.md)

---

## Languages

Topnet Solutions Academy supports four languages across all UI and content:

| Code | Language   |
|------|------------|
| `en` | English    |
| `fr` | French     |
| `ar` | Arabic     |
| `pt` | Portuguese |

Content uses `MultiLangText` JSONB fields: `{ "en": "...", "fr": "...", "ar": "...", "pt": "..." }`

---

## Contributing

1. Create a feature branch from `main`: `git checkout -b feature/my-feature`
2. Make your changes, add tests
3. Run the test suite: `npm test --workspaces`
4. Ensure linting passes: `npm run lint --workspaces`
5. Submit a merge request against `main`

### Conventions

- **Commits**: `type(scope): description` (e.g., `fix(course): handle empty content array`)
- **Branches**: `feature/`, `fix/`, `docs/`, `refactor/`
- **Code style**: ESLint + Prettier (configured in each workspace)
- **i18n**: All user-facing strings must be translated in all 4 languages

---

## License

Proprietary — African Union Inter-African Bureau for Animal Resources (Topnet Solutions).
All rights reserved.
