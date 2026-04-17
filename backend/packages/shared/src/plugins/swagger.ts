// ============================================================================
// ARIS Academy — Swagger / OpenAPI Plugin (Fastify)
// Registers @fastify/swagger + @fastify/swagger-ui on each microservice.
// Usage: fastify.register(swaggerPlugin, { serviceName, servicePort })
// Exposes:
//   GET /openapi.json — machine-readable OpenAPI 3.0 spec
//   GET /docs          — Swagger UI
// ============================================================================
import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

export interface SwaggerPluginOptions {
  serviceName: string;
  serviceDescription?: string;
  servicePort?: number;
}

const SERVICE_DESCRIPTIONS: Record<string, string> = {
  'academy-course':
    'Manages courses, modules, lessons, content and multi-tenant inheritance for the ARIS Academy LMS.',
  'academy-learning':
    'Handles authentication, enrollments, progress tracking, dashboard, community, notifications, profiles and admin operations.',
  'academy-assessment':
    'Provides question bank, adaptive exams, scoring engine and PDF certificate generation with QR verification.',
  'academy-live':
    'Manages BigBlueButton live sessions, scheduling, attendance tracking, recordings and webhooks.',
};

async function swaggerPluginImpl(
  fastify: FastifyInstance,
  opts: SwaggerPluginOptions,
): Promise<void> {
  const { serviceName, serviceDescription, servicePort } = opts;

  const description =
    serviceDescription || SERVICE_DESCRIPTIONS[serviceName] || `${serviceName} API`;

  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: `ARIS Academy — ${serviceName}`,
        description,
        version: '1.0.0',
        contact: { name: 'AU-IBAR / ARIS Team', email: 'ops-team@au-ibar.org' },
      },
      servers: [
        ...(servicePort
          ? [{ url: `http://localhost:${servicePort}`, description: 'Development' }]
          : []),
        { url: 'https://learning.au-ibar.org', description: 'Production' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from POST /auth/login',
          },
        },
      },
      tags: buildTags(serviceName),
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 3,
    },
  });
}

function buildTags(serviceName: string): Array<{ name: string; description: string }> {
  switch (serviceName) {
    case 'academy-course':
      return [
        { name: 'Courses', description: 'Course CRUD, publish, archive, duplicate, overrides' },
        { name: 'Modules', description: 'Course modules management and reordering' },
        { name: 'Lessons', description: 'Lesson CRUD, file uploads, reordering' },
        { name: 'Search', description: 'Full-text search across courses, modules, lessons' },
        { name: 'Health', description: 'Service health and readiness checks' },
      ];
    case 'academy-learning':
      return [
        { name: 'Auth', description: 'Authentication (login)' },
        { name: 'Enrollments', description: 'Course enrollment management' },
        { name: 'Progress', description: 'Lesson progress tracking and video heartbeat' },
        { name: 'Dashboard', description: 'Learner dashboard and leaderboard' },
        { name: 'Notifications', description: 'User notifications' },
        { name: 'Community', description: 'Forum posts, study groups' },
        { name: 'Profile', description: 'User profile and avatar' },
        { name: 'Admin', description: 'User management, bulk import, analytics' },
      ];
    case 'academy-assessment':
      return [
        { name: 'Assessments', description: 'Assessment/quiz CRUD' },
        { name: 'Attempts', description: 'Start and submit assessment attempts' },
        { name: 'Certifications', description: 'Certificate verification, download, stats' },
        { name: 'Questions', description: 'Question bank management and bulk import' },
      ];
    case 'academy-live':
      return [
        { name: 'Sessions', description: 'Live session scheduling, start, end, join' },
        { name: 'Recordings', description: 'Recording list, stream, process, delete' },
        { name: 'Webhooks', description: 'BigBlueButton callback webhooks' },
        { name: 'Attendance', description: 'Session attendance reports and CSV export' },
      ];
    default:
      return [];
  }
}

export default fp(swaggerPluginImpl, {
  name: 'academy-swagger',
  dependencies: [],
});
