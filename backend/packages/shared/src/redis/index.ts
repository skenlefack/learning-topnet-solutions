// ============================================================================
// ARIS Academy — Redis Client (Cache + Sessions)
// Graceful degradation: cache misses if Redis is unavailable
// ============================================================================
import Redis from 'ioredis';

let redis: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      keyPrefix: 'academy:',
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });
    redis.on('error', (err) => {
      if (redisAvailable) {
        console.warn('[Redis] Connection lost:', err.message);
      }
      redisAvailable = false;
    });
    redis.on('connect', () => {
      console.log('[Redis] Connected');
      redisAvailable = true;
    });
    redis.on('ready', () => {
      redisAvailable = true;
    });
    // Attempt connection but don't crash if it fails
    redis.connect().catch((err) => {
      console.warn('[Redis] Initial connection failed (non-blocking):', err.message);
      redisAvailable = false;
    });
  }
  return redis;
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redisAvailable) return null;
  try {
    const data = await getRedis().get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  if (!redisAvailable) return;
  try {
    await getRedis().setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // silently fail
  }
}

export async function cacheDel(pattern: string): Promise<void> {
  if (!redisAvailable) return;
  try {
    const r = getRedis();
    const keys = await r.keys(`academy:${pattern}`);
    if (keys.length > 0) {
      const pipeline = r.pipeline();
      keys.forEach(k => pipeline.del(k.replace('academy:', '')));
      await pipeline.exec();
    }
  } catch {
    // silently fail
  }
}

export async function cacheGetOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached) return cached;
  const fresh = await fetcher();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}
