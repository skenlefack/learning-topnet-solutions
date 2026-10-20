// ============================================================================
// Payment Adapter Registry — Factory for adapter instances
// ============================================================================
import type { PaymentAdapter } from './types';
import { ManualTransferAdapter } from './manual-transfer.adapter';
import { WalletAdapter } from './wallet.adapter';
import { GenericApiAdapter } from './generic-api.adapter';

const adapters: Record<string, () => PaymentAdapter> = {
  manual_transfer: () => new ManualTransferAdapter(),
  wallet: () => new WalletAdapter(),
  generic_api: () => new GenericApiAdapter(),
};

/**
 * Get an adapter instance by name.
 * For any adapter_name not in the built-in registry, falls back to generic_api.
 * This means any provider configured with adapter_name like 'stripe', 'notchpay',
 * 'flutterwave', etc. will use the generic configurable adapter automatically.
 */
export function getAdapter(adapterName: string): PaymentAdapter {
  const factory = adapters[adapterName];
  if (factory) return factory();

  // Fallback: use generic_api for all unknown adapter names
  // The provider's config JSONB contains all the API details
  return new GenericApiAdapter();
}

/** Register a custom adapter (for extensions) */
export function registerAdapter(name: string, factory: () => PaymentAdapter): void {
  adapters[name] = factory;
}

/** List all registered adapter names */
export function listAdapters(): string[] {
  return Object.keys(adapters);
}
