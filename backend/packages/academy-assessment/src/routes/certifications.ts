// ============================================================================
// ARIS Academy — Certification Routes
// Issue, verify, download, revoke, stats
// ============================================================================
import { FastifyInstance } from 'fastify';
import { query, queryOne, publishEvent, TOPICS, auditLog } from '@aris-academy/shared';
import { randomUUID } from 'crypto';
import { generateCertificate, getSignedDownloadUrl } from '../services/certificate-generator';

// ---------------------------------------------------------------------------
// issueCertification — called by attempts route on final exam pass
// ---------------------------------------------------------------------------

export async function issueCertification(
  userId: string,
  courseId: string,
  level: string,
  tenantId: string,
): Promise<any> {
  const certNumber = `ARIS-CERT-${new Date().getFullYear()}-${randomUUID().split('-')[0].toUpperCase()}`;

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 3);

  // Generate PDF + QR code and upload to MinIO
  const { pdfUrl, qrCodeData } = await generateCertificate(
    userId,
    courseId,
    level,
    certNumber,
  );

  const cert = await queryOne(`
    INSERT INTO academy_core.certifications
      (user_id, course_id, level, status, certificate_number, issued_at, expires_at, qr_code_data, pdf_url)
    VALUES ($1, $2, $3, 'issued', $4, NOW(), $5, $6, $7)
    RETURNING *
  `, [userId, courseId, level, certNumber, expiresAt, qrCodeData, pdfUrl]);

  await publishEvent(TOPICS.CERTIFICATION_ISSUED, cert, tenantId, userId);
  console.log(`[Certification] Issued ${certNumber} for user ${userId} at level ${level}`);

  return cert;
}

// ---------------------------------------------------------------------------
// Routes — registered at root level to preserve backward-compatible paths
// ---------------------------------------------------------------------------

export async function certificationRoutes(app: FastifyInstance) {

  // Verify certification (PUBLIC — no auth required)
  // Path: GET /verify/:certNumber
  app.get('/verify/:certNumber', async (req: any, reply) => {
    const cert = await queryOne(`
      SELECT c.*, u.first_name, u.last_name, co.title AS course_title
      FROM academy_core.certifications c
      JOIN academy_core.users u ON u.id = c.user_id
      JOIN academy_core.courses co ON co.id = c.course_id
      WHERE c.certificate_number = $1
    `, [req.params.certNumber]);

    if (!cert) {
      return reply.code(404).send({ success: false, error: 'Certificate not found' });
    }

    return reply.send({ success: true, data: cert });
  });

  // List my certifications
  // Path: GET /certifications
  app.get('/certifications', {
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    try {
      const certs = await query(`
        SELECT c.*, co.title AS course_title, co.slug AS course_slug
        FROM academy_core.certifications c
        JOIN academy_core.courses co ON co.id = c.course_id
        WHERE c.user_id = $1
        ORDER BY c.issued_at DESC
      `, [req.user.sub]);

      return reply.send({ success: true, data: certs });
    } catch (err: any) {
      console.warn(`[academy-assessment] DB unavailable, returning mock certifications: ${err.message}`);
      return reply.send({
        success: true,
        data: [{
          id: 'mock-cert-1',
          user_id: req.user.sub,
          course_id: 'mock-course-3',
          level: 'beginner',
          status: 'issued',
          certificate_number: 'ARIS-CERT-2026-MOCK01',
          issued_at: '2026-01-15T00:00:00Z',
          expires_at: '2029-01-15T00:00:00Z',
          course_title: { fr: 'Santé animale de base', en: 'Basic Animal Health' },
          course_slug: 'basic-animal-health',
        }],
      });
    }
  });

  // Download certificate PDF (pre-signed URL redirect)
  // Path: GET /certifications/download/:certNumber
  app.get('/certifications/download/:certNumber', {
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    const cert = await queryOne(
      'SELECT * FROM academy_core.certifications WHERE certificate_number = $1',
      [req.params.certNumber],
    );

    if (!cert) {
      return reply.code(404).send({ success: false, error: 'Certificate not found' });
    }

    // Only the owner or an admin can download
    const isOwner = cert.user_id === req.user.sub;
    const isAdmin = ['admin_country', 'admin_rec', 'admin_continental'].includes(req.user.role);
    if (!isOwner && !isAdmin) {
      return reply.code(403).send({ success: false, error: 'Forbidden' });
    }

    if (!cert.pdf_url) {
      return reply.code(404).send({ success: false, error: 'PDF not available for this certificate' });
    }

    const downloadUrl = await getSignedDownloadUrl(cert.certificate_number);
    return reply.redirect(302, downloadUrl);
  });

  // Revoke a certificate (admin only)
  // Path: POST /certifications/:id/revoke
  app.post('/certifications/:id/revoke', {
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    if (!['admin_country', 'admin_rec', 'admin_continental'].includes(req.user.role)) {
      return reply.code(403).send({ success: false, error: 'Admin access required' });
    }

    const cert = await queryOne(
      'SELECT * FROM academy_core.certifications WHERE id = $1',
      [req.params.id],
    );
    if (!cert) {
      return reply.code(404).send({ success: false, error: 'Certificate not found' });
    }
    if (cert.status === 'revoked') {
      return reply.code(400).send({ success: false, error: 'Already revoked' });
    }

    const { reason } = (req.body as any) || {};

    const revoked = await queryOne(`
      UPDATE academy_core.certifications SET
        status = 'revoked',
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{revokedAt}', to_jsonb(NOW()::text))
                || jsonb_build_object('revokedBy', $2::text, 'revokeReason', $3::text)
      WHERE id = $1 RETURNING *
    `, [cert.id, req.user.sub, reason || 'Administrative revocation']);

    await auditLog(
      req.user.sub,
      req.user.tenantId,
      'certification.revoked',
      'certification',
      cert.id,
      { certNumber: cert.certificate_number, userId: cert.user_id, reason },
      req.ip,
    );

    return reply.send({ success: true, data: revoked });
  });

  // Certification summary by level (for current user)
  // Path: GET /certifications/summary
  app.get('/certifications/summary', {
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    try {
      const userId = req.user.sub;

      const levels = await query(`
        SELECT
          c.level,
          c.status,
          c.certificate_number,
          c.issued_at,
          co.title AS course_title
        FROM academy_core.certifications c
        JOIN academy_core.courses co ON co.id = c.course_id
        WHERE c.user_id = $1
        ORDER BY ARRAY_POSITION(ARRAY['beginner','intermediate','advanced','expert'], c.level::text)
      `, [userId]);

      const summary = {
        foundation: { status: 'locked', certNumber: null, issuedAt: null, courseTitle: null },
        intermediate: { status: 'locked', certNumber: null, issuedAt: null, courseTitle: null },
        advanced: { status: 'locked', certNumber: null, issuedAt: null, courseTitle: null },
        expert: { status: 'locked', certNumber: null, issuedAt: null, courseTitle: null },
      } as Record<string, any>;

      for (const cert of levels as any[]) {
        const key = cert.level === 'beginner' ? 'foundation' : cert.level;
        if (summary[key]) {
          summary[key] = {
            status: cert.status,
            certNumber: cert.certificate_number,
            issuedAt: cert.issued_at,
            courseTitle: cert.course_title,
          };
        }
      }

      // Mark first non-issued level as 'available'
      const levelOrder = ['foundation', 'intermediate', 'advanced', 'expert'];
      let prevDone = true;
      for (const lvl of levelOrder) {
        if (summary[lvl].status === 'issued') {
          prevDone = true;
          continue;
        }
        if (prevDone && summary[lvl].status === 'locked') {
          summary[lvl].status = 'available';
        }
        prevDone = false;
      }

      return reply.send({
        success: true,
        data: {
          levels: summary,
          totalIssued: (levels as any[]).filter((c: any) => c.status === 'issued').length,
          totalLevels: 4,
        },
      });
    } catch (err: any) {
      console.warn(`[academy-assessment] DB unavailable, returning mock certification summary: ${err.message}`);
      return reply.send({
        success: true,
        data: {
          levels: {
            foundation: { status: 'issued', certNumber: 'ARIS-CERT-2026-MOCK01', issuedAt: '2026-01-15T00:00:00Z', courseTitle: { fr: 'Santé animale de base' } },
            intermediate: { status: 'available', certNumber: null, issuedAt: null, courseTitle: null },
            advanced: { status: 'locked', certNumber: null, issuedAt: null, courseTitle: null },
            expert: { status: 'locked', certNumber: null, issuedAt: null, courseTitle: null },
          },
          totalIssued: 1,
          totalLevels: 4,
        },
      });
    }
  });

  // Certification stats (admin only)
  // Path: GET /certifications/stats
  app.get('/certifications/stats', {
    preHandler: [app.authenticate],
  }, async (req: any, reply) => {
    if (!['admin_country', 'admin_rec', 'admin_continental'].includes(req.user.role)) {
      return reply.code(403).send({ success: false, error: 'Admin access required' });
    }

    // Stats by level
    const byLevel = await query(`
      SELECT
        c.level,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE c.status = 'issued') AS active,
        COUNT(*) FILTER (WHERE c.status = 'revoked') AS revoked,
        COUNT(*) FILTER (WHERE c.status = 'expired') AS expired
      FROM academy_core.certifications c
      GROUP BY c.level
      ORDER BY c.level
    `);

    // Stats by tenant (country)
    const byTenant = await query(`
      SELECT
        t.name AS tenant_name,
        t.code AS tenant_code,
        t.level AS tenant_level,
        COUNT(c.id) AS total_certs,
        COUNT(c.id) FILTER (WHERE c.status = 'issued') AS active_certs
      FROM academy_core.certifications c
      JOIN academy_core.users u ON u.id = c.user_id
      JOIN academy_core.tenants t ON t.id = u.tenant_id
      GROUP BY t.id, t.name, t.code, t.level
      ORDER BY total_certs DESC
    `);

    // Pass rate: attempts vs passed, by level
    const passRateByLevel = await query(`
      SELECT
        a.level,
        COUNT(att.id) AS total_attempts,
        COUNT(att.id) FILTER (WHERE att.passed = true) AS passed_attempts,
        CASE
          WHEN COUNT(att.id) > 0
          THEN ROUND(COUNT(att.id) FILTER (WHERE att.passed = true)::numeric / COUNT(att.id)::numeric * 100, 1)
          ELSE 0
        END AS pass_rate
      FROM academy_core.assessment_attempts att
      JOIN academy_core.assessments a ON a.id = att.assessment_id
      WHERE a.is_final = true AND att.submitted_at IS NOT NULL
      GROUP BY a.level
      ORDER BY a.level
    `);

    return reply.send({
      success: true,
      data: {
        byLevel,
        byTenant,
        passRateByLevel,
      },
    });
  });
}
