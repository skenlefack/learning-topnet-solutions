// ============================================================================
// ARIS Academy — Document Converter Client
// Calls the converter microservice (LibreOffice headless container)
// Falls back gracefully if converter is unavailable
// ============================================================================

const CONVERTER_URL = process.env.CONVERTER_URL || 'http://converter:4010';

const SUPPORTED_CONVERSIONS: Record<string, boolean> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'application/vnd.oasis.opendocument.text': true,
  'application/vnd.oasis.opendocument.spreadsheet': true,
  'application/vnd.oasis.opendocument.presentation': true,
  'application/msword': true,
  'application/vnd.ms-excel': true,
  'application/vnd.ms-powerpoint': true,
};

export function isConvertible(mimeType: string): boolean {
  return !!SUPPORTED_CONVERSIONS[mimeType];
}

/**
 * Convert a document to PDF via the converter microservice.
 * Returns PDF buffer or null if conversion fails/unavailable.
 */
export async function convertToPdf(
  inputBuffer: Buffer,
  originalFilename: string,
): Promise<Buffer | null> {
  try {
    const url = `${CONVERTER_URL}/convert?filename=${encodeURIComponent(originalFilename)}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: inputBuffer,
      signal: AbortSignal.timeout(120000),
    });

    if (!response.ok) {
      const err = await response.text().catch(() => 'Unknown error');
      console.warn(`[converter] Conversion failed (${response.status}): ${err}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.warn(`[converter] Service unavailable: ${err.message}`);
    return null;
  }
}
