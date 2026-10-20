// ============================================================================
// Topnet Solutions Academy — Zod Validation Schemas & Helpers
// Reusable schemas for all microservices
// ============================================================================
import { z, ZodSchema } from 'zod';

// ---------------------------------------------------------------------------
// Primitive schemas
// ---------------------------------------------------------------------------

export const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be >= 1').default(1),
  limit: z.coerce.number().int().min(1).max(100, 'Limit must be <= 100').default(20),
});

// ---------------------------------------------------------------------------
// Domain schemas
// ---------------------------------------------------------------------------

export const multiLangTextSchema = z
  .object({
    fr: z.string().min(1).optional(),
    en: z.string().min(1).optional(),
    ar: z.string().min(1).optional(),
    pt: z.string().min(1).optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one language translation is required (fr, en, ar, or pt)' },
  );

export const tenantLevelSchema = z.enum(['continental', 'rec', 'country']);

export const courseLevelSchema = z.enum(['beginner', 'intermediate', 'advanced', 'expert']);

// ---------------------------------------------------------------------------
// Validation error type
// ---------------------------------------------------------------------------

export interface ValidationError {
  field: string;
  message: string;
}

// ---------------------------------------------------------------------------
// validateBody helper
// ---------------------------------------------------------------------------

export function validateBody<T>(schema: ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  const errors: ValidationError[] = result.error.errors.map((issue) => ({
    field: issue.path.join('.') || '_root',
    message: issue.message,
  }));

  const err = new Error('Validation failed') as Error & {
    statusCode: number;
    validation: ValidationError[];
  };
  err.statusCode = 400;
  err.validation = errors;
  throw err;
}
