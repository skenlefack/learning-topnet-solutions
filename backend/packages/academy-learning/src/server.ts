// ============================================================================
// Topnet Solutions Academy — Learning Service (academy-learning)
// Port: 4002
// Manages: enrollments, progress tracking, level unlocking, progression engine
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
} from '@topnet-academy/shared';
import { initBuckets } from './services/minio';
import { initConsumers } from './consumers';
import enrollmentRoutes from './routes/enrollments';
import progressRoutes from './routes/progress';
import dashboardRoutes from './routes/dashboard';
import authRoutes from './routes/auth';
import notificationRoutes from './routes/notifications';
import communityRoutes from './routes/community';
import profileRoutes from './routes/profile';
import adminRoutes from './routes/admin';

const SERVICE_NAME = 'academy-learning';
const PORT = parseInt(process.env.SERVICE_PORT || '4002', 10);

async function bootstrap() {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' },
    trustProxy: true,
  });

  // ---------- Plugins ----------
  await app.register(swaggerPlugin, { serviceName: SERVICE_NAME, servicePort: PORT });
  await app.register(metricsPlugin);
  await app.register(cors, getCorsConfig());
  await app.register(rateLimitPlugin);
  await app.register(requestLoggerPlugin);
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret' });
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);

  // ---------- Routes ----------
  await app.register(authRoutes);
  await app.register(enrollmentRoutes);
  await app.register(progressRoutes);
  await app.register(dashboardRoutes);
  await app.register(notificationRoutes);
  await app.register(communityRoutes);
  await app.register(profileRoutes);
  await app.register(adminRoutes);

  // ---------- Health ----------
  app.get('/health', async () => ({
    status: 'ok',
    service: SERVICE_NAME,
    timestamp: new Date().toISOString(),
  }));

  // ---------- Error handler ----------
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(error.statusCode || 500).send({
      success: false,
      error: error.message || 'Internal Server Error',
    });
  });

  // ---------- Start ----------
  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    app.log.info(`[${SERVICE_NAME}] Running on port ${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // --- Non-blocking Kafka init ---
  try {
    await initConsumers();
  } catch (err: any) {
    app.log.warn(`[${SERVICE_NAME}] Kafka consumers failed (non-blocking): ${err.message}`);
  }

  // --- Non-blocking MinIO bucket init ---
  try {
    await initBuckets();
  } catch (err: any) {
    app.log.warn(`[${SERVICE_NAME}] MinIO bucket init failed (non-blocking): ${err.message}`);
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
