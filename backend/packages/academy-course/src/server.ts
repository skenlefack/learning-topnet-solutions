// ============================================================================
// ARIS Academy — Course Service (academy-course)
// Port: 4001
// Manages: courses, modules, lessons, content, multi-tenant inheritance
// ============================================================================
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import {
  authPlugin,
  tenantScopePlugin,
  metricsPlugin,
  rateLimitPlugin,
  requestLoggerPlugin,
  swaggerPlugin,
  getCorsConfig,
} from '@aris-academy/shared';
import { courseRoutes } from './routes/courses';
import { moduleRoutes } from './routes/modules';
import { lessonRoutes } from './routes/lessons';
import { healthRoutes } from './routes/health';
import { searchRoutes } from './routes/search';
import { publicRoutes } from './routes/public';
import { categoryRoutes } from './routes/categories';
import { pathRoutes } from './routes/paths';
import { initConsumers } from './consumers';
import { initBuckets } from './services/minio';

const SERVICE_NAME = 'academy-course';
const PORT = parseInt(process.env.SERVICE_PORT || '4001', 10);

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  // --- Plugins ---
  await app.register(swaggerPlugin, { serviceName: SERVICE_NAME, servicePort: PORT });
  await app.register(metricsPlugin);
  await app.register(cors, getCorsConfig());
  await app.register(rateLimitPlugin);
  await app.register(requestLoggerPlugin);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret',
    sign: { expiresIn: '24h' },
  });

  await app.register(multipart, {
    limits: {
      fileSize: 500 * 1024 * 1024, // 500 MB
      files: 1,
    },
  });

  // --- Shared auth + tenant scope plugins ---
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);

  // --- Routes ---
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(publicRoutes, { prefix: '/public' });
  await app.register(categoryRoutes, { prefix: '/categories' });
  await app.register(pathRoutes, { prefix: '/paths' });
  await app.register(courseRoutes, { prefix: '/courses' });
  await app.register(moduleRoutes, { prefix: '/modules' });
  await app.register(lessonRoutes, { prefix: '/lessons' });
  await app.register(searchRoutes, { prefix: '/search' });

  // --- Validation error handler ---
  app.setErrorHandler((error, _request, reply) => {
    if ('validation' in error && 'statusCode' in error) {
      return reply.code((error as { statusCode: number }).statusCode).send({
        success: false,
        error: error.message,
        validation: (error as { validation: unknown }).validation,
      });
    }
    app.log.error(error);
    return reply.code(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  // --- Start ---
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`[${SERVICE_NAME}] Running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // --- Non-blocking init (MinIO + Kafka) ---
  try {
    await initBuckets();
  } catch (err: any) {
    app.log.warn(`[${SERVICE_NAME}] MinIO init failed (non-blocking): ${err.message}`);
  }

  try {
    await initConsumers();
  } catch (err: any) {
    app.log.warn(`[${SERVICE_NAME}] Kafka consumers failed (non-blocking): ${err.message}`);
  }

  // --- Graceful shutdown ---
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach(signal => {
    process.on(signal, async () => {
      app.log.info(`[${SERVICE_NAME}] Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap();
