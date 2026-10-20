// ============================================================================
// Fulfillment Service — grant access/credits after successful payment
// Idempotent: uses SELECT ... FOR UPDATE + status check
// ============================================================================
import { transaction, publishEvent, TOPICS } from '@topnet-academy/shared';
import { splitAmount, installmentDueDates } from './installments';
import { generateOrderRef, generateCode, generateSponsorToken } from './order-service';

interface FulfillParams {
  orderRef: string;
  method: string;
  adminId?: string;
  providerRef?: string;
}

/**
 * Fulfills an order after payment confirmation.
 * - Idempotent: if already paid, returns true without re-processing
 * - Transactional: all-or-nothing within a single DB transaction
 * - Publishes ORDER_PAID and ORDER_FULFILLED Kafka events
 */
export async function fulfillOrder(params: FulfillParams): Promise<boolean> {
  return transaction(async (client) => {
    // 1. Lock the order row
    const { rows: [order] } = await client.query(
      `SELECT * FROM academy_core.orders WHERE ref = $1 FOR UPDATE`,
      [params.orderRef],
    );
    if (!order) return false;

    // 2. Idempotent: already paid
    if (order.status === 'paid') return true;

    // 3. Update order status
    await client.query(
      `UPDATE academy_core.orders
       SET status = 'paid', payment_method = COALESCE($1, payment_method),
           paid_at = NOW(), validated_by = $2,
           provider_ref = COALESCE($3, provider_ref)
       WHERE id = $4`,
      [params.method, params.adminId ?? null, params.providerRef ?? null, order.id],
    );

    // 4. Load the associated offer
    const { rows: [offer] } = await client.query(
      `SELECT * FROM academy_core.offers WHERE id = $1`,
      [order.offer_id],
    );
    if (!offer) return true;

    const userId = order.user_id;
    const tenantId = order.tenant_id;

    // 5. First installment: apply all fulfillment
    if (order.installment_no === 1) {
      // --- Credits ---
      if (offer.credits > 0) {
        await client.query(
          `INSERT INTO academy_core.user_wallets (tenant_id, user_id, credits, ref_code)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, user_id)
           DO UPDATE SET credits = user_wallets.credits + $3`,
          [tenantId, userId, offer.credits, generateCode(6)],
        );
      }

      // --- Unlimited pass ---
      if (offer.days > 0) {
        await client.query(
          `INSERT INTO academy_core.user_wallets (tenant_id, user_id, unlimited_until, ref_code)
           VALUES ($1, $2, NOW() + $3 * INTERVAL '1 day', $4)
           ON CONFLICT (tenant_id, user_id)
           DO UPDATE SET unlimited_until = GREATEST(
             COALESCE(user_wallets.unlimited_until, NOW()), NOW()
           ) + $3 * INTERVAL '1 day'`,
          [tenantId, userId, offer.days, generateCode(6)],
        );
      }

      // --- Course access: publish events for academy-learning to create enrollments ---
      if (offer.course_ids && offer.course_ids.length > 0) {
        for (const courseId of offer.course_ids) {
          try {
            await publishEvent(
              TOPICS.ORDER_FULFILLED,
              { type: 'course_access', userId, courseId, orderRef: order.ref },
              tenantId,
              userId,
            );
          } catch { /* Kafka non-blocking */ }
        }
      }

      // --- Assessment unlock ---
      if (offer.assessment_ids && offer.assessment_ids.length > 0) {
        for (const assessmentId of offer.assessment_ids) {
          try {
            await publishEvent(
              TOPICS.ORDER_FULFILLED,
              { type: 'assessment_unlock', userId, assessmentId, orderRef: order.ref },
              tenantId,
              userId,
            );
          } catch { /* Kafka non-blocking */ }
        }
      }

      // --- Test unlock (specific test) ---
      if (offer.kind === 'test_unlock' && order.target_assessment_id) {
        try {
          await publishEvent(
            TOPICS.ORDER_FULFILLED,
            { type: 'test_unlock', userId, assessmentId: order.target_assessment_id, orderRef: order.ref },
            tenantId,
            userId,
          );
        } catch { /* Kafka non-blocking */ }
      }

      // --- Vouchers ---
      if (offer.voucher_count > 0) {
        const { rows: [user] } = await client.query(
          `SELECT first_name, last_name FROM academy_core.users WHERE id = $1`,
          [userId],
        );
        for (let i = 0; i < offer.voucher_count; i++) {
          const code = `BON-${generateCode(4)}-${generateCode(4)}`;
          await client.query(
            `INSERT INTO academy_core.coupons
             (tenant_id, code, kind, value, max_uses, org, source_order_id, owner_id, expires_at)
             VALUES ($1, $2, 'credit', 1, 1, $3, $4, $5, NOW() + INTERVAL '365 days')`,
            [tenantId, code, user ? `${user.first_name} ${user.last_name}` : '', order.id, userId],
          );
        }
      }

      // --- Services (coaching, mentoring, training) ---
      if (offer.services && offer.services.length > 0) {
        for (const serviceKind of offer.services) {
          await client.query(
            `INSERT INTO academy_core.purchased_services
             (tenant_id, user_id, order_id, kind, track, pace)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [tenantId, userId, order.id, serviceKind, order.target_course_id ?? null, null],
          );
        }
      }

      // --- Create subsequent installments ---
      if (order.installments_total > 1) {
        const amounts = splitAmount(order.total_amount, order.installments_total);
        const dueDates = installmentDueDates(order.installments_total);
        for (let i = 1; i < order.installments_total; i++) {
          await client.query(
            `INSERT INTO academy_core.orders
             (tenant_id, ref, user_id, offer_id, target_course_id, target_assessment_id,
              amount, total_amount, discount, currency, installment_no, installments_total,
              parent_order_id, due_at, sponsor_token, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $13, $14, 'pending')`,
            [
              tenantId, generateOrderRef(), userId, order.offer_id,
              order.target_course_id, order.target_assessment_id,
              amounts[i], order.total_amount, order.currency,
              i + 1, order.installments_total, order.id,
              dueDates[i]?.toISOString() ?? null, generateSponsorToken(),
            ],
          );
        }
      }
    }

    // 6. Referral bonus: first paid order by referred user
    const { rows: [wallet] } = await client.query(
      `SELECT referred_by, referral_rewarded FROM academy_core.user_wallets
       WHERE user_id = $1 AND tenant_id = $2 FOR UPDATE`,
      [userId, tenantId],
    );
    if (wallet?.referred_by && !wallet.referral_rewarded && order.amount > 0) {
      // Reward referrer with 1 credit
      await client.query(
        `UPDATE academy_core.user_wallets
         SET credits = credits + 1
         WHERE user_id = $1 AND tenant_id = $2`,
        [wallet.referred_by, tenantId],
      );
      await client.query(
        `UPDATE academy_core.user_wallets
         SET referral_rewarded = true
         WHERE user_id = $1 AND tenant_id = $2`,
        [userId, tenantId],
      );
    }

    // 7. Publish events
    try {
      await publishEvent(
        TOPICS.ORDER_PAID,
        { orderRef: order.ref, offerId: order.offer_id, amount: order.amount, method: params.method },
        tenantId,
        userId,
      );
    } catch { /* Kafka non-blocking */ }

    return true;
  });
}
