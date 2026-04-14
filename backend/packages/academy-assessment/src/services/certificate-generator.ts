// ============================================================================
// ARIS Academy — Certificate Generator
// Generates AU-IBAR branded PDFs with QR codes, uploads to MinIO
// ============================================================================
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { Client as MinioClient } from 'minio';
import { queryOne } from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET = 'academy-certificates';
const NAVY = '#003399';
const GOLD = '#C8A951';
const DARK = '#1a1a1a';
const GRAY = '#666666';

const VERIFY_BASE_URL = 'https://learning.au-ibar.org/verify';

// ---------------------------------------------------------------------------
// MinIO singleton (assessment-local)
// ---------------------------------------------------------------------------

let minio: MinioClient | null = null;

function getMinioClient(): MinioClient {
  if (!minio) {
    minio = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'academy_minio',
      secretKey: process.env.MINIO_SECRET_KEY || 'academy_minio_secret',
    });
  }
  return minio;
}

export async function initBucket(): Promise<void> {
  const mc = getMinioClient();
  const exists = await mc.bucketExists(BUCKET);
  if (!exists) {
    await mc.makeBucket(BUCKET, '');
    console.log(`[MinIO] Created bucket: ${BUCKET}`);
  }
}

// ---------------------------------------------------------------------------
// generateCertificate — main entry point
// ---------------------------------------------------------------------------

export async function generateCertificate(
  userId: string,
  courseId: string,
  level: string,
  certNumber: string,
): Promise<{ pdfUrl: string; qrCodeData: string }> {
  // Fetch user and course info
  const user = await queryOne(
    'SELECT first_name, last_name FROM academy_core.users WHERE id = $1',
    [userId],
  );
  if (!user) throw new Error(`User ${userId} not found`);

  const course = await queryOne(
    'SELECT title FROM academy_core.courses WHERE id = $1',
    [courseId],
  );
  if (!course) throw new Error(`Course ${courseId} not found`);

  // Resolve course title (prefer English, fallback to French)
  const courseTitle =
    typeof course.title === 'object'
      ? course.title.en || course.title.fr || Object.values(course.title)[0]
      : course.title;

  const fullName = `${user.first_name} ${user.last_name}`;
  const verifyUrl = `${VERIFY_BASE_URL}/${certNumber}`;
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setFullYear(expiresAt.getFullYear() + 3);

  // Generate QR code as PNG buffer
  const qrBuffer = await QRCode.toBuffer(verifyUrl, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 120,
    margin: 1,
    color: { dark: NAVY, light: '#FFFFFF' },
  });

  // Generate PDF
  const pdfBuffer = await buildPdf({
    fullName,
    courseTitle,
    level: formatLevel(level),
    certNumber,
    issuedAt,
    expiresAt,
    qrBuffer,
    verifyUrl,
  });

  // Upload to MinIO
  const key = `${certNumber}.pdf`;
  const mc = getMinioClient();
  await mc.putObject(BUCKET, key, pdfBuffer, pdfBuffer.length, {
    'Content-Type': 'application/pdf',
  });

  const proto = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const host = process.env.MINIO_ENDPOINT || 'localhost';
  const port = process.env.MINIO_PORT || '9000';
  const pdfUrl = `${proto}://${host}:${port}/${BUCKET}/${key}`;

  return { pdfUrl, qrCodeData: verifyUrl };
}

// ---------------------------------------------------------------------------
// getSignedDownloadUrl — pre-signed URL for certificate download
// ---------------------------------------------------------------------------

export async function getSignedDownloadUrl(
  certNumber: string,
  expirySeconds = 3600,
): Promise<string> {
  const mc = getMinioClient();
  return mc.presignedGetObject(BUCKET, `${certNumber}.pdf`, expirySeconds);
}

// ---------------------------------------------------------------------------
// PDF Construction — A4 landscape, AU-IBAR branding
// ---------------------------------------------------------------------------

interface PdfParams {
  fullName: string;
  courseTitle: string;
  level: string;
  certNumber: string;
  issuedAt: Date;
  expiresAt: Date;
  qrBuffer: Buffer;
  verifyUrl: string;
}

function buildPdf(params: PdfParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: { top: 40, bottom: 40, left: 60, right: 60 },
      info: {
        Title: `ARIS Certificate — ${params.certNumber}`,
        Author: 'AU-IBAR — African Union Interafrican Bureau for Animal Resources',
        Subject: `Certificate of Completion — ${params.courseTitle}`,
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const contentW = pageW - 120; // margins

    // ── Decorative border ───────────────────────────────────────────────
    doc.rect(20, 20, pageW - 40, pageH - 40).lineWidth(2).strokeColor(NAVY).stroke();
    doc.rect(28, 28, pageW - 56, pageH - 56).lineWidth(0.5).strokeColor(GOLD).stroke();

    // ── Gold corner flourishes ──────────────────────────────────────────
    const cornerSize = 30;
    const corners = [
      [32, 32], [pageW - 32 - cornerSize, 32],
      [32, pageH - 32 - cornerSize], [pageW - 32 - cornerSize, pageH - 32 - cornerSize],
    ];
    for (const [cx, cy] of corners) {
      doc.rect(cx, cy, cornerSize, cornerSize).lineWidth(1).strokeColor(GOLD).stroke();
    }

    // ── Header: AU-IBAR ─────────────────────────────────────────────────
    let y = 55;

    doc.fontSize(11).fillColor(NAVY).font('Helvetica-Bold');
    doc.text('AFRICAN UNION', 60, y, { align: 'center', width: contentW });
    y += 16;

    doc.fontSize(9).fillColor(GRAY).font('Helvetica');
    doc.text(
      'INTERAFRICAN BUREAU FOR ANIMAL RESOURCES',
      60, y, { align: 'center', width: contentW },
    );
    y += 14;

    doc.fontSize(9).fillColor(GRAY);
    doc.text('AU-IBAR', 60, y, { align: 'center', width: contentW });
    y += 10;

    // ── Divider line ────────────────────────────────────────────────────
    y += 8;
    doc.moveTo(100, y).lineTo(pageW - 100, y).lineWidth(1.5).strokeColor(GOLD).stroke();
    y += 20;

    // ── Title ───────────────────────────────────────────────────────────
    doc.fontSize(28).fillColor(NAVY).font('Helvetica-Bold');
    doc.text('CERTIFICATE OF COMPLETION', 60, y, { align: 'center', width: contentW });
    y += 40;

    doc.fontSize(14).fillColor(GOLD).font('Helvetica-Bold');
    doc.text(`— ${params.level} Level —`, 60, y, { align: 'center', width: contentW });
    y += 35;

    // ── Body text ───────────────────────────────────────────────────────
    doc.fontSize(12).fillColor(DARK).font('Helvetica');
    doc.text('This is to certify that', 60, y, { align: 'center', width: contentW });
    y += 28;

    doc.fontSize(22).fillColor(NAVY).font('Helvetica-Bold');
    doc.text(params.fullName, 60, y, { align: 'center', width: contentW });
    y += 35;

    doc.fontSize(12).fillColor(DARK).font('Helvetica');
    doc.text('has successfully completed the', 60, y, { align: 'center', width: contentW });
    y += 28;

    doc.fontSize(16).fillColor(NAVY).font('Helvetica-Bold');
    doc.text(params.courseTitle, 60, y, { align: 'center', width: contentW });
    y += 28;

    doc.fontSize(12).fillColor(DARK).font('Helvetica');
    doc.text(
      `certification at the ${params.level} level through the ARIS Academy platform.`,
      60, y, { align: 'center', width: contentW },
    );
    y += 40;

    // ── Dates ───────────────────────────────────────────────────────────
    const dateFmt = (d: Date) =>
      d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    doc.fontSize(10).fillColor(GRAY).font('Helvetica');
    doc.text(
      `Date of Issue: ${dateFmt(params.issuedAt)}     |     Valid Until: ${dateFmt(params.expiresAt)}`,
      60, y, { align: 'center', width: contentW },
    );
    y += 30;

    // ── Certificate number ──────────────────────────────────────────────
    doc.fontSize(9).fillColor(GRAY).font('Helvetica');
    doc.text(
      `Certificate No: ${params.certNumber}`,
      60, y, { align: 'center', width: contentW },
    );
    y += 30;

    // ── Signature zone (left) ───────────────────────────────────────────
    const sigY = pageH - 110;
    doc.moveTo(100, sigY).lineTo(300, sigY).lineWidth(0.5).strokeColor(DARK).stroke();
    doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold');
    doc.text('Director, AU-IBAR', 100, sigY + 5, { width: 200, align: 'center' });

    // ── QR code (bottom right) ──────────────────────────────────────────
    const qrX = pageW - 190;
    const qrY = pageH - 150;
    doc.image(params.qrBuffer, qrX, qrY, { width: 90, height: 90 });
    doc.fontSize(7).fillColor(GRAY).font('Helvetica');
    doc.text('Scan to verify', qrX, qrY + 93, { width: 90, align: 'center' });

    // ── Footer ──────────────────────────────────────────────────────────
    doc.fontSize(7).fillColor(GRAY).font('Helvetica');
    doc.text(
      'ARIS Academy — learning.au-ibar.org — A platform of the African Union Interafrican Bureau for Animal Resources',
      60, pageH - 45, { align: 'center', width: contentW },
    );

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatLevel(level: string): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}
