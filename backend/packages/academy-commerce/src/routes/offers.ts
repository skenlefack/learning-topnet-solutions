// ============================================================================
// Offers Routes — Public listing + Admin CRUD
// ============================================================================
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  query, queryOne, validateBody, uuidSchema, multiLangTextSchema,
  BearerSecurity,
} from '@topnet-academy/shared';

const createOfferSchema = z.object({
  code: z.string().min(1).max(30),
  kind: z.enum(['course_access', 'credits', 'unlimited_pass', 'test_unlock', 'pack', 'service']),
  name: multiLangTextSchema,
  tagline: multiLangTextSchema.optional(),
  description: multiLangTextSchema.optional(),
  price: z.number().int().min(0),
  currency: z.string().max(3).default('XAF'),
  priceIncludesTax: z.boolean().default(true),
  taxRate: z.number().min(0).max(1).default(0),
  credits: z.number().int().min(0).default(0),
  days: z.number().int().min(0).default(0),
  voucherCount: z.number().int().min(0).default(0),
  services: z.array(z.string()).default([]),
  courseIds: z.array(uuidSchema).default([]),
  assessmentIds: z.array(uuidSchema).default([]),
  maxInstallments: z.number().int().min(1).max(12).default(1),
  features: z.array(z.string()).default([]),
  isHighlighted: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

const updateOfferSchema = createOfferSchema.partial().omit({ code: true });

export async function offerRoutes(app: FastifyInstance) {

  // GET /offers/public — public listing (no auth)
  app.get('/public', async (req: any, reply) => {
    const tenantId = req.headers['x-tenant-id'] || null;
    let rows;
    if (tenantId) {
      rows = await query(
        `SELECT * FROM academy_core.offers
         WHERE tenant_id = $1 AND is_active = true
         ORDER BY sort_order, price`,
        [tenantId],
      );
    } else {
      rows = await query(
        `SELECT * FROM academy_core.offers WHERE is_active = true ORDER BY sort_order, price`,
      );
    }
    return reply.send({ success: true, data: rows });
  });

  // GET /offers/public/:code — single offer detail (no auth)
  app.get('/public/:code', async (req: any, reply) => {
    const offer = await queryOne(
      `SELECT * FROM academy_core.offers WHERE code = $1 AND is_active = true`,
      [req.params.code],
    );
    if (!offer) return reply.code(404).send({ success: false, error: 'Offer not found' });
    return reply.send({ success: true, data: offer });
  });

  // =========== Admin routes ===========

  // GET /offers/admin — all offers (including inactive)
  app.get('/admin', {
    schema: { summary: 'List all offers (admin)', tags: ['Offers'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply) => {
    const { clause, params } = req.tenantFilter();
    const rows = await query(
      `SELECT * FROM academy_core.offers WHERE ${clause} ORDER BY sort_order, price`,
      params,
    );
    return reply.send({ success: true, data: rows });
  });

  // POST /offers/admin — create offer
  app.post('/admin', {
    schema: { summary: 'Create offer', tags: ['Offers'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(createOfferSchema, req.body);
    const tenantId = req.user.tenantId;

    const existing = await queryOne(
      `SELECT id FROM academy_core.offers WHERE tenant_id = $1 AND code = $2`,
      [tenantId, data.code],
    );
    if (existing) return reply.code(409).send({ success: false, error: 'Offer code already exists' });

    const offer = await queryOne<any>(`
      INSERT INTO academy_core.offers
        (tenant_id, code, kind, name, tagline, description, price, currency,
         price_includes_tax, tax_rate, credits, days, voucher_count, services,
         course_ids, assessment_ids, max_installments, features,
         is_highlighted, is_active, sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      RETURNING *`,
      [
        tenantId, data.code, data.kind, JSON.stringify(data.name),
        JSON.stringify(data.tagline ?? {}), JSON.stringify(data.description ?? {}),
        data.price, data.currency, data.priceIncludesTax, data.taxRate,
        data.credits, data.days, data.voucherCount, data.services,
        data.courseIds, data.assessmentIds, data.maxInstallments,
        JSON.stringify(data.features), data.isHighlighted, data.isActive, data.sortOrder,
      ],
    );

    return reply.code(201).send({ success: true, data: offer });
  });

  // PUT /offers/admin/:id — update offer
  app.put('/admin/:id', {
    schema: { summary: 'Update offer', tags: ['Offers'], security: BearerSecurity },
    preHandler: [app.authenticate, app.requireRole('admin_country', 'admin_rec', 'admin_continental')],
  }, async (req: any, reply: FastifyReply) => {
    const data = validateBody(updateOfferSchema, req.body);
    const sets: string[] = [];
    const params: any[] = [];

    const fieldMap: Record<string, string> = {
      kind: 'kind', price: 'price', currency: 'currency',
      priceIncludesTax: 'price_includes_tax', taxRate: 'tax_rate',
      credits: 'credits', days: 'days', voucherCount: 'voucher_count',
      maxInstallments: 'max_installments', isHighlighted: 'is_highlighted',
      isActive: 'is_active', sortOrder: 'sort_order',
    };
    const jsonFields = ['name', 'tagline', 'description', 'features'];
    const arrayFields = ['services', 'courseIds', 'assessmentIds'];

    for (const [key, col] of Object.entries(fieldMap)) {
      if ((data as any)[key] !== undefined) {
        params.push((data as any)[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    for (const key of jsonFields) {
      if ((data as any)[key] !== undefined) {
        params.push(JSON.stringify((data as any)[key]));
        sets.push(`${key} = $${params.length}`);
      }
    }
    for (const key of arrayFields) {
      if ((data as any)[key] !== undefined) {
        const col = key === 'courseIds' ? 'course_ids'
          : key === 'assessmentIds' ? 'assessment_ids'
          : key;
        params.push((data as any)[key]);
        sets.push(`${col} = $${params.length}`);
      }
    }

    if (sets.length === 0) {
      return reply.code(400).send({ success: false, error: 'No fields to update' });
    }

    params.push(req.params.id);
    const offer = await queryOne<any>(
      `UPDATE academy_core.offers SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    if (!offer) return reply.code(404).send({ success: false, error: 'Offer not found' });
    return reply.send({ success: true, data: offer });
  });
}
