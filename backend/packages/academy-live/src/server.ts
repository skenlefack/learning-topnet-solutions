// ============================================================================
// ARIS Academy — Live Service (academy-live)
// Port: 4004
// Manages: BigBlueButton sessions, scheduling, recording, attendance
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
  getCorsConfig,
} from '@aris-academy/shared';
import { sessionRoutes } from './routes/sessions';
import { recordingRoutes } from './routes/recordings';
import { webhookRoutes } from './routes/webhooks';
import { attendanceRoutes } from './routes/attendance';
import { initConsumers } from './consumers';

const SERVICE_NAME = 'academy-live';
const PORT = parseInt(process.env.SERVICE_PORT || '4004', 10);

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
  await app.register(metricsPlugin);
  await app.register(cors, getCorsConfig());
  await app.register(rateLimitPlugin);
  await app.register(requestLoggerPlugin);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret',
    sign: { expiresIn: '24h' },
  });

  // --- Shared auth + tenant scope ---
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);

  // --- Webhook routes (no auth — BBB signs callbacks with shared secret) ---
  // Registered before authenticated routes; webhook handler validates checksums internally
  await app.register(webhookRoutes, { prefix: '/webhooks' });

  // --- Authenticated routes ---
  await app.register(sessionRoutes, { prefix: '/sessions' });
  await app.register(recordingRoutes, { prefix: '/recordings' });
  await app.register(attendanceRoutes, { prefix: '/attendance' });

  // --- Health ---
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

  // --- Non-blocking Kafka init ---
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

bootstrap().catch(console.error);
