// ============================================================================
// Topnet Solutions Academy — Assessment Service (academy-assessment)
// Port: 4003
// Manages: question bank, adaptive exams, scoring, certification (PDF+QR)
// ============================================================================
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import {
  authPlugin,
  tenantScopePlugin,
  metricsPlugin,
  rateLimitPlugin,
  requestLoggerPlugin,
  swaggerPlugin,
  getCorsConfig,
} from '@topnet-academy/shared';
import { assessmentRoutes } from './routes/assessments';
import { attemptRoutes } from './routes/attempts';
import { certificationRoutes } from './routes/certifications';
import { questionRoutes } from './routes/questions';
import { pathExamRoutes } from './routes/path-exam';
import { skillRoutes } from './routes/skills';
import { initConsumers } from './consumers';
import { initBucket } from './services/certificate-generator';

const SERVICE_NAME = 'academy-assessment';
const PORT = parseInt(process.env.SERVICE_PORT || '4003', 10);

async function bootstrap() {
  const app = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    trustProxy: true,
  });

  // --- Plugins ---
  await app.register(swaggerPlugin, { serviceName: SERVICE_NAME, servicePort: PORT });
  await app.register(metricsPlugin);
  await app.register(cors, getCorsConfig());
  await app.register(rateLimitPlugin);
  await app.register(requestLoggerPlugin);
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });

  // --- Shared auth + tenant scope ---
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);

  // --- Routes ---
  await app.register(assessmentRoutes);
  await app.register(attemptRoutes, { prefix: '/attempts' });
  await app.register(certificationRoutes);
  await app.register(questionRoutes, { prefix: '/questions' });
  await app.register(pathExamRoutes);
  await app.register(skillRoutes, { prefix: '/skills' });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  }));

  // --- Error handler ---
  app.setErrorHandler((error, _request, reply) => {
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
    await initBucket();
  } catch (err: any) {
    app.log.warn(`[${SERVICE_NAME}] MinIO bucket init failed (non-blocking): ${err.message}`);
  }

  try {
    await initConsumers();
  } catch (err: any) {
    app.log.warn(`[${SERVICE_NAME}] Kafka consumers failed (non-blocking): ${err.message}`);
  }

  // --- Graceful shutdown ---
  const signals = ['SIGINT', 'SIGTERM'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`[${SERVICE_NAME}] Received ${signal}, shutting down...`);
      await app.close();
      process.exit(0);
    });
  });
}

bootstrap();
