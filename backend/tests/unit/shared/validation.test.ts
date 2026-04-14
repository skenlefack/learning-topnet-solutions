// ============================================================================
// ARIS Academy — Unit Tests: Zod Validation Schemas & Helpers
// Pure unit tests — no DB, no Fastify, no external deps
// ============================================================================
import { describe, it, expect, vi } from 'vitest';

// Mock external deps that @aris-academy/shared barrel transitively imports
vi.mock('@fastify/rate-limit', () => ({ default: vi.fn() }));

import {
  uuidSchema,
  paginationSchema,
  multiLangTextSchema,
  tenantLevelSchema,
  courseLevelSchema,
  validateBody,
} from '@aris-academy/shared';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// uuidSchema
// ---------------------------------------------------------------------------

describe('uuidSchema', () => {
  it('accepts a valid v4 UUID', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(uuidSchema.parse(uuid)).toBe(uuid);
  });

  it('accepts a valid lowercase UUID', () => {
    expect(uuidSchema.parse('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBeDefined();
  });

  it('rejects a plain string that is not a UUID', () => {
    expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => uuidSchema.parse('')).toThrow();
  });

  it('rejects a number', () => {
    expect(() => uuidSchema.parse(12345)).toThrow();
  });

  it('rejects null and undefined', () => {
    expect(() => uuidSchema.parse(null)).toThrow();
    expect(() => uuidSchema.parse(undefined)).toThrow();
  });

  it('rejects a UUID with missing segments', () => {
    expect(() => uuidSchema.parse('550e8400-e29b-41d4-a716')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// paginationSchema
// ---------------------------------------------------------------------------

describe('paginationSchema', () => {
  it('applies default values for an empty object', () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('coerces string numbers to integers', () => {
    const result = paginationSchema.parse({ page: '3', limit: '50' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('accepts valid page and limit values', () => {
    const result = paginationSchema.parse({ page: 5, limit: 100 });
    expect(result.page).toBe(5);
    expect(result.limit).toBe(100);
  });

  it('rejects page less than 1', () => {
    expect(() => paginationSchema.parse({ page: 0 })).toThrow();
    expect(() => paginationSchema.parse({ page: -1 })).toThrow();
  });

  it('rejects limit greater than 100', () => {
    expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
  });

  it('rejects negative limit', () => {
    expect(() => paginationSchema.parse({ limit: -1 })).toThrow();
  });

  it('rejects limit of 0', () => {
    expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
  });

  it('rejects float strings (coerced to non-integer)', () => {
    // z.coerce.number() converts '2.9' to 2.9, then .int() rejects it
    expect(() => paginationSchema.parse({ page: '2.9', limit: '10.1' })).toThrow();
    expect(() => paginationSchema.parse({ page: '2.5' })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// multiLangTextSchema
// ---------------------------------------------------------------------------

describe('multiLangTextSchema', () => {
  it('accepts an object with a single language (fr)', () => {
    const result = multiLangTextSchema.parse({ fr: 'Bonjour' });
    expect(result).toEqual({ fr: 'Bonjour' });
  });

  it('accepts an object with a single language (en)', () => {
    const result = multiLangTextSchema.parse({ en: 'Hello' });
    expect(result).toEqual({ en: 'Hello' });
  });

  it('accepts an object with a single language (ar)', () => {
    expect(multiLangTextSchema.parse({ ar: 'مرحبا' })).toEqual({ ar: 'مرحبا' });
  });

  it('accepts an object with a single language (pt)', () => {
    expect(multiLangTextSchema.parse({ pt: 'Ola' })).toEqual({ pt: 'Ola' });
  });

  it('accepts all four languages simultaneously', () => {
    const input = { fr: 'Salut', en: 'Hi', ar: 'مرحبا', pt: 'Ola' };
    expect(multiLangTextSchema.parse(input)).toEqual(input);
  });

  it('accepts a subset of languages (two of four)', () => {
    const input = { en: 'Hello', fr: 'Bonjour' };
    expect(multiLangTextSchema.parse(input)).toEqual(input);
  });

  it('rejects an empty object (no language provided)', () => {
    expect(() => multiLangTextSchema.parse({})).toThrow('At least one language');
  });

  it('rejects when all language values are undefined', () => {
    // z.string().min(1).optional() means the key can be absent,
    // but if present must be a non-empty string.
    // An empty object {} fails the refine.
    expect(() => multiLangTextSchema.parse({})).toThrow();
  });

  it('rejects an empty string value for a language', () => {
    expect(() => multiLangTextSchema.parse({ fr: '' })).toThrow();
  });

  it('rejects a non-string value', () => {
    expect(() => multiLangTextSchema.parse({ en: 123 })).toThrow();
  });

  it('strips unknown language keys (only fr/en/ar/pt allowed)', () => {
    // Zod .object() strips unknown keys by default
    const result = multiLangTextSchema.parse({ en: 'Hello', de: 'Hallo' } as any);
    expect(result).not.toHaveProperty('de');
    expect(result).toHaveProperty('en');
  });
});

// ---------------------------------------------------------------------------
// tenantLevelSchema
// ---------------------------------------------------------------------------

describe('tenantLevelSchema', () => {
  it.each(['continental', 'rec', 'country'] as const)(
    'accepts valid tenant level "%s"',
    (level) => {
      expect(tenantLevelSchema.parse(level)).toBe(level);
    },
  );

  it('rejects an invalid level string', () => {
    expect(() => tenantLevelSchema.parse('global')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => tenantLevelSchema.parse('')).toThrow();
  });

  it('rejects a number', () => {
    expect(() => tenantLevelSchema.parse(1)).toThrow();
  });

  it('is case-sensitive (rejects "Continental")', () => {
    expect(() => tenantLevelSchema.parse('Continental')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// courseLevelSchema
// ---------------------------------------------------------------------------

describe('courseLevelSchema', () => {
  it.each(['beginner', 'intermediate', 'advanced', 'expert'] as const)(
    'accepts valid course level "%s"',
    (level) => {
      expect(courseLevelSchema.parse(level)).toBe(level);
    },
  );

  it('rejects an invalid level', () => {
    expect(() => courseLevelSchema.parse('master')).toThrow();
  });

  it('rejects null', () => {
    expect(() => courseLevelSchema.parse(null)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// validateBody
// ---------------------------------------------------------------------------

describe('validateBody', () => {
  it('returns parsed data on successful validation', () => {
    const result = validateBody(uuidSchema, '550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('returns parsed object with defaults applied', () => {
    const result = validateBody(paginationSchema, {});
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it('throws an error with statusCode 400 on validation failure', () => {
    try {
      validateBody(uuidSchema, 'bad-value');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Validation failed');
    }
  });

  it('includes validation errors array with field and message', () => {
    try {
      validateBody(uuidSchema, 'bad-value');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.validation).toBeDefined();
      expect(Array.isArray(err.validation)).toBe(true);
      expect(err.validation.length).toBeGreaterThan(0);
      expect(err.validation[0]).toHaveProperty('field');
      expect(err.validation[0]).toHaveProperty('message');
    }
  });

  it('includes field paths in nested validation errors', () => {
    try {
      validateBody(paginationSchema, { page: -5 });
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.validation.some((v: any) => v.field === 'page')).toBe(true);
    }
  });

  it('sets _root as field name when error is at root level', () => {
    try {
      validateBody(uuidSchema, 'not-uuid');
      expect.fail('Should have thrown');
    } catch (err: any) {
      // For a root-level string schema, path is empty → field becomes '_root'
      expect(err.validation.some((v: any) => v.field === '_root')).toBe(true);
    }
  });

  it('works with multiLangTextSchema for domain validation', () => {
    const result = validateBody(multiLangTextSchema, { en: 'Hello', fr: 'Bonjour' });
    expect(result).toEqual({ en: 'Hello', fr: 'Bonjour' });
  });

  it('throws for multiLangText with empty object', () => {
    try {
      validateBody(multiLangTextSchema, {});
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
      expect(err.validation.length).toBeGreaterThan(0);
    }
  });

  it('works with custom Zod schemas', () => {
    const emailSchema = z.string().email();
    const result = validateBody(emailSchema, 'user@example.org');
    expect(result).toBe('user@example.org');

    try {
      validateBody(emailSchema, 'not-an-email');
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.statusCode).toBe(400);
    }
  });
});
