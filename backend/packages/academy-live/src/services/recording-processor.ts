// ============================================================================
// ARIS Academy — Recording Processor
// Downloads BBB recordings, uploads to MinIO, creates replay lessons
// ============================================================================
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { queryOne, publishEvent, TOPICS } from '@aris-academy/shared';

// ---------------------------------------------------------------------------
// MinIO client (S3-compatible)
// ---------------------------------------------------------------------------

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'minio.au-ibar.org';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'aris-academy';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'aris-secret';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL !== 'false';
const MINIO_BUCKET = 'academy-recordings';

// Lazy-loaded MinIO client (avoids import failure if minio not installed yet)
let minioClient: any = null;

async function getMinioClient(): Promise<any> {
  if (!minioClient) {
    const { Client } = await import('minio');
    minioClient = new Client({
      endPoint: MINIO_ENDPOINT,
      port: MINIO_PORT,
      useSSL: MINIO_USE_SSL,
      accessKey: MINIO_ACCESS_KEY,
      secretKey: MINIO_SECRET_KEY,
    });

    // Ensure bucket exists
    const exists = await minioClient.bucketExists(MINIO_BUCKET);
    if (!exists) {
      await minioClient.makeBucket(MINIO_BUCKET);
      console.log(`[MinIO] Created bucket: ${MINIO_BUCKET}`);
    }
  }
  return minioClient;
}

// ---------------------------------------------------------------------------
// Presigned URL generation
// ---------------------------------------------------------------------------

const PRESIGNED_URL_EXPIRY_SECONDS = 2 * 60 * 60; // 2 hours

export async function getPresignedUrl(objectName: string): Promise<string> {
  const client = await getMinioClient();
  return client.presignedGetObject(MINIO_BUCKET, objectName, PRESIGNED_URL_EXPIRY_SECONDS);
}

// ---------------------------------------------------------------------------
// Delete recording from MinIO
// ---------------------------------------------------------------------------

export async function deleteRecordingObject(objectName: string): Promise<void> {
  const client = await getMinioClient();
  await client.removeObject(MINIO_BUCKET, objectName);
}

// ---------------------------------------------------------------------------
// Main processor
// ---------------------------------------------------------------------------

export async function processRecording(
  sessionId: string,
  bbbRecordingUrl: string
): Promise<{ minioUrl: string; objectName: string } | null> {
  console.log(`[RecordingProcessor] Processing recording for session ${sessionId}`);

  // a) Download the recording from BBB
  let response: Response;
  try {
    response = await fetch(bbbRecordingUrl);
    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status}`);
    }
  } catch (err) {
    console.error(`[RecordingProcessor] Failed to download recording:`, err);
    return null;
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';

  // b) Determine file extension — BBB usually provides webm or mp4
  let ext = 'mp4';
  if (contentType.includes('webm')) ext = 'webm';
  else if (contentType.includes('mpeg')) ext = 'mp4';
  else if (contentType.includes('ogg')) ext = 'ogg';

  const objectName = `sessions/${sessionId}/${randomUUID()}.${ext}`;

  // c) Upload to MinIO
  try {
    const client = await getMinioClient();
    const body = response.body;
    if (!body) throw new Error('Empty response body');

    // Convert web ReadableStream to Node Readable
    const nodeStream = Readable.fromWeb(body as any);
    const contentLength = parseInt(response.headers.get('content-length') || '0', 10) || undefined;

    await client.putObject(
      MINIO_BUCKET,
      objectName,
      nodeStream,
      contentLength,
      { 'Content-Type': contentType }
    );

    console.log(`[RecordingProcessor] Uploaded to MinIO: ${objectName}`);
  } catch (err) {
    console.error(`[RecordingProcessor] Failed to upload to MinIO:`, err);
    return null;
  }

  // d) Update live_sessions with the MinIO object reference
  const minioUrl = `minio://${MINIO_BUCKET}/${objectName}`;
  const session = await queryOne(`
    UPDATE academy_core.live_sessions
    SET recording_url = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [sessionId, minioUrl]);

  if (!session) {
    console.error(`[RecordingProcessor] Session ${sessionId} not found in DB`);
    return null;
  }

  // e) Auto-create a replay lesson in the associated course
  if (session.course_id) {
    try {
      // Find the first module of the course (or a dedicated "Replays" module)
      let replayModule = await queryOne(`
        SELECT id FROM academy_core.modules
        WHERE course_id = $1
        ORDER BY sort_order DESC
        LIMIT 1
      `, [session.course_id]);

      if (replayModule) {
        const title = typeof session.title === 'string'
          ? JSON.parse(session.title)
          : session.title;

        // Build replay lesson title
        const replayTitle: Record<string, string> = {};
        for (const [lang, text] of Object.entries(title)) {
          replayTitle[lang] = `[Replay] ${text}`;
        }

        // Get the next sort_order
        const lastLesson = await queryOne(`
          SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
          FROM academy_core.lessons WHERE module_id = $1
        `, [replayModule.id]);

        await queryOne(`
          INSERT INTO academy_core.lessons
            (module_id, title, type, video_url, duration_minutes, sort_order, is_required)
          VALUES ($1, $2, 'replay', $3, $4, $5, false)
          RETURNING id
        `, [
          replayModule.id,
          JSON.stringify(replayTitle),
          minioUrl,
          session.recording_duration_seconds
            ? Math.ceil(session.recording_duration_seconds / 60)
            : session.duration_minutes,
          lastLesson?.next_order || 1,
        ]);

        console.log(`[RecordingProcessor] Created replay lesson for course ${session.course_id}`);
      }
    } catch (err) {
      console.error(`[RecordingProcessor] Failed to create replay lesson:`, err);
      // Non-fatal: recording is still saved
    }
  }

  // f) Publish LIVE_RECORDED event
  await publishEvent(TOPICS.LIVE_RECORDED, {
    sessionId,
    recordingUrl: minioUrl,
    courseId: session.course_id,
    objectName,
  }, session.tenant_id);

  console.log(`[RecordingProcessor] Completed processing for session ${sessionId}`);
  return { minioUrl, objectName };
}
