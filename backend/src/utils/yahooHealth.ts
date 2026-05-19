import { redis } from '../../config/redis';
import { logger } from './logger';

// Per-minute success/failure counters with a 10-minute sliding window.
// Used to surface Yahoo Finance reliability via /health/yahoo and to inform
// stale-while-error behaviour in stockService.
const HEALTH_WINDOW_MIN = 10;
const BUCKET_TTL_S = (HEALTH_WINDOW_MIN + 2) * 60; // keep 2-min buffer past window

function minuteBucket(timestamp: number = Date.now()): number {
  return Math.floor(timestamp / 60_000);
}

export async function recordYahooCall(success: boolean): Promise<void> {
  const bucket = minuteBucket();
  const key = `yahoo:stats:${bucket}:${success ? 'ok' : 'fail'}`;
  try {
    await redis
      .multi()
      .incr(key)
      .expire(key, BUCKET_TTL_S)
      .exec();
  } catch (err) {
    // Telemetry must never break the caller — swallow Redis hiccups.
    logger.debug('yahooHealth: failed to record call', { error: String(err) });
  }
}

export interface YahooHealthSummary {
  windowMinutes: number;
  totalCalls: number;
  successCalls: number;
  failureCalls: number;
  successRate: number; // 0..1
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

export async function getYahooHealth(): Promise<YahooHealthSummary> {
  const now = minuteBucket();
  const keys: string[] = [];
  for (let i = 0; i < HEALTH_WINDOW_MIN; i++) {
    keys.push(`yahoo:stats:${now - i}:ok`);
    keys.push(`yahoo:stats:${now - i}:fail`);
  }

  let ok = 0;
  let fail = 0;
  try {
    const values = await redis.mget(...keys);
    values.forEach((v, idx) => {
      const n = v ? parseInt(v, 10) : 0;
      if (idx % 2 === 0) ok += n;
      else fail += n;
    });
  } catch (err) {
    logger.warn('yahooHealth: failed to read stats — defaulting to unknown', { error: String(err) });
  }

  const total = ok + fail;
  const successRate = total > 0 ? ok / total : 1;

  // Need at least 5 calls before we trust the ratio. Below that, report unknown.
  const status: YahooHealthSummary['status'] =
    total < 5 ? 'unknown' :
    successRate >= 0.7 ? 'healthy' :
    successRate >= 0.4 ? 'degraded' :
    'unhealthy';

  return {
    windowMinutes: HEALTH_WINDOW_MIN,
    totalCalls: total,
    successCalls: ok,
    failureCalls: fail,
    successRate,
    status,
  };
}

// Returns true when failure rate is high enough that the caller should prefer
// stale cache over hitting Yahoo again. Conservative: only trips after at least
// 10 calls in the window and >60% failure rate.
export async function shouldPreferStaleCache(): Promise<boolean> {
  const health = await getYahooHealth();
  return health.totalCalls >= 10 && health.successRate < 0.4;
}
