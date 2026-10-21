// ============================================================================
// Order Routes — Create, list, cancel, admin validate
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, validateBody, publishEvent, TOPICS, BearerSecurity,
} from '@topnet-academy/shared';
import {
  generateOrderRef, generateSponsorToken, applyCoupon, priceWithTax,
} from '../services/order-service';
import { splitAmount } from '../services/installments';
import { fulfillOrder } from '../services/fulfillment';

const createOrderSchema = z.object({
  offerCode: z.string().min(1).max(30),
  coupon: z.string().max(30).optional(),
  useInstallments: z.boolean().default(false),
  targetCourseId: z.string().uuid().optional(),
  targetAssessmentId: z.string().uuid().optional(),
});

export async function orderRoutes(app: FastifyInstance) {

  // POST /orders — create order
  app.post('/', {
    schema: { summary: 'Create order', tags: ['Orders'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(createOrderSchema, req.body);
    const userId = req.user.sub;
    const tenantId = req.user.tenantId;

    // Load offer
    const offer = await queryOne<any>(
      `SELECT * FROM academy_core.offers WHERE tenant_id = $1 AND code = $2 AND is_active = true`,
      [tenantId, data.offerCode],
    );
    if (!offer) return reply.code(404).send({ success: false, error: 'Offer not found' });

    // Calculate price
    let price = offer.price;
    if (!offer.price_includes_tax && offer.tax_rate > 0) {
      price = priceWithTax(offer.price, parseFloat(offer.tax_rate));
    }

    // Apply coupon
    let discount = 0;
    let couponCode: string | null = null;
    if (data.coupon) {
      const result = await applyCoupon(tenantId, data.coupon, price, userId);
      discount = result.discount;
      couponCode = result.code;
    }

    const total = Math.max(0, price - discount);
    const n = data.useInstallments && offer.max_installments > 1 ? offer.max_installments : 1;
    const amounts = splitAmount(total, n);

    const ref = generateOrderRef();
    const sponsorToken = generateSponsorToken();

    const order = await queryOne<any>(`
      INSERT INTO academy_core.orders
        (tenant_id, ref, user_id, offer_id, target_course_id, target_assessment_id,
         amount, total_amount, discount, currency, coupon_code,
         installment_no, installments_total, sponsor_token, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'pending')
      RETURNING *`,
      [
        tenantId, ref, userId, offer.id,
        data.targetCourseId ?? null, data.targetAssessmentId ?? null,
        amounts[0], total, discount, offer.currency, couponCode,
        1, n, sponsorToken,
      ],
    );

    // Record coupon usage
    if (couponCode) {
      const coupon = await queryOne<any>(
        `SELECT id FROM academy_core.coupons WHERE tenant_id = $1 AND code = $2`,
        [tenantId, couponCode],
      );
      if (coupon) {
        await query(
          `INSERT INTO academy_core.coupon_uses (coupon_id, user_id, order_id)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [coupon.id, userId, order.id],
        );
        await query(
          `UPDATE academy_core.coupons SET used_count = used_count + 1 WHERE id = $1`,
          [coupon.id],
        );
      }
    }

    // If total is 0 (fully discounted), fulfill immediately
    if (total === 0) {
      await fulfillOrder({ orderRef: ref, method: 'coupon' });
      const fulfilled = await queryOne(`SELECT * FROM academy_core.orders WHERE ref = $1`, [ref]);
      return reply.code(201).send({ success: true, data: fulfilled });
    }

    try {
      await publishEvent(
        TOPICS.ORDER_CREATED,
        { orderRef: ref, offerCode: data.offerCode, amount: amounts[0], total },
        tenantId, userId,
      );
    } catch { /* non-blocking */ }

    return reply.code(201).send({ success: true, data: order });
  });

  // GET /orders — list user's orders
  app.get('/', {
    schema: { summary: 'List my orders', tags: ['Orders'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const rows = await query(
      `SELECT o.*, of.name AS offer_name, of.kind AS offer_kind
       FROM academy_core.orders o
       JOIN academy_core.offers of ON of.id = o.offer_id
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC LIMIT 200`,
      [req.user.sub],
    );
    return reply.send({ success: true, data: rows });
  });

  // GET /orders/:ref — get order detail
  app.get('/:ref', {
    schema: { summary: 'Get order detail', tags: ['Orders'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const order = await queryOne<any>(
      `SELECT o.*, of.name AS offer_name, of.kind AS offer_kind, of.features AS offer_features
       FROM academy_core.orders o
       JOIN academy_core.offers of ON of.id = o.offer_id
       WHERE o.ref = $1 AND o.user_id = $2`,
      [req.params.ref, req.user.sub],
    );
    if (!order) return reply.code(404).send({ success: false, error: 'Order not found' });

    // Load available payment providers for this tenant
    const providers = await query(
      `SELECT id, adapter_name, integration_type, display_name, description, logo_url,
              supported_currencies, sort_order
       FROM academy_core.payment_providers
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY sort_order`,
      [order.tenant_id],
    );

    return reply.send({ success: true, data: { order, providers } });
  });

  // POST /orders/:ref/cancel — cancel pending order
  app.post('/:ref/cancel', {
    schema: { summary: 'Cancel order', tags: ['Orders'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const result = await queryOne<any>(
      `UPDATE academy_core.orders
       SET status = 'canceled'
       WHERE ref = $1 AND user_id = $2 AND status = 'pending' AND installment_no = 1
       RETURNING id`,
      [req.params.ref, req.user.sub],
    );
    if (!result) return reply.code(400).send({ success: false, error: 'Cannot cancel this order' });
    return reply.send({ success: true, data: { canceled: true } });
  });

  // =========== Admin routes ===========

  // GET /orders/admin — list all orders
  app.get('/admin', {
    schema: { summary: 'Admin: list orders', tags: ['Orders'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const { clause, params } = req.tenantFilter();
    const status = (req.query as any).status;
    const search = (req.query as any).q || '';

    let sql = `
      SELECT o.*, of.name AS offer_name, of.kind AS offer_kind,
             u.first_name, u.last_name, u.email, u.phone
      FROM academy_core.orders o
      JOIN academy_core.offers of ON of.id = o.offer_id
      JOIN academy_core.users u ON u.id = o.user_id
      WHERE ${clause === '1=1' ? '1=1' : 'o.' + clause}`;

    if (status) {
      params.push(status);
      sql += ` AND o.status = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      const p = params.length;
      sql += ` AND (o.ref ILIKE $${p} OR u.first_name ILIKE $${p} OR u.last_name ILIKE $${p} OR u.email ILIKE $${p})`;
    }

    sql += ` ORDER BY o.created_at DESC LIMIT 500`;
    const rows = await query(sql, params);
    return reply.send({ success: true, data: rows });
  });

  // POST /orders/admin/:ref/validate — approve/reject manual payment
  app.post('/admin/:ref/validate', {
    schema: { summary: 'Admin: validate order payment', tags: ['Orders'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply: FastifyReply) => {
    const { approve, note } = req.body as { approve: boolean; note?: string };
    const orderRef = req.params.ref;

    const order = await queryOne<any>(
      `SELECT * FROM academy_core.orders WHERE ref = $1`,
      [orderRef],
    );
    if (!order) return reply.code(404).send({ success: false, error: 'Order not found' });

    if (approve) {
      await fulfillOrder({
        orderRef,
        method: order.payment_method || 'admin',
        adminId: req.user.sub,
      });
      if (note) {
        await query(
          `UPDATE academy_core.orders SET admin_note = $1 WHERE ref = $2`,
          [note, orderRef],
        );
      }
    } else {
      await query(
        `UPDATE academy_core.orders
         SET status = 'rejected', admin_note = $1, validated_by = $2
         WHERE ref = $3 AND status <> 'paid'`,
        [note || 'Payment not received', req.user.sub, orderRef],
      );
    }

    const updated = await queryOne(`SELECT * FROM academy_core.orders WHERE ref = $1`, [orderRef]);
    return reply.send({ success: true, data: updated });
  });
}
