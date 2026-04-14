// ============================================================================
// ARIS Academy — Health Check Routes
// ============================================================================
import { FastifyInstance } from 'fastify';
import { getPool } from '@aris-academy/shared';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/', async () => ({
    status: 'ok',
    service: process.env.SERVICE_NAME,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  app.get('/ready', async (_, reply) => {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      return { status: 'ready', db: 'connected' };
    } catch {
      return reply.code(503).send({ status: 'not_ready', db: 'disconnected' });
    }
  });
}
