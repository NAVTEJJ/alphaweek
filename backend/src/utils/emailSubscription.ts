import { createHmac, timingSafeEqual } from 'crypto';
import { redis } from '../../config/redis';

// Email-subscription state lives in Redis (no schema migration needed). A
// presence in this key means the user has opted out of brief emails.
function unsubKey(userId: string): string {
  return `email:unsubscribed:${userId}`;
}

function getSecret(): string {
  return process.env.EMAIL_UNSUB_SECRET ?? process.env.CLERK_SECRET_KEY ?? 'change-me';
}

// HMAC-signed token so /unsubscribe links from emails can't be forged. The
// token format is `${userId}.${signature}` — the signature is HMAC-SHA256 of
// `userId` keyed with EMAIL_UNSUB_SECRET, truncated to 24 hex chars.
export function makeUnsubscribeToken(userId: string): string {
  const sig = createHmac('sha256', getSecret()).update(userId).digest('hex').slice(0, 24);
  return `${userId}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [userId, sig] = token.split('.');
  if (!userId || !sig) return null;
  const expected = createHmac('sha256', getSecret()).update(userId).digest('hex').slice(0, 24);
  // timingSafeEqual requires equal-length buffers — verified by slice() above
  if (sig.length !== expected.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return userId;
}

export async function isEmailUnsubscribed(userId: string): Promise<boolean> {
  return (await redis.exists(unsubKey(userId))) === 1;
}

export async function unsubscribeEmail(userId: string): Promise<void> {
  await redis.set(unsubKey(userId), '1');
}

export async function resubscribeEmail(userId: string): Promise<void> {
  await redis.del(unsubKey(userId));
}
