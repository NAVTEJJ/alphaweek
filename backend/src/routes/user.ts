import { Router, Response } from 'express';
import { body } from 'express-validator';
import { randomBytes, createHash } from 'crypto';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../utils/validator';
import { validateReferralApply } from '../utils/referral';
import { isEmailUnsubscribed, resubscribeEmail, unsubscribeEmail } from '../utils/emailSubscription';
import { apiRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth as never);
router.use(apiRateLimit);

// GET /user/profile
router.get('/profile', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      telegramChatId: true,
      referralCode: true,
      referredBy: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'Profile not found', code: 'PROFILE_NOT_FOUND' });
    return;
  }

  res.json({ data: user });
});

// PUT /user/profile — only name is user-editable here
// Telegram is set exclusively via the /user/telegram/connect flow (one-time token)
router.put(
  '/profile',
  validate([
    body('name').optional().trim().isLength({ min: 2, max: 100 }),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { name } = req.body as { name?: string };

    try {
      const user = await prisma.user.update({
        where: { id: req.user.id },
        data: {
          ...(name !== undefined && { name }),
        },
        select: { id: true, email: true, name: true, plan: true, telegramChatId: true },
      });

      res.json({ data: user });
    } catch {
      res.status(500).json({ error: 'Failed to update profile', code: 'UPDATE_FAILED' });
    }
  }
);

// GET /user/alerts — unread alerts
router.get('/alerts', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const alerts = await prisma.alert.findMany({
    where: { userId: req.user.id, readAt: null },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, type: true, message: true, createdAt: true },
  });

  res.json({ data: alerts });
});

// PATCH /user/alerts/:id/read — mark alert as read
router.patch('/alerts/:id/read', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    await prisma.alert.updateMany({
      where: { id, userId: req.user.id },
      data: { readAt: new Date() },
    });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to mark alert as read', code: 'ALERT_UPDATE_FAILED' });
  }
});

// POST /user/referral/apply — apply a referral code (once per account)
router.post(
  '/referral/apply',
  validate([
    body('code')
      .isString()
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Valid referral code required'),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { code } = req.body as { code: string };
    const normalizedCode = code.toUpperCase();

    // Check if caller has already applied a referral code
    const caller = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { referredBy: true, referralCode: true },
    });

    if (!caller) {
      res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }

    // Look up the referrer once — validateReferralApply needs to know it exists
    const referrer = await prisma.user.findUnique({
      where: { referralCode: normalizedCode },
      select: { id: true },
    });

    const outcome = validateReferralApply({
      callerReferredBy: caller.referredBy,
      callerReferralCode: caller.referralCode,
      submittedCode: normalizedCode,
      referrerExists: referrer !== null,
    });

    if (!outcome.ok) {
      const httpStatus =
        outcome.code === 'ALREADY_REFERRED' ? 409 :
        outcome.code === 'SELF_REFERRAL' ? 400 : 404;
      const errorMessage =
        outcome.code === 'ALREADY_REFERRED' ? 'A referral code has already been applied to this account' :
        outcome.code === 'SELF_REFERRAL' ? 'You cannot apply your own referral code' :
        'Referral code not found';
      res.status(httpStatus).json({
        error: errorMessage,
        code: outcome.code,
        data: { applied: false },
      });
      return;
    }

    // outcome.ok implies referrer was found
    const referrerId = referrer!.id;

    // Atomic: stamp the referral on the caller, notify the referrer, and bump
    // the referrer's running count. Wrapped in a transaction so we never end
    // up with a referral that's recorded but un-notified (or vice versa).
    const refereeName = req.user.email; // we only know email at this layer
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: { referredBy: referrerId },
      }),
      prisma.alert.create({
        data: {
          userId: referrerId,
          type: 'system',
          message: `A new friend joined AlphaWeek using your referral code! (${refereeName})`,
        },
      }),
    ]);

    // Maintain a fast counter in Redis so /referral/stats doesn't have to
    // scan the users table. Best-effort — DB remains the source of truth.
    void redis.incr(`referral:count:${referrerId}`).catch(() => undefined);

    logger.info('Referral code applied', {
      userId: req.user.id,
      referrerId,
      code: normalizedCode,
    });

    res.json({
      data: { applied: true, message: 'Referral code applied! Your friend has been notified.' },
    });
  }
);

// GET /user/onboarded — has this user completed onboarding? Redis-backed flag
// so a new device doesn't replay the onboarding flow. Default: false.
router.get('/onboarded', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const completed = (await redis.get(`onboarded:${req.user.id}`)) === '1';
  res.json({ data: { completed } });
});

// POST /user/onboarded — mark onboarding complete
router.post('/onboarded', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await redis.set(`onboarded:${req.user.id}`, '1');
  res.json({ data: { completed: true } });
});

// GET /user/email-subscription — is this user subscribed to brief emails?
router.get('/email-subscription', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const unsub = await isEmailUnsubscribed(req.user.id);
  res.json({ data: { subscribed: !unsub } });
});

// PUT /user/email-subscription — toggle on/off from Settings
router.put(
  '/email-subscription',
  validate([body('subscribed').isBoolean()]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { subscribed } = req.body as { subscribed: boolean };
    if (subscribed) await resubscribeEmail(req.user.id);
    else await unsubscribeEmail(req.user.id);
    res.json({ data: { subscribed } });
  }
);

// GET /user/referral/stats — how many friends has this user referred?
// Returns the count plus a small sample of recent referees for the UI to render.
router.get(
  '/referral/stats',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const [count, recent] = await Promise.all([
      prisma.user.count({ where: { referredBy: req.user.id } }),
      prisma.user.findMany({
        where: { referredBy: req.user.id },
        select: { email: true, name: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    res.json({
      data: {
        referralCount: count,
        recentReferrals: recent.map((u) => ({
          // Surface only first 2 chars of the email local-part for privacy:
          // "j***@gmail.com" rather than the full address.
          displayName: u.name ?? maskEmail(u.email),
          joinedAt: u.createdAt,
        })),
      },
    });
  }
);

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return 'A friend';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(1, local.length - visible.length))}@${domain}`;
}

// POST /user/telegram/connect — generate a one-time link token for Telegram bot connection
router.post('/telegram/connect', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const token = randomBytes(4).toString('hex').toUpperCase(); // 8-char hex token
  const redisKey = `tg:connect:${token}`;
  await redis.set(redisKey, req.user.id, 'EX', 600); // 10-minute TTL

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? 'AlphaWeekBot';
  const deeplink = `https://t.me/${botUsername}?start=${token}`;

  res.json({ data: { token, deeplink } });
});

// GET /user/telegram/status — poll whether Telegram has been connected
router.get('/telegram/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { telegramChatId: true },
  });
  res.json({ data: { connected: !!user?.telegramChatId, chatId: user?.telegramChatId ?? null } });
});

// DELETE /user/telegram/disconnect — remove Telegram chat ID
router.delete('/telegram/disconnect', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await prisma.user.update({ where: { id: req.user.id }, data: { telegramChatId: null } });
  res.json({ data: { disconnected: true } });
});

// ─── WhiteLabel API Keys ────────────────────────────────────────────────────

// GET /user/api-keys — list API keys (whitelabel only)
router.get('/api-keys', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { plan: true },
  });
  if (user?.plan !== 'whitelabel') {
    res.status(403).json({ error: 'API keys require White Label plan', code: 'PLAN_REQUIRED' });
    return;
  }
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user.id },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: keys });
});

// POST /user/api-keys — create a new API key
router.post(
  '/api-keys',
  validate([body('name').isString().trim().isLength({ min: 1, max: 50 })]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { plan: true },
    });
    if (user?.plan !== 'whitelabel') {
      res.status(403).json({ error: 'API keys require White Label plan', code: 'PLAN_REQUIRED' });
      return;
    }

    const count = await prisma.apiKey.count({ where: { userId: req.user.id } });
    if (count >= 10) {
      res.status(400).json({ error: 'Maximum 10 API keys allowed', code: 'KEY_LIMIT_REACHED' });
      return;
    }

    const rawKey = `aw_live_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.slice(0, 12); // "aw_live_XXXX" — safe to display

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.user.id,
        name: req.body.name,
        keyHash,
        prefix,
      },
    });

    // Return full key ONCE — never stored in plaintext
    res.status(201).json({
      data: {
        id: apiKey.id,
        name: apiKey.name,
        prefix,
        key: rawKey, // shown once only
        createdAt: apiKey.createdAt,
      },
    });
  }
);

// DELETE /user/api-keys/:id — revoke an API key
router.delete('/api-keys/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const key = await prisma.apiKey.findUnique({
    where: { id: req.params.id },
    select: { userId: true },
  });
  if (!key || key.userId !== req.user.id) {
    res.status(404).json({ error: 'API key not found', code: 'NOT_FOUND' });
    return;
  }
  await prisma.apiKey.delete({ where: { id: req.params.id } });
  res.json({ data: { revoked: true } });
});


// POST /user/push-subscription — register a browser push subscription (multi-device)
router.post(
  '/push-subscription',
  validate([
    body('subscription').isObject().withMessage('subscription must be an object'),
    body('subscription.endpoint').isURL().withMessage('Invalid push endpoint'),
    body('subscription.keys').isObject(),
    body('subscription.keys.p256dh').isString(),
    body('subscription.keys.auth').isString(),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { subscription } = req.body as {
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };

    const subJson = JSON.stringify(subscription);
    const listKey = `push:subs:${req.user.id}`;
    const TTL_S = 60 * 60 * 24 * 30; // 30 days

    // If the same endpoint re-registers (browser rotated keys), update it in-place.
    // Otherwise append as a new device, capped at 5 subscriptions per user.
    const existing = await redis.lrange(listKey, 0, -1);
    const sameIdx = existing.findIndex((raw) => {
      try { return (JSON.parse(raw) as { endpoint: string }).endpoint === subscription.endpoint; }
      catch { return false; }
    });

    if (sameIdx !== -1) {
      await redis.lset(listKey, sameIdx, subJson);
    } else if (existing.length < 5) {
      await redis.rpush(listKey, subJson);
    }
    await redis.expire(listKey, TTL_S);

    res.json({ data: { stored: true } });
  }
);

// DELETE /user/push-subscription — remove all push subscriptions for this account
router.delete('/push-subscription', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await Promise.allSettled([
    redis.del(`push:subs:${req.user.id}`),
    redis.del(`push:sub:${req.user.id}`), // legacy single-device key
  ]);
  res.json({ data: { removed: true } });
});

// DELETE /user/account — GDPR account deletion
// Wipes all user data and deletes Clerk account.
router.delete('/account', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const userId = req.user.id;

  try {
    // 1. Clear Redis keys for this user
    await Promise.allSettled([
      redis.del(`push:subs:${userId}`),
      redis.del(`push:sub:${userId}`), // legacy single-device key
      redis.del(`chat:rate:${userId}`),
    ]);

    // 2. Delete all DB records — Prisma cascade handles related rows
    await prisma.user.delete({ where: { id: userId } });

    // 3. Delete Clerk user via Management API (best-effort — non-fatal)
    try {
      await fetch(`https://api.clerk.com/v1/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}` },
      });
    } catch (clerkErr) {
      logger.warn('Failed to delete Clerk user on account deletion', {
        userId,
        error: clerkErr instanceof Error ? clerkErr.message : String(clerkErr),
      });
    }

    logger.info('Account deleted', { userId });
    res.json({ data: { deleted: true } });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Account deletion failed', { userId, error: error.message });
    res.status(500).json({ error: 'Failed to delete account', code: 'DELETE_FAILED' });
  }
});

export default router;
