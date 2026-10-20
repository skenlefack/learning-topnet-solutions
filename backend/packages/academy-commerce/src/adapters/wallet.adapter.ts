// ============================================================================
// Wallet Adapter — Internal credits payment (instant)
// ============================================================================
import type {
  PaymentAdapter,
  InitPaymentParams,
  PaymentInitResult,
  VerifyPaymentParams,
  PaymentVerifyResult,
  ParseWebhookParams,
  WebhookParseResult,
} from './types';
import { queryOne, transaction } from '@topnet-academy/shared';

export class WalletAdapter implements PaymentAdapter {
  readonly adapterName = 'wallet';
  readonly integrationType = 'wallet' as const;

  async initPayment(params: InitPaymentParams): Promise<PaymentInitResult> {
    // Deduct credits from user's wallet in a transaction
    const result = await transaction(async (client) => {
      // Get the order to find user_id and tenant_id
      const { rows: [order] } = await client.query(
        'SELECT user_id, tenant_id FROM academy_core.orders WHERE ref = $1',
        [params.order.ref],
      );
      if (!order) throw new Error('Order not found');

      // Check wallet has enough credits
      const { rows: [wallet] } = await client.query(
        `SELECT id, credits FROM academy_core.user_wallets
         WHERE user_id = $1 AND tenant_id = $2 FOR UPDATE`,
        [order.user_id, order.tenant_id],
      );

      if (!wallet || wallet.credits < params.order.amount) {
        throw new Error('Insufficient credits');
      }

      // Deduct credits
      await client.query(
        `UPDATE academy_core.user_wallets
         SET credits = credits - $1 WHERE id = $2`,
        [params.order.amount, wallet.id],
      );

      return { walletId: wallet.id };
    });

    return {
      providerRef: `wallet-${params.order.ref}`,
      status: 'completed',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerifyResult> {
    // Wallet payments are instant — if initiated, they're completed
    return {
      status: 'completed',
      providerRef: params.providerRef,
      amount: params.expectedAmount,
      currency: params.expectedCurrency,
    };
  }

  async parseWebhook(_params: ParseWebhookParams): Promise<WebhookParseResult> {
    // Wallet adapter doesn't use webhooks
    return { isValid: false, status: 'pending' };
  }
}
