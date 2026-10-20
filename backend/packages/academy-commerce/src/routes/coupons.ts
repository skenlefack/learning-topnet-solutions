// ============================================================================
// Coupon Routes — Admin CRUD + user redemption
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, queryOne, validateBody, BearerSecurity } from '@topnet-academy/shared';
import { generateCode } from '../services/order-service';

const createCouponSchema = z.object({
  code: z.string().max(30).optional(),
  kind: z.enum(['percent', 'credit', 'fixed_amount']),
  value: z.number().int().min(1),
  maxUses: z.number().int().min(1).default(1),
  expiresAt: z.string().optional(),
  org: z.string().max(200).default(''),
  count: z.number().int().min(1).max(200).default(1),
});

export async function couponRoutes(app: FastifyInstance) {

  // POST /coupons/redeem — redeem a credit coupon
  app.post('/redeem', {
    schema: { summary: 'Redeem coupon code', tags: ['Coupons'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply: FastifyReply) => {
    const { code } = req.body as { code: string };
    if (!code) return reply.code(400).send({ success: false, error: 'Code is required' });

    const userId = req.user.sub;
    const tenantId = req.user.tenantId;

    const coupon = await queryOne<any>(
      `SELECT * FROM academy_core.coupons
       WHERE code = $1 AND tenant_id = $2 AND kind = 'credit' AND is_active = true`,
      [code.toUpperCase(), tenantId],
    );
    if (!coupon) return reply.code(400).send({ success: false, error: 'Invalid code' });
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return reply.code(400).send({ success: false, error: 'Code has expired' });
    }
    if (coupon.used_count >= coupon.max_uses) {
      return reply.code(400).send({ success: false, error: 'Code is no longer available' });
    }

    const existing = await queryOne<any>(
      `SELECT id FROM academy_core.coupon_uses WHERE coupon_id = $1 AND user_id = $2`,
      [coupon.id, userId],
    );
    if (existing) return reply.code(400).send({ success: false, error: 'You have already used this code' });

    // Apply credit
    await query(
      `UPDATE academy_core.coupons SET used_count = used_count + 1 WHERE id = $1`,
      [coupon.id],
    );
    await query(
      `INSERT INTO academy_core.user_wallets (tenant_id, user_id, credits, ref_code)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, user_id)
       DO UPDATE SET credits = user_wallets.credits + $3`,
      [tenantId, userId, coupon.value, generateCode(6)],
    );

    const wallet = await queryOne<any>(
      `SELECT credits FROM academy_core.user_wallets WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    return reply.send({
      success: true,
      data: { credits: coupon.value, org: coupon.org, totalCredits: wallet?.credits || 0 },
    });
  });

  // =========== Admin routes ===========

  // GET /coupons/admin — list coupons
  app.get('/admin', {
    schema: { summary: 'Admin: list coupons', tags: ['Coupons'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const { clause, params } = req.tenantFilter();
    const rows = await query(
      `SELECT * FROM academy_core.coupons WHERE ${clause} ORDER BY created_at DESC LIMIT 1000`,
      params,
    );
    return reply.send({ success: true, data: rows });
  });

  // POST /coupons/admin — create coupons (single or batch)
  app.post('/admin', {
    schema: { summary: 'Admin: create coupons', tags: ['Coupons'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(createCouponSchema, req.body);
    const tenantId = req.user.tenantId;

    const prefix = data.kind === 'credit' ? 'BON' : 'PROMO';
    const codes: string[] = [];

    for (let i = 0; i < data.count; i++) {
      const code = (data.count === 1 && data.code)
        ? data.code.toUpperCase().replace(/[^A-Z0-9-]/g, '')
        : `${prefix}-${generateCode(4)}-${generateCode(4)}`;

      const existing = await queryOne(
        `SELECT id FROM academy_core.coupons WHERE code = $1 AND tenant_id = $2`,
        [code, tenantId],
      );
      if (existing) {
        return reply.code(409).send({ success: false, error: `Code ${code} already exists` });
      }

      await query(
        `INSERT INTO academy_core.coupons
         (tenant_id, code, kind, value, max_uses, expires_at, org)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenantId, code, data.kind, data.value, data.maxUses,
         data.expiresAt || null, data.org],
      );
      codes.push(code);
    }

    return reply.code(201).send({ success: true, data: { codes } });
  });
}
