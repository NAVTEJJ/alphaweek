import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { webhookRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { generateReferralCode } from '../utils/referral';
import { sendWelcomeEmail } from '../services/deliveryService';

const router = Router();

// ─── Clerk Webhook ────────────────────────────────────────────────────────────
router.post('/clerk', webhookRateLimit, async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    res.status(500).json({ error: 'Clerk webhook not configured' });
    return;
  }

  const svixId = req.headers['svix-id'] as string;
  const svixTimestamp = req.headers['svix-timestamp'] as string;
  const svixSignature = req.headers['svix-signature'] as string;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing svix headers' });
    return;
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(JSON.stringify(req.body), {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as typeof event;
  } catch {
    res.status(400).json({ error: 'Invalid Clerk webhook signature' });
    return;
  }

  try {
    if (event.type === 'user.created') {
      const data = event.data as {
        id: string;
        email_addresses: Array<{ email_address: string }>;
        first_name?: string;
        last_name?: string;
      };

      const email = data.email_addresses[0]?.email_address ?? '';
      const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || null;

      const upsertedUser = await prisma.user.upsert({
        where: { id: data.id },
        create: {
          id: data.id,
          email,
          name,
          plan: 'free',
          referralCode: generateReferralCode(),
          portfolio: { create: { holdings: [] } },
          watchlist: { create: { tickers: [] } },
        },
        update: { email, name },
        select: { referralCode: true },
      });

      // Fire-and-forget welcome email — Clerk fires user.created exactly once per user
      sendWelcomeEmail(email, name ?? 'there', upsertedUser.referralCode ?? '').catch((err) => {
        logger.warn('Welcome email failed (non-fatal)', { userId: data.id, error: String(err) });
      });

      logger.info('User synced from Clerk', { userId: data.id, email });
    }

    if (event.type === 'user.deleted') {
      const data = event.data as { id: string };
      await prisma.user.delete({ where: { id: data.id } }).catch(() => null);
      logger.info('User deleted via Clerk webhook', { userId: data.id });
    }

    res.json({ received: true });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Clerk webhook error', { error: error.message, type: event.type });
    res.json({ received: true });
  }
});

// ─── Telegram Bot Webhook ──────────────────────────────────────────────────────
router.post('/telegram', async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (webhookSecret) {
    const incoming = req.headers['x-telegram-bot-api-secret-token'];
    if (incoming !== webhookSecret) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
  }

  // Always respond 200 immediately — Telegram will retry on non-200
  res.json({ ok: true });

  try {
    const update = req.body as {
      message?: {
        chat: { id: number };
        text?: string;
        from?: { first_name?: string; username?: string };
      };
    };

    const message = update.message;
    if (!message?.text) return;

    const chatId = message.chat.id;
    const text = message.text.trim();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;

    async function reply(msg: string) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
      });
    }

    // Handle /start TOKEN — connect user account
    if (text.startsWith('/start ')) {
      const connectToken = text.slice(7).trim().toUpperCase();
      const redisKey = `tg:connect:${connectToken}`;
      const userId = await redis.get(redisKey);

      if (!userId) {
        await reply('❌ This link has expired or is invalid. Please generate a new one from AlphaWeek settings.');
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: { telegramChatId: String(chatId) },
      });

      await redis.del(redisKey);

      const firstName = message.from?.first_name ?? 'there';
      await reply(`✅ *Connected!* Hi ${firstName}, your AlphaWeek account is now linked to Telegram. You'll receive your weekly brief here every Monday. 📊`);

      logger.info('Telegram connected via bot', { userId, chatId });
      return;
    }

    if (text === '/start') {
      await reply('👋 *Welcome to AlphaWeek!*\n\nTo connect your account, go to *Settings → Telegram Delivery* in the AlphaWeek app and click *Connect Telegram*. You\'ll get a personalised link.');
      return;
    }

    if (text === '/stop' || text === '/disconnect') {
      await prisma.user.updateMany({
        where: { telegramChatId: String(chatId) },
        data: { telegramChatId: null },
      });
      await reply('✅ Disconnected. You will no longer receive AlphaWeek briefs on Telegram. Reconnect anytime via Settings.');
      return;
    }

    await reply('📈 *AlphaWeek* — AI Investment Intelligence\n\nCommands:\n• /start — connect your account\n• /stop — disconnect Telegram\n\nManage your preferences at alphaweek.io');
  } catch (err) {
    logger.error('Telegram webhook error', { error: String(err) });
  }
});

export default router;
