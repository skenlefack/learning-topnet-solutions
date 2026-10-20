// ============================================================================
// Sponsor Routes — Third-party payment (spouse, employer, friend pays)
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, validateBody } from '@topnet-academy/shared';
import { getAdapter } from '../adapters/registry';
import { fulfillOrder } from '../services/fulfillment';

const sponsorPaySchema = z.object({
  providerId: z.string().uuid(),
  payerName: z.string().max(200),
  payerPhone: z.string().max(50),
  proofRef: z.string().max(100).optional(),
});

export async function sponsorRoutes(app: FastifyInstance) {

  // GET /sponsor/:token — get sponsor payment info (no auth)
  app.get('/:token', async (req: any, reply) => {
    const order = await queryOne<any>(
      `SELECT o.*, of.name AS offer_name
       FROM academy_core.orders o
       JOIN academy_core.offers of ON of.id = o.offer_id
       WHERE o.sponsor_token = $1`,
      [req.params.token],
    );
    if (!order) return reply.code(404).send({ success: false, error: 'Payment link not found' });

    const user = await queryOne<any>(
      `SELECT first_name FROM academy_core.users WHERE id = $1`,
      [order.user_id],
    );

    // Available providers
    const providers = await query(
      `SELECT id, adapter_name, integration_type, display_name, description, logo_url,
              supported_currencies, sort_order
       FROM academy_core.payment_providers
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY sort_order`,
      [order.tenant_id],
    );

    return reply.send({
      success: true,
      data: {
        order: {
          ref: order.ref,
          offerName: order.offer_name,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
        },
        beneficiary: user?.first_name || '',
        providers,
      },
    });
  });

  // POST /sponsor/:token/pay — pay on behalf of someone (no auth)
  app.post('/:token/pay', async (req: any, reply: FastifyReply) => {
    const data = validateBody(sponsorPaySchema, req.body);

    const order = await queryOne<any>(
      `SELECT * FROM academy_core.orders WHERE sponsor_token = $1`,
      [req.params.token],
    );
    if (!order) return reply.code(404).send({ success: false, error: 'Payment link not found' });
    if (order.status === 'paid') return reply.send({ success: true, data: { status: 'paid' } });
    if (order.status === 'canceled') {
      return reply.code(400).send({ success: false, error: 'Order has been canceled' });
    }

    const provider = await queryOne<any>(
      `SELECT * FROM academy_core.payment_providers WHERE id = $1 AND is_active = true`,
      [data.providerId],
    );
    if (!provider) return reply.code(400).send({ success: false, error: 'Payment provider not found' });

    const offer = await queryOne<any>(`SELECT name FROM academy_core.offers WHERE id = $1`, [order.offer_id]);
    const user = await queryOne<any>(
      `SELECT email FROM academy_core.users WHERE id = $1`,
      [order.user_id],
    );

    const adapter = getAdapter(provider.adapter_name);
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';

    try {
      const result = await adapter.initPayment({
        order: {
          ref: order.ref,
          amount: order.amount,
          currency: order.currency,
          offerId: order.offer_id,
          offerName: offer?.name?.fr || offer?.name?.en || order.ref,
        },
        provider: {
          id: provider.id,
          adapterName: provider.adapter_name,
          config: provider.config,
        },
        payer: {
          name: data.payerName,
          email: user?.email || '',
          phone: data.payerPhone,
        },
        callbackUrl: `${baseUrl}/sponsor/${req.params.token}?payment=return`,
        webhookUrl: `${baseUrl}/api/commerce/webhooks/${provider.adapter_name}/${order.tenant_id}`,
      });

      const newStatus = adapter.integrationType === 'manual' ? 'awaiting' : 'processing';

      await query(
        `UPDATE academy_core.orders
         SET provider_id = $1, payment_method = $2, status = $3,
             payer_name = $4, payer_phone = $5, proof_ref = $6, provider_ref = $7
         WHERE id = $8`,
        [
          provider.id, provider.adapter_name, newStatus,
          data.payerName, data.payerPhone, data.proofRef || null,
          result.providerRef || null, order.id,
        ],
      );

      if (result.status === 'completed') {
        await fulfillOrder({
          orderRef: order.ref,
          method: provider.adapter_name,
          providerRef: result.providerRef,
        });
      }

      return reply.send({
        success: true,
        data: {
          status: result.status === 'completed' ? 'paid' : newStatus,
          redirectUrl: result.redirectUrl,
          instructions: result.instructions,
        },
      });
    } catch (err: any) {
      return reply.code(502).send({
        success: false,
        error: err.message || 'Payment provider error',
      });
    }
  });
}
