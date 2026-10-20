// ============================================================================
// Topnet Solutions Academy — Commerce Service (academy-commerce)
// Port: 4005
// Manages: offers, orders, payments, wallets, coupons, services
// Generic payment gateway supporting any merchant via configurable adapters
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
import { healthRoutes } from './routes/health';
import { offerRoutes } from './routes/offers';
import { orderRoutes } from './routes/orders';
import { paymentRoutes } from './routes/payments';
import { webhookRoutes } from './routes/webhooks';
import { walletRoutes } from './routes/wallet';
import { couponRoutes } from './routes/coupons';
import { sponsorRoutes } from './routes/sponsors';
import { serviceRoutes } from './routes/services';
import { adminStatsRoutes } from './routes/admin-stats';
import { initConsumers } from './consumers';

const SERVICE_NAME = 'academy-commerce';
const PORT = parseInt(process.env.SERVICE_PORT || '4005', 10);

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

  // --- Shared auth + tenant scope plugins ---
  await app.register(authPlugin);
  await app.register(tenantScopePlugin);

  // --- Add raw body support for webhook HMAC verification ---
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => {
      try {
        (req as any).rawBody = body;
        done(null, JSON.parse(body as string));
      } catch (err: any) {
        done(err, undefined);
      }
    },
  );

  // --- Routes ---
  await app.register(healthRoutes, { prefix: '/health' });
  await app.register(webhookRoutes, { prefix: '/webhooks' });
  await app.register(sponsorRoutes, { prefix: '/sponsor' });
  await app.register(offerRoutes, { prefix: '/offers' });
  await app.register(orderRoutes, { prefix: '/orders' });
  await app.register(paymentRoutes, { prefix: '/payments' });
  await app.register(walletRoutes, { prefix: '/wallet' });
  await app.register(couponRoutes, { prefix: '/coupons' });
  await app.register(serviceRoutes, { prefix: '/services' });
  await app.register(adminStatsRoutes, { prefix: '/admin' });

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

  // --- Non-blocking init (Kafka) ---
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
