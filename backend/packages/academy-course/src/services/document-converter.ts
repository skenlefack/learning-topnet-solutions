// ============================================================================
// ARIS Academy — Document Converter
// Converts Office documents (DOCX, PPTX, XLSX) to PDF using LibreOffice
// Falls back to serving original file if conversion fails
// ============================================================================
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SUPPORTED_CONVERSIONS: Record<string, boolean> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,  // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true, // .pptx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,         // .xlsx
  'application/vnd.oasis.opendocument.text': true,        // .odt
  'application/vnd.oasis.opendocument.spreadsheet': true,  // .ods
  'application/vnd.oasis.opendocument.presentation': true, // .odp
  'application/msword': true,                              // .doc
  'application/vnd.ms-excel': true,                        // .xls
  'application/vnd.ms-powerpoint': true,                   // .ppt
};

/**
 * Check if a MIME type can be converted to PDF
 */
export function isConvertible(mimeType: string): boolean {
  return !!SUPPORTED_CONVERSIONS[mimeType];
}

/**
 * Convert a document buffer to PDF using LibreOffice headless
 * Returns the PDF buffer, or null if conversion fails
 */
export async function convertToPdf(
  inputBuffer: Buffer,
  originalFilename: string,
): Promise<Buffer | null> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aris-convert-'));
  const inputPath = path.join(tmpDir, originalFilename);
  const outputDir = tmpDir;

  try {
    // Write input file
    fs.writeFileSync(inputPath, inputBuffer);

    // Convert using LibreOffice
    execSync(
      `libreoffice --headless --convert-to pdf --outdir "${outputDir}" "${inputPath}"`,
      { timeout: 60000, stdio: 'pipe' },
    );

    // Find output PDF
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const pdfPath = path.join(outputDir, `${baseName}.pdf`);

    if (!fs.existsSync(pdfPath)) {
      console.warn('[converter] PDF output not found after conversion');
      return null;
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    return pdfBuffer;
  } catch (err: any) {
    console.warn(`[converter] Conversion failed: ${err.message}`);
    return null;
  } finally {
    // Cleanup
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Get the file extension for a MIME type
 */
export function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'text/html': '.html',
  };
  return map[mimeType] || '';
}
