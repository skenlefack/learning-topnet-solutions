// ============================================================================
// Webhook Routes — Generic endpoint for all payment providers
// POST /webhooks/:adapterName/:tenantId
// ============================================================================
import type { FastifyInstance } from 'fastify';
import { query, queryOne } from '@topnet-academy/shared';
import { getAdapter } from '../adapters/registry';
import { fulfillOrder } from '../services/fulfillment';

export async function webhookRoutes(app: FastifyInstance) {

  app.post('/:adapterName/:tenantId', {
    schema: { summary: 'Payment webhook endpoint', tags: ['Webhooks'] },
    // No auth — webhooks come from external providers
  }, async (req: any, reply) => {
    const { adapterName, tenantId } = req.params;
    const rawBody = (req as any).rawBody || JSON.stringify(req.body || {});

    // 1. Log immediately (before any processing)
    await query(
      `INSERT INTO academy_core.payment_log
       (tenant_id, provider_adapter, event_type, direction, payload)
       VALUES ($1, $2, 'webhook_received', 'inbound', $3)`,
      [tenantId, adapterName, JSON.stringify({ headers: req.headers, body: rawBody.slice(0, 10000) })],
    );

    // 2. Find provider config
    const provider = await queryOne<any>(
      `SELECT * FROM academy_core.payment_providers
       WHERE tenant_id = $1 AND adapter_name = $2 AND is_active = true`,
      [tenantId, adapterName],
    );

    if (!provider) {
      return reply.code(200).send({ ok: false, error: 'Provider not found' });
    }

    // 3. Parse webhook with adapter
    const adapter = getAdapter(adapterName);
    const parsed = await adapter.parseWebhook({
      headers: req.headers as Record<string, string>,
      rawBody,
      provider: {
        id: provider.id,
        adapterName: provider.adapter_name,
        config: provider.config,
      },
    });

    // Log parsed result
    await query(
      `INSERT INTO academy_core.payment_log
       (tenant_id, provider_adapter, event_type, direction, payload)
       VALUES ($1, $2, 'webhook_parsed', 'inbound', $3)`,
      [tenantId, adapterName, JSON.stringify({
        isValid: parsed.isValid, orderRef: parsed.orderRef, status: parsed.status,
      })],
    );

    if (!parsed.isValid) {
      return reply.code(200).send({ ok: false, error: 'Invalid signature' });
    }

    // 4. Find the order
    let order: any = null;
    if (parsed.orderRef) {
      order = await queryOne(
        `SELECT * FROM academy_core.orders WHERE ref = $1 AND tenant_id = $2`,
        [parsed.orderRef, tenantId],
      );
    }
    if (!order && parsed.providerRef) {
      order = await queryOne(
        `SELECT * FROM academy_core.orders WHERE provider_ref = $1 AND tenant_id = $2`,
        [parsed.providerRef, tenantId],
      );
    }

    if (!order) {
      return reply.code(200).send({ ok: false, error: 'Order not found' });
    }

    // 5. If completed, verify server-to-server then fulfill
    if (parsed.status === 'completed' && order.status !== 'paid') {
      // Never trust webhook content alone — verify server-to-server
      try {
        const verified = await adapter.verifyPayment({
          providerRef: order.provider_ref || parsed.providerRef || '',
          orderRef: order.ref,
          expectedAmount: order.amount,
          expectedCurrency: order.currency,
          provider: {
            id: provider.id,
            adapterName: provider.adapter_name,
            config: provider.config,
          },
        });

        if (verified.status === 'completed') {
          await fulfillOrder({
            orderRef: order.ref,
            method: adapterName,
            providerRef: order.provider_ref || parsed.providerRef,
          });
        }
      } catch (err: any) {
        console.error(`[Webhook] Verify failed for ${order.ref}:`, err.message);
      }
    }

    return reply.code(200).send({ ok: true });
  });
}
