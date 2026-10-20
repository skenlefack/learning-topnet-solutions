// ============================================================================
// Payment Adapter Interfaces — Generic merchant integration layer
// ============================================================================

export interface InitPaymentParams {
  order: {
    ref: string;
    amount: number;
    currency: string;
    offerId: string;
    offerName: string;
  };
  provider: {
    id: string;
    adapterName: string;
    config: Record<string, unknown>;
  };
  payer: {
    name: string;
    email: string;
    phone: string;
  };
  callbackUrl: string;
  webhookUrl: string;
}

export interface PaymentInitResult {
  providerRef: string;
  redirectUrl?: string;
  instructions?: string;
  status: 'initiated' | 'pending' | 'completed';
  rawResponse?: unknown;
}

export interface VerifyPaymentParams {
  providerRef: string;
  orderRef: string;
  expectedAmount: number;
  expectedCurrency: string;
  provider: {
    id: string;
    adapterName: string;
    config: Record<string, unknown>;
  };
}

export interface PaymentVerifyResult {
  status: 'completed' | 'pending' | 'failed' | 'expired';
  amount?: number;
  currency?: string;
  providerRef: string;
  rawResponse?: unknown;
}

export interface ParseWebhookParams {
  headers: Record<string, string>;
  rawBody: string;
  provider: {
    id: string;
    adapterName: string;
    config: Record<string, unknown>;
  };
}

export interface WebhookParseResult {
  isValid: boolean;
  orderRef?: string;
  providerRef?: string;
  status: 'completed' | 'failed' | 'pending';
  amount?: number;
  rawEvent?: unknown;
}

export interface PaymentAdapter {
  readonly adapterName: string;
  readonly integrationType: 'api' | 'redirect' | 'manual' | 'wallet';

  initPayment(params: InitPaymentParams): Promise<PaymentInitResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerifyResult>;
  parseWebhook(params: ParseWebhookParams): Promise<WebhookParseResult>;
}
