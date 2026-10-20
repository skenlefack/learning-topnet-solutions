// ============================================================================
// Topnet Solutions Academy — AES-256-GCM encryption for payment provider secrets
// ============================================================================
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.PAYMENT_ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error('PAYMENT_ENCRYPTION_KEY must be set (min 16 chars)');
  }
  return scryptSync(raw, 'topnet-academy-salt', 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(encoded: string): string {
  const key = getKey();
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}

export function encryptProviderConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };
  if (result.secrets && typeof result.secrets === 'object') {
    const encrypted: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.secrets as Record<string, string>)) {
      if (typeof v === 'string' && !v.startsWith('encrypted:')) {
        encrypted[k] = 'encrypted:' + encryptSecret(v);
      } else {
        encrypted[k] = v;
      }
    }
    result.secrets = encrypted;
  }
  return result;
}

export function decryptProviderConfig(config: Record<string, unknown>): Record<string, unknown> {
  const result = { ...config };
  if (result.secrets && typeof result.secrets === 'object') {
    const decrypted: Record<string, string> = {};
    for (const [k, v] of Object.entries(result.secrets as Record<string, string>)) {
      if (typeof v === 'string' && v.startsWith('encrypted:')) {
        decrypted[k] = decryptSecret(v.slice('encrypted:'.length));
      } else {
        decrypted[k] = v;
      }
    }
    result.secrets = decrypted;
  }
  return result;
}
