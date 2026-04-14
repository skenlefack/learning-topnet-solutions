// ============================================================================
// ARIS Academy — MinIO Object Storage Service
// Manages: video uploads, thumbnails, documents, certificates
// ============================================================================
import { Client as MinioClient } from 'minio';

// ---------------------------------------------------------------------------
// Buckets
// ---------------------------------------------------------------------------
export const BUCKETS = {
  VIDEOS: 'academy-videos',
  THUMBNAILS: 'academy-thumbnails',
  DOCUMENTS: 'academy-documents',
} as const;

type BucketName = (typeof BUCKETS)[keyof typeof BUCKETS];

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------
let client: MinioClient | null = null;

function getClient(): MinioClient {
  if (!client) {
    client = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'academy_minio',
      secretKey: process.env.MINIO_SECRET_KEY || 'academy_minio_secret',
    });
  }
  return client;
}

// ---------------------------------------------------------------------------
// Ensure buckets exist on startup
// ---------------------------------------------------------------------------
export async function initBuckets(): Promise<void> {
  const mc = getClient();
  for (const bucket of Object.values(BUCKETS)) {
    const exists = await mc.bucketExists(bucket);
    if (!exists) {
      await mc.makeBucket(bucket, '');
      console.log(`[MinIO] Created bucket: ${bucket}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Upload a file buffer
// ---------------------------------------------------------------------------
export async function uploadFile(
  bucket: BucketName,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const mc = getClient();
  await mc.putObject(bucket, key, buffer, buffer.length, {
    'Content-Type': contentType,
  });
  // Return internal URL — services resolve via MinIO endpoint
  const proto = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
  const host = process.env.MINIO_ENDPOINT || 'localhost';
  const port = process.env.MINIO_PORT || '9000';
  return `${proto}://${host}:${port}/${bucket}/${key}`;
}

// ---------------------------------------------------------------------------
// Get a pre-signed download URL
// ---------------------------------------------------------------------------
export async function getSignedUrl(
  bucket: BucketName,
  key: string,
  expirySeconds = 3600,
): Promise<string> {
  const mc = getClient();
  return mc.presignedGetObject(bucket, key, expirySeconds);
}

// ---------------------------------------------------------------------------
// Delete a file
// ---------------------------------------------------------------------------
export async function deleteFile(
  bucket: BucketName,
  key: string,
): Promise<void> {
  const mc = getClient();
  await mc.removeObject(bucket, key);
}
