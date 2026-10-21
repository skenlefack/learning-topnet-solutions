// ============================================================================
// Admin Stats Routes — Commerce dashboard stats
// ============================================================================
import type { FastifyInstance } from 'fastify';
import { query, queryOne, BearerSecurity } from '@topnet-academy/shared';

export async function adminStatsRoutes(app: FastifyInstance) {

  // GET /admin/stats — commerce dashboard
  app.get('/stats', {
    schema: { summary: 'Commerce dashboard stats', tags: ['Admin'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const { clause, params } = req.tenantFilter();
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthISO = monthStart.toISOString();

    const pBase = [...params];
    const tIdx = pBase.length + 1;
    pBase.push(monthISO);

    const [
      revenueMonth, revenueTotal, awaitingCount,
      usersMonth, usersTotal, payersCount,
      servicesOpen, byOffer, daily,
    ] = await Promise.all([
      queryOne<any>(
        `SELECT COALESCE(SUM(amount),0)::int AS total
         FROM academy_core.orders WHERE ${clause} AND status = 'paid' AND paid_at >= $${tIdx}`,
        pBase,
      ),
      queryOne<any>(
        `SELECT COALESCE(SUM(amount),0)::int AS total
         FROM academy_core.orders WHERE ${clause} AND status = 'paid'`,
        params,
      ),
      queryOne<any>(
        `SELECT COUNT(*)::int AS count
         FROM academy_core.orders WHERE ${clause} AND status = 'awaiting'`,
        params,
      ),
      queryOne<any>(
        `SELECT COUNT(*)::int AS count
         FROM academy_core.users WHERE ${clause} AND created_at >= $${tIdx}`,
        pBase,
      ),
      queryOne<any>(
        `SELECT COUNT(*)::int AS count FROM academy_core.users WHERE ${clause}`,
        params,
      ),
      queryOne<any>(
        `SELECT COUNT(DISTINCT user_id)::int AS count
         FROM academy_core.orders WHERE ${clause} AND status = 'paid' AND amount > 0`,
        params,
      ),
      queryOne<any>(
        `SELECT COUNT(*)::int AS count
         FROM academy_core.purchased_services WHERE ${clause}
         AND status IN ('to_schedule', 'scheduled', 'in_progress')`,
        params,
      ),
      query(
        `SELECT o.offer_id, of.name AS offer_name, of.kind,
                COUNT(*)::int AS count, COALESCE(SUM(o.amount),0)::int AS amount
         FROM academy_core.orders o
         JOIN academy_core.offers of ON of.id = o.offer_id
         WHERE ${clause === '1=1' ? '1=1' : 'o.' + clause} AND o.status = 'paid'
         GROUP BY o.offer_id, of.name, of.kind
         ORDER BY amount DESC`,
        params,
      ),
      query(
        `SELECT paid_at::date AS day, SUM(amount)::int AS amount, COUNT(*)::int AS count
         FROM academy_core.orders
         WHERE ${clause} AND status = 'paid' AND paid_at >= NOW() - INTERVAL '30 days'
         GROUP BY paid_at::date ORDER BY day`,
        params,
      ),
    ]);

    return reply.send({
      success: true,
      data: {
        revenueMonth: revenueMonth?.total || 0,
        revenueTotal: revenueTotal?.total || 0,
        awaitingOrders: awaitingCount?.count || 0,
        usersMonth: usersMonth?.count || 0,
        usersTotal: usersTotal?.count || 0,
        payersCount: payersCount?.count || 0,
        servicesOpen: servicesOpen?.count || 0,
        byOffer,
        daily,
      },
    });
  });

  // GET /admin/providers — list payment providers for this tenant
  app.get('/providers', {
    schema: { summary: 'List payment providers', tags: ['Admin'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const { clause, params } = req.tenantFilter();
    const rows = await query(
      `SELECT id, adapter_name, integration_type, display_name, description, logo_url,
              supported_currencies, is_active, sort_order, metadata, created_at
       FROM academy_core.payment_providers WHERE ${clause} ORDER BY sort_order`,
      params,
    );
    return reply.send({ success: true, data: rows });
  });

  // POST /admin/providers — create payment provider
  app.post('/providers', {
    schema: { summary: 'Create payment provider', tags: ['Admin'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const {
      adapterName, integrationType, displayName, description,
      logoUrl, config, supportedCurrencies, isActive, sortOrder,
    } = req.body as any;
    const tenantId = req.user.tenantId;

    // Encrypt secrets in config before storing
    const { encryptProviderConfig } = await import('@topnet-academy/shared');
    const encryptedConfig = encryptProviderConfig(config || {});

    const provider = await queryOne<any>(`
      INSERT INTO academy_core.payment_providers
        (tenant_id, adapter_name, integration_type, display_name, description,
         logo_url, config, supported_currencies, is_active, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id, adapter_name, integration_type, display_name, description,
                logo_url, supported_currencies, is_active, sort_order, created_at`,
      [
        tenantId, adapterName, integrationType,
        JSON.stringify(displayName || {}), JSON.stringify(description || {}),
        logoUrl || null, JSON.stringify(encryptedConfig),
        supportedCurrencies || ['XAF'], isActive !== false, sortOrder || 0,
      ],
    );

    return reply.code(201).send({ success: true, data: provider });
  });

  // PUT /admin/providers/:id — update payment provider
  app.put('/providers/:id', {
    schema: { summary: 'Update payment provider', tags: ['Admin'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const body = req.body as any;
    const sets: string[] = [];
    const params: any[] = [];

    const simpleFields: Record<string, string> = {
      adapterName: 'adapter_name',
      integrationType: 'integration_type',
      logoUrl: 'logo_url',
      isActive: 'is_active',
      sortOrder: 'sort_order',
    };

    for (const [key, col] of Object.entries(simpleFields)) {
      if (body[key] !== undefined) {
        params.push(body[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    for (const key of ['displayName', 'description']) {
      if (body[key] !== undefined) {
        const col = key === 'displayName' ? 'display_name' : key;
        params.push(JSON.stringify(body[key]));
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (body.supportedCurrencies) {
      params.push(body.supportedCurrencies);
      sets.push(`supported_currencies = $${params.length}`);
    }
    if (body.config !== undefined) {
      const { encryptProviderConfig } = await import('@topnet-academy/shared');
      params.push(JSON.stringify(encryptProviderConfig(body.config)));
      sets.push(`config = $${params.length}`);
    }

    if (sets.length === 0) {
      return reply.code(400).send({ success: false, error: 'No fields to update' });
    }

    params.push(req.params.id);
    const provider = await queryOne<any>(
      `UPDATE academy_core.payment_providers
       SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, adapter_name, integration_type, display_name, description,
                 logo_url, supported_currencies, is_active, sort_order`,
      params,
    );
    if (!provider) return reply.code(404).send({ success: false, error: 'Provider not found' });
    return reply.send({ success: true, data: provider });
  });

  // DELETE /admin/providers/:id — deactivate
  app.delete('/providers/:id', {
    schema: { summary: 'Deactivate payment provider', tags: ['Admin'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    await query(
      `UPDATE academy_core.payment_providers SET is_active = false WHERE id = $1`,
      [req.params.id],
    );
    return reply.status(204).send();
  });
}
