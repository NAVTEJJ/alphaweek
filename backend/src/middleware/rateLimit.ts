import rateLimit from 'express-rate-limit';
import { redis } from '../../config/redis';

// Lua: atomic INCR + PEXPIRE only on first write, returns [hits, pttl]
// Using PEXPIRE so resetTime is millisecond-accurate.
const INCR_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local pttl = redis.call('PTTL', KEYS[1])
return {hits, pttl}
`;

// Implements the express-rate-limit Store interface using the existing ioredis client.
// Shares the application Redis connection — no extra connection needed.
class RedisStore {
  private windowMs: number;
  private keyPrefix: string; // named keyPrefix to avoid clash with Store.prefix

  constructor(windowMs: number, keyPrefix: string) {
    this.windowMs = windowMs;
    this.keyPrefix = keyPrefix;
  }

  async increment(key: string) {
    const rkey = `${this.keyPrefix}${key}`;
    const result = (await redis.eval(INCR_SCRIPT, 1, rkey, String(this.windowMs))) as [number, number];
    const totalHits = result[0];
    const pttl = result[1];
    const resetTime = new Date(Date.now() + (pttl > 0 ? pttl : this.windowMs));
    return { totalHits, resetTime };
  }

  async decrement(key: string) {
    const rkey = `${this.keyPrefix}${key}`;
    const remaining = await redis.decr(rkey);
    if (remaining < 0) await redis.del(rkey);
  }

  async resetKey(key: string) {
    await redis.del(`${this.keyPrefix}${key}`);
  }
}

// Public endpoints — 60 requests per minute per IP
export const publicRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(60 * 1000, 'rl:pub:'),
  message: {
    error: 'Too many requests, please try again later',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

// Auth endpoints — 10 requests per minute per IP (prevent brute force)
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(60 * 1000, 'rl:auth:'),
  message: {
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
});

// Authenticated endpoints — 300 requests per minute per user/IP
export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(60 * 1000, 'rl:api:'),
  keyGenerator: (req) => {
    const userId = (req as { user?: { id: string } }).user?.id;
    return userId ?? req.ip ?? 'unknown';
  },
  message: {
    error: 'API rate limit exceeded',
    code: 'API_RATE_LIMIT_EXCEEDED',
  },
});

// Webhook endpoints — 200 per minute (Stripe can be bursty)
export const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore(60 * 1000, 'rl:wh:'),
  message: {
    error: 'Webhook rate limit exceeded',
    code: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
  },
});
