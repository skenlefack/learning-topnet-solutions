// ============================================================================
// Payment Routes — Initiate payment, verify status
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, validateBody, publishEvent, TOPICS, BearerSecurity,
} from '@topnet-academy/shared';
import { getAdapter } from '../adapters/registry';
import { fulfillOrder } from '../services/fulfillment';
import { randomUUID } from 'crypto';

const initiatePaymentSchema = z.object({
  providerId: z.string().uuid(),
  payerName: z.string().max(200).optional(),
  payerPhone: z.string().max(50).optional(),
  proofRef: z.string().max(100).optional(),
});

export async function paymentRoutes(app: FastifyInstance) {

  // POST /payments/:orderRef/pay — initiate payment for an order
  app.post('/:orderRef/pay', {
    schema: { summary: 'Initiate payment', tags: ['Payments'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(initiatePaymentSchema, req.body);
    const userId = req.user.sub;

    // Load order
    const order = await queryOne<any>(
      `SELECT * FROM academy_core.orders WHERE ref = $1 AND user_id = $2`,
      [req.params.orderRef, userId],
    );
    if (!order) return reply.code(404).send({ success: false, error: 'Order not found' });
    if (order.status === 'paid') return reply.send({ success: true, data: { status: 'paid' } });
    if (order.status === 'canceled') {
      return reply.code(400).send({ success: false, error: 'Order has been canceled' });
    }

    // Load provider
    const provider = await queryOne<any>(
      `SELECT * FROM academy_core.payment_providers WHERE id = $1 AND is_active = true`,
      [data.providerId],
    );
    if (!provider) return reply.code(400).send({ success: false, error: 'Payment provider not found' });

    // Load offer name
    const offer = await queryOne<any>(`SELECT name FROM academy_core.offers WHERE id = $1`, [order.offer_id]);

    // Get adapter
    const adapter = getAdapter(provider.adapter_name);

    // For manual transfers, require proof
    if (adapter.integrationType === 'manual') {
      if (!data.proofRef || data.proofRef.length < 4) {
        return reply.code(400).send({
          success: false,
          error: 'Please provide the transaction reference/proof',
        });
      }
      // Check proof uniqueness
      const dup = await queryOne<any>(
        `SELECT ref FROM academy_core.orders
         WHERE proof_ref = $1 AND provider_id = $2 AND ref <> $3 AND status IN ('awaiting','paid')`,
        [data.proofRef, provider.id, order.ref],
      );
      if (dup) {
        return reply.code(400).send({
          success: false,
          error: 'This transaction reference has already been used for another order',
        });
      }
    }

    // Build callback/webhook URLs
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const callbackUrl = `${baseUrl}/orders/${order.ref}?payment=return`;
    const webhookUrl = `${baseUrl}/api/commerce/webhooks/${provider.adapter_name}/${order.tenant_id}`;

    const user = await queryOne<any>(
      `SELECT email, first_name, last_name FROM academy_core.users WHERE id = $1`,
      [userId],
    );

    // Create payment record
    const idempotencyKey = `${order.ref}-${provider.id}-${Date.now()}`;
    const payment = await queryOne<any>(`
      INSERT INTO academy_core.payments
        (tenant_id, order_id, provider_id, amount, currency, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [order.tenant_id, order.id, provider.id, order.amount, order.currency, idempotencyKey],
    );

    // Log the attempt
    await query(
      `INSERT INTO academy_core.payment_log
       (tenant_id, order_id, payment_id, provider_adapter, event_type, direction, payload)
       VALUES ($1, $2, $3, $4, 'payment_init', 'outbound', $5)`,
      [order.tenant_id, order.id, payment.id, provider.adapter_name,
       JSON.stringify({ providerId: provider.id, method: provider.adapter_name })],
    );

    try {
      // Call adapter
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
          name: data.payerName || `${user?.first_name || ''} ${user?.last_name || ''}`.trim(),
          email: user?.email || '',
          phone: data.payerPhone || '',
        },
        callbackUrl,
        webhookUrl,
      });

      // Update order with provider info
      const newStatus = result.status === 'completed' ? 'processing'
        : adapter.integrationType === 'manual' ? 'awaiting'
        : 'processing';

      await query(
        `UPDATE academy_core.orders
         SET provider_id = $1, payment_method = $2, status = $3,
             payer_name = $4, payer_phone = $5, proof_ref = $6, provider_ref = $7
         WHERE id = $8`,
        [
          provider.id, provider.adapter_name, newStatus,
          data.payerName || null, data.payerPhone || null,
          data.proofRef || null, result.providerRef || null,
          order.id,
        ],
      );

      // Update payment record
      await query(
        `UPDATE academy_core.payments
         SET status = $1, provider_ref = $2, redirect_url = $3, provider_response = $4
         WHERE id = $5`,
        [result.status, result.providerRef, result.redirectUrl || null,
         JSON.stringify(result.rawResponse || {}), payment.id],
      );

      // If wallet payment (instant), fulfill immediately
      if (result.status === 'completed') {
        await fulfillOrder({
          orderRef: order.ref,
          method: provider.adapter_name,
          providerRef: result.providerRef,
        });
      }

      try {
        await publishEvent(
          TOPICS.PAYMENT_INITIATED,
          { orderRef: order.ref, provider: provider.adapter_name, status: result.status },
          order.tenant_id, userId,
        );
      } catch { /* non-blocking */ }

      return reply.send({
        success: true,
        data: {
          status: result.status === 'completed' ? 'paid' : newStatus,
          redirectUrl: result.redirectUrl,
          instructions: result.instructions,
          providerRef: result.providerRef,
        },
      });
    } catch (err: any) {
      // Log the error
      await query(
        `INSERT INTO academy_core.payment_log
         (tenant_id, order_id, payment_id, provider_adapter, event_type, direction, payload)
         VALUES ($1, $2, $3, $4, 'payment_error', 'outbound', $5)`,
        [order.tenant_id, order.id, payment.id, provider.adapter_name,
         JSON.stringify({ error: err.message })],
      );

      return reply.code(502).send({
        success: false,
        error: err.message || 'Payment provider error. Please try another payment method.',
      });
    }
  });

  // GET /payments/:orderRef/verify — check payment status
  app.get('/:orderRef/verify', {
    schema: { summary: 'Verify payment status', tags: ['Payments'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const order = await queryOne<any>(
      `SELECT * FROM academy_core.orders WHERE ref = $1 AND user_id = $2`,
      [req.params.orderRef, req.user.sub],
    );
    if (!order) return reply.code(404).send({ success: false, error: 'Order not found' });
    if (order.status === 'paid') return reply.send({ success: true, data: { status: 'paid' } });
    if (!order.provider_id || !order.provider_ref) {
      return reply.send({ success: true, data: { status: order.status } });
    }

    const provider = await queryOne<any>(
      `SELECT * FROM academy_core.payment_providers WHERE id = $1`,
      [order.provider_id],
    );
    if (!provider) return reply.send({ success: true, data: { status: order.status } });

    const adapter = getAdapter(provider.adapter_name);

    try {
      const result = await adapter.verifyPayment({
        providerRef: order.provider_ref,
        orderRef: order.ref,
        expectedAmount: order.amount,
        expectedCurrency: order.currency,
        provider: {
          id: provider.id,
          adapterName: provider.adapter_name,
          config: provider.config,
        },
      });

      if (result.status === 'completed') {
        await fulfillOrder({
          orderRef: order.ref,
          method: provider.adapter_name,
          providerRef: order.provider_ref,
        });
        return reply.send({ success: true, data: { status: 'paid' } });
      }

      return reply.send({ success: true, data: { status: result.status } });
    } catch (err: any) {
      return reply.send({ success: true, data: { status: order.status } });
    }
  });
}
