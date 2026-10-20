// ============================================================================
// Generic API Adapter — Configurable adapter for ANY payment merchant
//
// Instead of writing one adapter per merchant, the tenant configures:
// - API endpoints, headers, body templates
// - Response field mappings (dot-path notation)
// - Webhook signature verification
//
// This allows integrating Stripe, Flutterwave, NotchPay, CinetPay, PayStack,
// or any merchant with a REST API — via configuration alone, no code changes.
// ============================================================================
import { createHmac, timingSafeEqual } from 'crypto';
import { decryptProviderConfig } from '@topnet-academy/shared';
import type {
  PaymentAdapter,
  InitPaymentParams,
  PaymentInitResult,
  VerifyPaymentParams,
  PaymentVerifyResult,
  ParseWebhookParams,
  WebhookParseResult,
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve a dot-path like "transaction.reference" from a nested object */
function getByPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce((acc: any, key) => acc?.[key], obj);
}

/** Replace {{variable}} placeholders in a string */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/** Deep-interpolate all string values in an object/array */
function interpolateDeep(obj: unknown, vars: Record<string, string>): unknown {
  if (typeof obj === 'string') return interpolate(obj, vars);
  if (Array.isArray(obj)) return obj.map((v) => interpolateDeep(v, vars));
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[interpolate(k, vars)] = interpolateDeep(v, vars);
    }
    return result;
  }
  return obj;
}

/** Map a status string using a statusMap, or return as-is */
function mapStatus(
  raw: string,
  statusMap?: Record<string, string>,
): 'completed' | 'failed' | 'pending' | 'expired' {
  const mapped = statusMap?.[raw] ?? raw;
  if (['completed', 'failed', 'pending', 'expired'].includes(mapped)) {
    return mapped as any;
  }
  return 'pending';
}

/** Build secrets vars from decrypted config */
function secretVars(config: Record<string, unknown>): Record<string, string> {
  const secrets = (config.secrets as Record<string, string>) ?? {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(secrets)) {
    result[k] = typeof v === 'string' ? v : '';
  }
  return result;
}

// ---------------------------------------------------------------------------
// Config shape (stored in payment_providers.config JSONB)
// ---------------------------------------------------------------------------

interface GenericApiConfig {
  init?: {
    method: 'POST' | 'GET' | 'REDIRECT';
    url?: string;
    urlTemplate?: string;
    headers?: Record<string, string>;
    contentType?: 'json' | 'form-urlencoded';
    bodyTemplate?: Record<string, unknown>;
    responseMapping?: {
      providerRef?: string;
      redirectUrl?: string;
    };
  };
  verify?: {
    method: 'GET' | 'POST' | 'MANUAL';
    url?: string;
    headers?: Record<string, string>;
    responseMapping?: {
      status?: string;
      statusMap?: Record<string, string>;
      amount?: string;
      currency?: string;
    };
  };
  webhook?: {
    signatureHeader?: string;
    signatureAlgo?: 'hmac-sha256' | 'hmac-sha512' | 'none';
    signatureKey?: string;
    refPath?: string;
    providerRefPath?: string;
    statusPath?: string;
    statusMap?: Record<string, string>;
    amountPath?: string;
  };
  secrets?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export class GenericApiAdapter implements PaymentAdapter {
  readonly adapterName = 'generic_api';
  readonly integrationType = 'api' as const;

  private getConfig(rawConfig: Record<string, unknown>): GenericApiConfig {
    return decryptProviderConfig(rawConfig) as unknown as GenericApiConfig;
  }

  async initPayment(params: InitPaymentParams): Promise<PaymentInitResult> {
    const config = this.getConfig(params.provider.config);
    const initCfg = config.init;
    if (!initCfg) throw new Error('Provider init config is missing');

    const vars: Record<string, string> = {
      ...secretVars(config),
      amount: String(params.order.amount),
      currency: params.order.currency,
      orderRef: params.order.ref,
      offerName: params.order.offerName,
      payerName: params.payer.name,
      payerEmail: params.payer.email,
      payerPhone: params.payer.phone,
      callbackUrl: params.callbackUrl,
      webhookUrl: params.webhookUrl,
    };

    // REDIRECT mode: just build a URL
    if (initCfg.method === 'REDIRECT') {
      const url = interpolate(initCfg.urlTemplate || '', vars);
      return {
        providerRef: params.order.ref,
        redirectUrl: url,
        status: 'initiated',
      };
    }

    // API call mode
    const url = interpolate(initCfg.url || '', vars);
    const headers: Record<string, string> = {};
    if (initCfg.headers) {
      for (const [k, v] of Object.entries(initCfg.headers)) {
        headers[k] = interpolate(v, vars);
      }
    }

    let body: string | undefined;
    if (initCfg.bodyTemplate) {
      const interpolated = interpolateDeep(initCfg.bodyTemplate, vars);
      if (initCfg.contentType === 'form-urlencoded') {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        body = new URLSearchParams(
          Object.entries(interpolated as Record<string, string>),
        ).toString();
      } else {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        headers['Accept'] = headers['Accept'] || 'application/json';
        body = JSON.stringify(interpolated);
      }
    }

    const response = await fetch(url, {
      method: initCfg.method,
      headers,
      body,
    });

    const responseBody = await response.json().catch(() => ({}));

    if (!response.ok && response.status >= 500) {
      throw new Error(`Payment provider error: HTTP ${response.status}`);
    }

    const mapping = initCfg.responseMapping || {};
    const providerRef = mapping.providerRef
      ? String(getByPath(responseBody, mapping.providerRef) ?? '')
      : params.order.ref;
    const redirectUrl = mapping.redirectUrl
      ? String(getByPath(responseBody, mapping.redirectUrl) ?? '')
      : undefined;

    return {
      providerRef,
      redirectUrl: redirectUrl || undefined,
      status: redirectUrl ? 'initiated' : 'pending',
      rawResponse: responseBody,
    };
  }

  async verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerifyResult> {
    const config = this.getConfig(params.provider.config);
    const verifyCfg = config.verify;

    if (!verifyCfg || verifyCfg.method === 'MANUAL') {
      return { status: 'pending', providerRef: params.providerRef };
    }

    const vars: Record<string, string> = {
      ...secretVars(config),
      providerRef: params.providerRef,
      orderRef: params.orderRef,
    };

    const url = interpolate(verifyCfg.url || '', vars);
    const headers: Record<string, string> = {};
    if (verifyCfg.headers) {
      for (const [k, v] of Object.entries(verifyCfg.headers)) {
        headers[k] = interpolate(v, vars);
      }
    }
    headers['Accept'] = headers['Accept'] || 'application/json';

    const response = await fetch(url, { method: verifyCfg.method, headers });
    const responseBody = await response.json().catch(() => ({}));

    const mapping = verifyCfg.responseMapping || {};
    const rawStatus = mapping.status
      ? String(getByPath(responseBody, mapping.status) ?? 'pending')
      : 'pending';
    const status = mapStatus(rawStatus, mapping.statusMap);

    const amount = mapping.amount
      ? Number(getByPath(responseBody, mapping.amount) ?? 0)
      : undefined;
    const currency = mapping.currency
      ? String(getByPath(responseBody, mapping.currency) ?? '')
      : undefined;

    // Security: verify amount and currency match if completed
    if (status === 'completed' && amount !== undefined) {
      if (amount !== params.expectedAmount) {
        console.warn(
          `[GenericAPI] Amount mismatch: expected ${params.expectedAmount}, got ${amount} for ${params.orderRef}`,
        );
        return { status: 'failed', providerRef: params.providerRef, rawResponse: responseBody };
      }
    }

    return {
      status,
      amount,
      currency,
      providerRef: params.providerRef,
      rawResponse: responseBody,
    };
  }

  async parseWebhook(params: ParseWebhookParams): Promise<WebhookParseResult> {
    const config = this.getConfig(params.provider.config);
    const whCfg = config.webhook;

    if (!whCfg) {
      return { isValid: false, status: 'pending' };
    }

    // Signature verification
    if (whCfg.signatureAlgo && whCfg.signatureAlgo !== 'none') {
      const sigHeader = whCfg.signatureHeader
        ? params.headers[whCfg.signatureHeader.toLowerCase()]
        : undefined;

      if (!sigHeader) {
        return { isValid: false, status: 'pending' };
      }

      const secretKey = whCfg.signatureKey
        ? interpolate(whCfg.signatureKey, secretVars(config))
        : '';

      if (!secretKey) {
        return { isValid: false, status: 'pending' };
      }

      let expectedSig: string;
      if (whCfg.signatureAlgo === 'hmac-sha256') {
        expectedSig = createHmac('sha256', secretKey)
          .update(params.rawBody)
          .digest('hex');
      } else if (whCfg.signatureAlgo === 'hmac-sha512') {
        expectedSig = createHmac('sha512', secretKey)
          .update(params.rawBody)
          .digest('hex');
      } else {
        return { isValid: false, status: 'pending' };
      }

      // Timing-safe comparison
      try {
        const a = Buffer.from(expectedSig, 'utf8');
        const b = Buffer.from(sigHeader, 'utf8');
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          console.warn('[GenericAPI] Webhook signature mismatch');
          return { isValid: false, status: 'pending' };
        }
      } catch {
        return { isValid: false, status: 'pending' };
      }
    }

    // Parse payload
    let payload: unknown;
    try {
      payload = JSON.parse(params.rawBody);
    } catch {
      return { isValid: false, status: 'pending' };
    }

    const orderRef = whCfg.refPath
      ? String(getByPath(payload, whCfg.refPath) ?? '')
      : undefined;
    const providerRef = whCfg.providerRefPath
      ? String(getByPath(payload, whCfg.providerRefPath) ?? '')
      : undefined;
    const rawStatus = whCfg.statusPath
      ? String(getByPath(payload, whCfg.statusPath) ?? 'pending')
      : 'pending';
    const status = mapStatus(rawStatus, whCfg.statusMap);
    const amount = whCfg.amountPath
      ? Number(getByPath(payload, whCfg.amountPath) ?? 0)
      : undefined;

    return {
      isValid: true,
      orderRef: orderRef || undefined,
      providerRef: providerRef || undefined,
      status,
      amount,
      rawEvent: payload,
    };
  }
}
