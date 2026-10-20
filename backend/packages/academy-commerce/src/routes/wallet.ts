// ============================================================================
// Wallet Routes — Credits, unlimited pass, referral info
// ============================================================================
import type { FastifyInstance } from 'fastify';
import { query, queryOne, BearerSecurity } from '@topnet-academy/shared';
import { generateCode } from '../services/order-service';

export async function walletRoutes(app: FastifyInstance) {

  // GET /wallet — get current user's wallet
  app.get('/', {
    schema: { summary: 'Get my wallet', tags: ['Wallet'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const userId = req.user.sub;
    const tenantId = req.user.tenantId;

    // Get or create wallet
    let wallet = await queryOne<any>(
      `SELECT * FROM academy_core.user_wallets
       WHERE user_id = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    if (!wallet) {
      wallet = await queryOne<any>(
        `INSERT INTO academy_core.user_wallets (tenant_id, user_id, ref_code)
         VALUES ($1, $2, $3)
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [tenantId, userId, generateCode(6)],
      );
    }

    // Count referrals
    const referrals = await queryOne<any>(
      `SELECT COUNT(*)::int AS count FROM academy_core.user_wallets
       WHERE referred_by = $1 AND tenant_id = $2`,
      [userId, tenantId],
    );

    // User's vouchers (coupons they own)
    const vouchers = await query(
      `SELECT code, used_count, max_uses, expires_at, source_order_id
       FROM academy_core.coupons
       WHERE owner_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [userId, tenantId],
    );

    return reply.send({
      success: true,
      data: {
        credits: wallet.credits,
        freeTests: wallet.free_tests,
        unlimitedUntil: wallet.unlimited_until,
        refCode: wallet.ref_code,
        referralCount: referrals?.count || 0,
        referralRewarded: wallet.referral_rewarded,
        vouchers,
      },
    });
  });

  // POST /wallet/referral — set referral code (one-time, during onboarding)
  app.post('/referral', {
    schema: { summary: 'Set referral code', tags: ['Wallet'], security: BearerSecurity },
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const { refCode } = req.body as { refCode: string };
    if (!refCode || refCode.length < 4) {
      return reply.code(400).send({ success: false, error: 'Invalid referral code' });
    }

    const userId = req.user.sub;
    const tenantId = req.user.tenantId;

    // Find referrer by ref_code
    const referrer = await queryOne<any>(
      `SELECT user_id FROM academy_core.user_wallets
       WHERE ref_code = $1 AND tenant_id = $2 AND user_id <> $3`,
      [refCode.toUpperCase(), tenantId, userId],
    );
    if (!referrer) {
      return reply.code(400).send({ success: false, error: 'Referral code not found' });
    }

    // Set referred_by (only if not already set)
    const result = await queryOne<any>(
      `UPDATE academy_core.user_wallets
       SET referred_by = $1
       WHERE user_id = $2 AND tenant_id = $3 AND referred_by IS NULL
       RETURNING id`,
      [referrer.user_id, userId, tenantId],
    );

    if (!result) {
      return reply.code(400).send({ success: false, error: 'Referral already set' });
    }

    return reply.send({ success: true, data: { referralSet: true } });
  });
}
