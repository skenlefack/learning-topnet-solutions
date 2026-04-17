# ARIS Academy -- API Reference

> **Base domain (production):** `https://learning.au-ibar.org`
> **Swagger UI:** Each service exposes interactive docs at `GET /docs`.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Multi-Tenant Model](#multi-tenant-model)
3. [Common Conventions](#common-conventions)
4. [academy-course (port 4001)](#academy-course-port-4001)
5. [academy-learning (port 4002)](#academy-learning-port-4002)
6. [academy-assessment (port 4003)](#academy-assessment-port-4003)
7. [academy-live (port 4004)](#academy-live-port-4004)
8. [Error Responses](#error-responses)

---

## Authentication

All routes require a JWT Bearer token unless explicitly marked **PUBLIC**.

### Obtaining a Token

```
POST /auth/login          (academy-learning, port 4002)
Content-Type: application/json

{
  "email": "user@example.org",
  "password": "s3cret"
}
```

**Response 200:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.org",
    "role": "learner",
    "tenantPath": "continental/rec-ecowas/ng"
  }
}
```

### Using the Token

Include the token in every subsequent request:

```
Authorization: Bearer <token>
```

### Roles

| Role                 | Description                                |
|----------------------|--------------------------------------------|
| `learner`            | End-user enrolled in courses               |
| `trainer`            | Facilitator who manages live sessions      |
| `admin_country`      | Country-level administrator                |
| `admin_rec`          | Regional Economic Community administrator  |
| `admin_continental`  | Continental (AU-IBAR) super administrator  |

---

## Multi-Tenant Model

ARIS Academy uses a three-tier tenant hierarchy enforced via PostgreSQL Row-Level Security (RLS):

```
Continental  (AU-IBAR)
  +-- REC        (e.g. ECOWAS, IGAD, SADC, ...)
       +-- Country   (e.g. NG, KE, ZA, ...)
```

- Every authenticated request carries the user's `tenantPath`.
- Queries are automatically scoped so users only see data within their tenant and below.
- `admin_continental` sees all data; `admin_rec` sees their REC and its countries; `admin_country` sees only their country.

### MultiLangText

Text fields that support translation use a JSONB structure:

```json
{
  "fr": "Introduction a la sante animale",
  "en": "Introduction to Animal Health",
  "ar": "...",
  "pt": "..."
}
```

Supported languages: **fr** (French), **en** (English), **ar** (Arabic), **pt** (Portuguese).

---

## Common Conventions

| Convention              | Detail                                              |
|-------------------------|-----------------------------------------------------|
| Content-Type            | `application/json` (except file uploads)             |
| Pagination              | `?page=1&limit=20` -- response includes `total`     |
| Sorting                 | `?sort=createdAt&order=desc`                         |
| Filtering               | Query params vary per endpoint                       |
| IDs                     | UUID v4                                              |
| Timestamps              | ISO 8601 (`2026-04-17T12:00:00Z`)                   |
| File uploads            | `multipart/form-data`                                |
| Health (all services)   | `GET /health` (liveness), `GET /health/ready` (readiness) |

---

## academy-course (port 4001)

Manages courses, modules, lessons, and content. Swagger UI at `GET /docs`.

### Courses

| Method | Path                            | Auth | Description                                    |
|--------|---------------------------------|------|------------------------------------------------|
| GET    | `/courses`                      | Yes  | List courses (paginated, filterable)           |
| GET    | `/courses/:id`                  | Yes  | Get course by ID (includes modules)            |
| GET    | `/courses/:id/resolved?lang=`   | Yes  | Get course with tenant overrides applied       |
| POST   | `/courses`                      | Yes  | Create a new course                            |
| PUT    | `/courses/:id`                  | Yes  | Update a course                                |
| DELETE | `/courses/:id`                  | Yes  | Delete course (admin_rec / admin_continental)  |
| POST   | `/courses/:id/publish`          | Yes  | Publish a draft course                         |
| POST   | `/courses/:id/archive`          | Yes  | Archive a course                               |
| POST   | `/courses/:id/duplicate`        | Yes  | Deep copy course + modules + lessons           |

#### Query parameters for `GET /courses`

| Param    | Type   | Description                            |
|----------|--------|----------------------------------------|
| `page`   | number | Page number (default 1)                |
| `limit`  | number | Items per page (default 20)            |
| `level`  | string | Filter by level                        |
| `status` | string | Filter by status (draft/published/archived) |
| `search` | string | Full-text search on title/description  |
| `lang`   | string | Preferred language for MultiLangText   |

#### Create course -- request body

```json
{
  "title": { "en": "Animal Health 101", "fr": "Sante animale 101" },
  "description": { "en": "Introductory course...", "fr": "Cours d'introduction..." },
  "slug": "animal-health-101",
  "level": "beginner",
  "status": "draft",
  "estimatedHours": 12,
  "passingScore": 70,
  "tags": ["animal-health", "introductory"]
}
```

#### Create course -- response 201

```json
{
  "id": "a1b2c3d4-...",
  "title": { "en": "Animal Health 101", "fr": "Sante animale 101" },
  "slug": "animal-health-101",
  "level": "beginner",
  "status": "draft",
  "estimatedHours": 12,
  "passingScore": 70,
  "tags": ["animal-health", "introductory"],
  "tenantId": "continental",
  "createdAt": "2026-04-17T10:00:00Z",
  "updatedAt": "2026-04-17T10:00:00Z"
}
```

### Tenant Overrides

| Method | Path                            | Auth | Description                     |
|--------|---------------------------------|------|---------------------------------|
| POST   | `/courses/:id/override`         | Yes  | Upsert tenant override          |
| GET    | `/courses/:id/overrides`        | Yes  | List overrides for a course     |
| DELETE | `/courses/:id/override`         | Yes  | Delete tenant override          |

### Modules

| Method | Path                            | Auth | Description                     |
|--------|---------------------------------|------|---------------------------------|
| GET    | `/modules/course/:courseId`     | Yes  | List modules for a course       |
| POST   | `/modules`                      | Yes  | Create module                   |
| PUT    | `/modules/:id`                  | Yes  | Update module                   |
| DELETE | `/modules/:id`                  | Yes  | Delete module                   |
| POST   | `/modules/reorder`              | Yes  | Reorder modules                 |

### Lessons

| Method | Path                            | Auth | Description                              |
|--------|---------------------------------|------|-----------------------------------------|
| GET    | `/lessons/module/:moduleId`     | Yes  | List lessons for a module               |
| GET    | `/lessons/:id`                  | Yes  | Get lesson by ID                        |
| POST   | `/lessons`                      | Yes  | Create lesson                           |
| PUT    | `/lessons/:id`                  | Yes  | Update lesson                           |
| DELETE | `/lessons/:id`                  | Yes  | Delete lesson                           |
| POST   | `/lessons/:id/upload`           | Yes  | Upload file (multipart, max 500 MB)     |
| POST   | `/lessons/reorder`              | Yes  | Reorder lessons                         |

### Search

| Method | Path                            | Auth | Description                     |
|--------|---------------------------------|------|---------------------------------|
| GET    | `/search/search?q=&lang=&limit=`| Yes  | Global full-text search         |

### Health

| Method | Path              | Auth   | Description        |
|--------|-------------------|--------|--------------------|
| GET    | `/health`         | PUBLIC | Liveness check     |
| GET    | `/health/ready`   | PUBLIC | Readiness (DB)     |

---

## academy-learning (port 4002)

Manages authentication, enrollments, progress tracking, dashboard, notifications, community forum, user profiles, and admin operations.

### Authentication

| Method | Path              | Auth   | Description                  |
|--------|-------------------|--------|------------------------------|
| POST   | `/auth/login`     | PUBLIC | Login with email + password  |

### Enrollments

| Method | Path                                | Auth | Description                    |
|--------|-------------------------------------|------|--------------------------------|
| GET    | `/enrollments`                      | Yes  | List user enrollments          |
| POST   | `/enrollments`                      | Yes  | Enroll in a course             |
| GET    | `/enrollments/:id/next-course`      | Yes  | Suggest next course            |
| GET    | `/enrollments/:id/time-estimate`    | Yes  | Estimated remaining time       |

#### Enroll -- request body

```json
{
  "courseId": "a1b2c3d4-..."
}
```

### Progress

| Method | Path                                | Auth | Description                          |
|--------|-------------------------------------|------|--------------------------------------|
| GET    | `/progress/:enrollmentId`           | Yes  | Lesson progress for enrollment       |
| POST   | `/progress`                         | Yes  | Update lesson progress               |
| POST   | `/progress/video-heartbeat`         | Yes  | Video position heartbeat (Redis)     |
| GET    | `/progress/resume/:lessonId`        | Yes  | Last playback position               |

#### Update progress -- request body

```json
{
  "lessonId": "uuid",
  "enrollmentId": "uuid",
  "timeSpentSeconds": 120,
  "lastPositionSeconds": 85,
  "isCompleted": false,
  "score": null
}
```

### Dashboard

| Method | Path                        | Auth | Description                     |
|--------|-----------------------------|------|---------------------------------|
| GET    | `/dashboard`                | Yes  | Learner dashboard               |
| GET    | `/dashboard/leaderboard`    | Yes  | Ranked learners                 |
| GET    | `/dashboard/stats`          | Yes  | Admin stats                     |

### Notifications

| Method | Path                          | Auth | Description            |
|--------|-------------------------------|------|------------------------|
| GET    | `/notifications`              | Yes  | List notifications (paginated) |
| GET    | `/notifications/unread-count` | Yes  | Unread notification count |
| PUT    | `/notifications/:id/read`     | Yes  | Mark notification as read |
| PUT    | `/notifications/read-all`     | Yes  | Mark all as read       |

### Community Forum

| Method | Path                              | Auth | Description            |
|--------|-----------------------------------|------|------------------------|
| GET    | `/community/posts`                | Yes  | List forum posts       |
| GET    | `/community/posts/:id`            | Yes  | Get post by ID         |
| GET    | `/community/posts/:id/replies`    | Yes  | Get replies to post    |
| POST   | `/community/posts`                | Yes  | Create post or reply   |
| POST   | `/community/posts/:id/upvote`     | Yes  | Upvote a post          |
| DELETE | `/community/posts/:id`            | Yes  | Delete a post          |

### Study Groups

| Method | Path                              | Auth | Description            |
|--------|-----------------------------------|------|------------------------|
| GET    | `/community/groups`               | Yes  | List study groups      |
| POST   | `/community/groups`               | Yes  | Create study group     |
| POST   | `/community/groups/:id/join`      | Yes  | Join a group           |
| POST   | `/community/groups/:id/leave`     | Yes  | Leave a group          |
| DELETE | `/community/groups/:id`           | Yes  | Delete a group         |

### User Profile

| Method | Path                | Auth | Description            |
|--------|---------------------|------|------------------------|
| GET    | `/users/me`         | Yes  | Get own profile        |
| PUT    | `/users/me`         | Yes  | Update own profile     |
| POST   | `/users/me/avatar`  | Yes  | Upload avatar (multipart) |

### Admin

| Method | Path                                  | Auth | Description                        |
|--------|---------------------------------------|------|------------------------------------|
| GET    | `/admin/stats`                        | Yes  | Admin statistics                   |
| GET    | `/admin/users`                        | Yes  | List users (paginated)             |
| POST   | `/admin/users`                        | Yes  | Create user                        |
| PUT    | `/admin/users/:id`                    | Yes  | Update user                        |
| POST   | `/admin/users/bulk-import`            | Yes  | Bulk import users (1--1000)        |
| GET    | `/admin/tenants`                      | Yes  | List tenants                       |
| GET    | `/admin/courses/:courseId/analytics`  | Yes  | Course analytics                   |

#### Bulk import -- request body

```json
{
  "users": [
    {
      "email": "alice@example.org",
      "firstName": "Alice",
      "lastName": "Doe",
      "role": "learner",
      "tenantId": "country-ng"
    }
  ]
}
```

### Health

| Method | Path              | Auth   | Description        |
|--------|-------------------|--------|--------------------|
| GET    | `/health`         | PUBLIC | Liveness check     |
| GET    | `/health/ready`   | PUBLIC | Readiness (DB)     |

---

## academy-assessment (port 4003)

Manages assessments, exam attempts, certifications, and question banks.

### Assessments

| Method | Path                                | Auth | Description                     |
|--------|-------------------------------------|------|---------------------------------|
| GET    | `/assessments/course/:courseId`     | Yes  | List assessments for a course   |
| GET    | `/assessments/:id`                  | Yes  | Get assessment by ID            |
| POST   | `/assessments`                      | Yes  | Create assessment               |
| PUT    | `/assessments/:id`                  | Yes  | Update assessment               |
| DELETE | `/assessments/:id`                  | Yes  | Delete assessment               |

### Attempts

| Method | Path                                | Auth | Description                     |
|--------|-------------------------------------|------|---------------------------------|
| POST   | `/attempts/start`                   | Yes  | Start an exam attempt           |
| POST   | `/attempts/:attemptId/submit`       | Yes  | Submit answers for attempt      |

#### Start attempt -- request body

```json
{
  "assessmentId": "uuid"
}
```

#### Submit attempt -- request body

```json
{
  "answers": [
    { "questionId": "uuid", "selectedOptionIds": ["uuid"] }
  ]
}
```

### Certifications

| Method | Path                                        | Auth   | Description                      |
|--------|---------------------------------------------|--------|----------------------------------|
| GET    | `/verify/:certNumber`                       | PUBLIC | Verify certificate by number     |
| GET    | `/certifications`                           | Yes    | List my certificates             |
| GET    | `/certifications/download/:certNumber`      | Yes    | Download certificate PDF         |
| POST   | `/certifications/:id/revoke`                | Yes    | Revoke a certificate             |
| GET    | `/certifications/summary`                   | Yes    | Summary by level                 |
| GET    | `/certifications/stats`                     | Yes    | Certification statistics         |

#### Verify certificate -- response 200

```json
{
  "valid": true,
  "certNumber": "ARIS-2026-00001",
  "holder": "Alice Doe",
  "course": "Animal Health 101",
  "level": "beginner",
  "issuedAt": "2026-03-15T08:00:00Z",
  "revokedAt": null
}
```

### Questions

| Method | Path                                    | Auth | Description                     |
|--------|-----------------------------------------|------|---------------------------------|
| POST   | `/questions`                            | Yes  | Create question                 |
| POST   | `/questions/bulk-import`                | Yes  | Bulk import questions           |
| GET    | `/questions/export?assessmentId=`       | Yes  | Export questions                 |

### Health

| Method | Path              | Auth   | Description        |
|--------|-------------------|--------|--------------------|
| GET    | `/health`         | PUBLIC | Liveness check     |
| GET    | `/health/ready`   | PUBLIC | Readiness (DB)     |

---

## academy-live (port 4004)

Manages live sessions, BigBlueButton integration, recordings, and attendance.

### Sessions

| Method | Path                              | Auth | Description                     |
|--------|-----------------------------------|------|---------------------------------|
| GET    | `/sessions`                       | Yes  | List sessions                   |
| GET    | `/sessions/upcoming`              | Yes  | Sessions in next 7 days         |
| GET    | `/sessions/recordings`            | Yes  | Sessions that have recordings   |
| GET    | `/sessions/:id`                   | Yes  | Session detail                  |
| POST   | `/sessions`                       | Yes  | Schedule a new session          |
| PUT    | `/sessions/:id`                   | Yes  | Update session                  |
| DELETE | `/sessions/:id`                   | Yes  | Cancel session                  |
| GET    | `/sessions/:id/join`              | Yes  | Get BBB join URL                |
| POST   | `/sessions/:id/start`             | Yes  | Start BBB meeting               |
| GET    | `/sessions/:id/status`            | Yes  | Meeting status (running/ended)  |
| POST   | `/sessions/:id/end`               | Yes  | End BBB meeting                 |
| GET    | `/sessions/:id/attendance`        | Yes  | Attendance list                 |

#### Schedule session -- request body

```json
{
  "title": { "en": "Animal Health Q&A", "fr": "Q&R Sante animale" },
  "courseId": "uuid",
  "scheduledStart": "2026-04-20T14:00:00Z",
  "scheduledEnd": "2026-04-20T15:30:00Z",
  "maxParticipants": 100
}
```

### Recordings

| Method | Path                                  | Auth | Description                     |
|--------|---------------------------------------|------|---------------------------------|
| GET    | `/recordings`                         | Yes  | List recordings (paginated)     |
| GET    | `/recordings/:id/stream`              | Yes  | Get presigned stream URL        |
| DELETE | `/recordings/:id`                     | Yes  | Delete recording                |
| GET    | `/recordings/session/:sessionId`      | Yes  | Recordings for a session        |
| POST   | `/recordings/:id/process`             | Yes  | Process/transcode recording     |

### Attendance

| Method | Path                              | Auth | Description                     |
|--------|-----------------------------------|------|---------------------------------|
| GET    | `/:id/attendance`                 | Yes  | Attendance report               |
| GET    | `/:id/attendance/export`          | Yes  | Export attendance as CSV        |

### Webhooks

| Method | Path                  | Auth   | Description                        |
|--------|-----------------------|--------|------------------------------------|
| POST   | `/webhooks/bbb`       | PUBLIC | BBB webhook callback               |
| GET    | `/webhooks/health`    | PUBLIC | Webhook health check               |

### Health

| Method | Path              | Auth   | Description        |
|--------|-------------------|--------|--------------------|
| GET    | `/health`         | PUBLIC | Liveness check     |
| GET    | `/health/ready`   | PUBLIC | Readiness (DB)     |

---

## Error Responses

All services return errors in a consistent format:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "body/email must match format \"email\""
}
```

### Common Status Codes

| Code | Meaning                                    |
|------|--------------------------------------------|
| 200  | Success                                    |
| 201  | Created                                    |
| 204  | No Content (successful delete)             |
| 400  | Bad Request (validation failed)            |
| 401  | Unauthorized (missing or invalid token)    |
| 403  | Forbidden (insufficient role/tenant scope) |
| 404  | Not Found                                  |
| 409  | Conflict (duplicate enrollment, etc.)      |
| 429  | Too Many Requests (rate limited)           |
| 500  | Internal Server Error                      |

### Rate Limiting

All authenticated endpoints are rate-limited. Limits are per-user and reset on a sliding window. When exceeded, the response includes:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

---

*Generated for ARIS Academy v1.0 -- April 2026*
