import Redis from 'ioredis';
import { logger } from '../src/utils/logger';

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('Missing required environment variable: REDIS_URL');
}

// Primary Redis client — used for caching
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
  retryStrategy: (times: number) => {
    if (times > 5) {
      logger.error('Redis connection failed after 5 retries');
      return null;
    }
    return Math.min(times * 200, 2000);
  },
});

// BullMQ requires a separate connection instance (cannot share with cache client)
export const bullMQConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,   // Required by BullMQ
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { error: err.message }));

export async function verifyRedisConnection(): Promise<void> {
  await redis.ping();
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export const CACHE_TTL = {
  MARKET_DATA: 3600,      // 1 hour — shared across all users
  GEO_EVENTS: 21600,     // 6 hours
  STOCK_PRICE: 300,       // 5 minutes — per-ticker price lookup
  USER_PROFILE: 300,      // 5 minutes
  BRIEF_PREVIEW: 86400,   // 24 hours — rendered brief HTML
} as const;
