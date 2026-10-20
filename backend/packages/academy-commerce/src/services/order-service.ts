// ============================================================================
// Order Service — order creation, coupon logic, reference generation
// ============================================================================
import { randomBytes } from 'crypto';
import { query, queryOne, transaction } from '@topnet-academy/shared';

/** Generate a unique order reference: TN + YYMMDD + random 5 chars */
export function generateOrderRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const rand = randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
  return `TN${yy}${mm}${dd}-${rand}`;
}

/** Generate a random alphanumeric code */
export function generateCode(length = 4): string {
  return randomBytes(length)
    .toString('hex')
    .toUpperCase()
    .slice(0, length);
}

/** Generate a sponsor token */
export function generateSponsorToken(): string {
  return randomBytes(16).toString('hex');
}

/** Apply coupon discount to a price */
export async function applyCoupon(
  tenantId: string,
  code: string,
  price: number,
  userId: string,
): Promise<{ couponId: string; code: string; discount: number }> {
  const coupon = await queryOne<any>(
    `SELECT * FROM academy_core.coupons
     WHERE tenant_id = $1 AND code = $2 AND is_active = true`,
    [tenantId, code.toUpperCase()],
  );

  if (!coupon) throw Object.assign(new Error('Invalid coupon code'), { statusCode: 400 });

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    throw Object.assign(new Error('Coupon has expired'), { statusCode: 400 });
  }

  if (coupon.used_count >= coupon.max_uses) {
    throw Object.assign(new Error('Coupon is no longer available'), { statusCode: 400 });
  }

  // Check if user already used this coupon
  const existing = await queryOne<any>(
    `SELECT id FROM academy_core.coupon_uses
     WHERE coupon_id = $1 AND user_id = $2`,
    [coupon.id, userId],
  );
  if (existing) {
    throw Object.assign(new Error('You have already used this coupon'), { statusCode: 400 });
  }

  let discount: number;
  switch (coupon.kind) {
    case 'percent':
      discount = Math.round(price * Math.min(100, coupon.value) / 100);
      break;
    case 'fixed_amount':
      discount = Math.min(coupon.value, price);
      break;
    case 'credit':
      // Credit coupons don't reduce price, they add credits
      discount = 0;
      break;
    default:
      discount = 0;
  }

  return { couponId: coupon.id, code: coupon.code, discount };
}

/** Calculate tax-inclusive price from HT price */
export function priceWithTax(priceHT: number, taxRate: number): number {
  return Math.round(priceHT * (1 + taxRate));
}
