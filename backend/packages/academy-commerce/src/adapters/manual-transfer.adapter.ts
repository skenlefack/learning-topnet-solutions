// ============================================================================
// Manual Transfer Adapter — MoMo, Orange Money, Bank Wire
// User pays externally, submits proof, admin validates
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

export class ManualTransferAdapter implements PaymentAdapter {
  readonly adapterName = 'manual_transfer';
  readonly integrationType = 'manual' as const;

  async initPayment(params: InitPaymentParams): Promise<PaymentInitResult> {
    // For manual transfers, no API call is needed.
    // The provider's description JSONB contains instructions for the user.
    const config = params.provider.config;
    const instructions = (config.instructions as string) || '';

    return {
      providerRef: `manual-${params.order.ref}`,
      instructions,
      status: 'pending',
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerifyResult> {
    // Manual transfers are verified by admin — always return pending
    return {
      status: 'pending',
      providerRef: params.providerRef,
    };
  }

  async parseWebhook(_params: ParseWebhookParams): Promise<WebhookParseResult> {
    // Manual transfers don't receive webhooks
    return { isValid: false, status: 'pending' };
  }
}
