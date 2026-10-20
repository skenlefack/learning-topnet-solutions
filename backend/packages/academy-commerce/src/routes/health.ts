import type { FastifyInstance } from 'fastify';
import { isDbAvailable, isRedisAvailable } from '@topnet-academy/shared';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async (_req, reply) => {
    const db = await isDbAvailable();
    const redis = await isRedisAvailable();
    const status = db ? 'ok' : 'degraded';
    return reply.code(db ? 200 : 503).send({
      service: 'academy-commerce',
      status,
      checks: { database: db, redis },
      timestamp: new Date().toISOString(),
    });
  });
}
