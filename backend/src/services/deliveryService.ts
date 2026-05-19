import { Resend } from 'resend';
import webpush from 'web-push';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { withRetry } from '../utils/retryHelper';
import { logger } from '../utils/logger';
import { isEmailUnsubscribed, makeUnsubscribeToken } from '../utils/emailSubscription';

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── VAPID setup for web push ─────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL ?? 'mailto:hello@alphaweek.io',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// ─── Subject line generator ───────────────────────────────────────────────────
// Picks the headline percentage from the brief's opening section (the
// narrative paragraph), NOT the first % anywhere — the latter would cherry-pick
// a FII flow or sector stat over the actual market headline.
function buildSubjectLine(content: string, briefType: 'weekly' | 'daily', _plan: string): string {
  // Grab text under the first ## heading, up to the second heading or 600 chars
  const firstSection = content.match(/^##[^\n]*\n+([\s\S]{0,600}?)(?=\n##|$)/m);
  const opening = firstSection?.[1] ?? content.slice(0, 600);
  const pctMatch = opening.match(/([+-]?\d+\.?\d*%)/);
  const pct = pctMatch?.[1];

  if (briefType === 'daily') {
    const day = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    return pct
      ? `Markets ${pct.startsWith('-') ? 'fell' : 'rose'} ${pct} — your morning pulse (${day})`
      : `Your morning market pulse — ${day}`;
  }

  return pct
    ? `${pct} week — your AlphaWeek brief is ready`
    : 'Your weekly AlphaWeek brief is ready';
}

// ─── Email HTML builder (teaser approach) ────────────────────────────────────
// Shows first ~3 sections of content; drives app engagement over reading in email.
function buildEmailHtml(
  content: string,
  briefId: string,
  userName: string,
  weekOf: string,
  _plan: string,
  briefType: 'weekly' | 'daily',
  unsubUrl: string = ''
): string {
  // Extract teaser: first 2 sections (split on ## headings)
  const sections = content.split(/^## /m);
  const teaserRaw = sections.slice(0, 3).join('## ').trim();
  const isDaily = briefType === 'daily';

  const teaserHtml = teaserRaw
    .replace(/^## (.+)$/gm, '<h2 style="color:#1e40af;font-size:18px;margin:28px 0 10px;padding-bottom:6px;border-bottom:2px solid #e2e8f0;font-family:Inter,sans-serif;font-weight:700;">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="color:#334155;font-size:15px;font-weight:600;margin:16px 0 8px;font-family:Inter,sans-serif;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#1e293b;font-weight:600;">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;color:#334155;line-height:1.6;">$1</li>')
    .replace(/(<li[^>]*>.*?<\/li>\s*)+/gs, (m) => `<ul style="padding-left:20px;margin:10px 0;">${m}</ul>`)
    .replace(/\n\n/g, '</p><p style="color:#475569;line-height:1.75;margin-bottom:14px;">')
    .trim();

  const sectionCount = sections.length - 1;
  const remainingCount = Math.max(0, sectionCount - 2);

  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';

  const upgradeBlock = ''; // all features open to every user

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AlphaWeek Brief</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);padding:28px 40px;">
          <table width="100%"><tr>
            <td style="color:#ffffff;font-size:24px;font-weight:800;letter-spacing:-0.5px;font-family:Inter,sans-serif;">
              Alpha<span style="color:#fbbf24;">Week</span>
            </td>
            <td align="right">
              <span style="background:rgba(255,255,255,0.15);color:#bfdbfe;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;font-family:monospace;letter-spacing:0.5px;">
                ${isDaily ? 'DAILY BRIEF' : `WEEK OF ${weekOf.toUpperCase()}`}
              </span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Greeting -->
        <tr><td style="padding:28px 40px 4px;">
          <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;">
            Hi <strong>${userName}</strong>,<br>
            ${isDaily
              ? 'your morning market pulse is ready — 3-minute read.'
              : `your ${sectionCount}-section investment brief for the week is ready.`}
          </p>
        </td></tr>

        <!-- Brief content (teaser) -->
        <tr><td style="padding:8px 40px 0;">
          <p style="color:#475569;line-height:1.75;margin-bottom:14px;">${teaserHtml}</p>
        </td></tr>

        <!-- Continue reading CTA -->
        ${remainingCount > 0 ? `
        <tr><td style="padding:20px 40px 28px;">
          <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;width:100%;">
            <tr><td style="padding:18px 24px;">
              <p style="margin:0 0 12px;font-size:14px;color:#64748b;">
                <strong style="color:#334155;">${remainingCount} more section${remainingCount !== 1 ? 's' : ''}</strong> in your full brief — including sector breakdown, portfolio signals, and geo-political risk summary.
              </p>
              <a href="${appUrl}/briefs/${briefId}"
                 style="display:inline-block;background:#d97706;color:#ffffff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.2px;">
                Read full brief →
              </a>
              <a href="${appUrl}/briefs/${briefId}"
                 style="display:inline-block;margin-left:12px;color:#64748b;font-size:12px;text-decoration:underline;">Download PDF</a>
            </td></tr>
          </table>
        </td></tr>` : `
        <tr><td style="padding:20px 40px 28px;" align="center">
          <a href="${appUrl}/briefs/${briefId}"
             style="display:inline-block;background:#d97706;color:#ffffff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;">
            View in app + Download PDF →
          </a>
        </td></tr>`}

        <!-- Upgrade nudge (free/starter only) -->
        ${upgradeBlock}

        <!-- Disclaimer -->
        <tr><td style="padding:0 40px 24px;">
          <p style="color:#94a3b8;font-size:11px;line-height:1.5;background:#f8fafc;padding:10px 14px;border-radius:6px;border:1px solid #e2e8f0;margin:0;">
            AI-generated for informational purposes only. Not financial advice. Always conduct your own research before making investment decisions.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;">
          <table width="100%"><tr>
            <td style="color:#94a3b8;font-size:12px;">
              AlphaWeek · AI Investment Intelligence
            </td>
            <td align="right" style="font-size:12px;">
              <a href="${appUrl}/settings" style="color:#94a3b8;text-decoration:none;margin-left:16px;">Preferences</a>
              <a href="${unsubUrl || `${appUrl}/settings`}" style="color:#94a3b8;text-decoration:none;margin-left:16px;">Unsubscribe</a>
            </td>
          </tr></table>
        </td></tr>

      </table>

      <!-- Outside card note -->
      <table width="100%" style="max-width:640px;margin:12px auto 0;"><tr>
        <td style="text-align:center;color:#94a3b8;font-size:11px;">
          You're receiving this because you have an AlphaWeek account.
          <a href="${appUrl}/settings" style="color:#94a3b8;">Manage notifications</a>
        </td>
      </tr></table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Welcome email ────────────────────────────────────────────────────────────
function buildWelcomeEmailHtml(userName: string, referralCode: string): string {
  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';
  const greeting = userName && userName !== 'there' ? `Hi ${userName}` : 'Welcome';

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to AlphaWeek</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1e3a8a 0%,#1e40af 100%);padding:36px 40px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
            Alpha<span style="color:#fbbf24;">Week</span>
          </p>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:13px;">AI Investment Intelligence</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px 28px;">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1e293b;">${greeting} — you're in! 🎉</h1>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">
            Your AlphaWeek account is ready. Every Monday at 08:00 UTC, you'll receive a personalised AI brief covering the markets that matter to you.
          </p>

          <!-- 3 steps -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            ${[
              ['📊', 'Add your portfolio', 'Track your holdings and get personalised analysis in your brief.', `${appUrl}/portfolio`],
              ['📱', 'Connect Telegram', 'Receive your brief on Telegram the moment it\'s ready.', `${appUrl}/settings`],
              ['🚀', 'Explore the dashboard', 'Live market data, screener, AI chat, and more.', `${appUrl}/dashboard`],
            ].map(([icon, title, desc, link]) => `
              <tr><td style="padding:0 0 14px;">
                <table width="100%" cellpadding="0" cellspacing="0"
                       style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
                  <tr>
                    <td style="width:48px;padding:16px 0 16px 16px;vertical-align:top;font-size:22px;">${icon}</td>
                    <td style="padding:16px 16px 16px 10px;">
                      <p style="margin:0 0 3px;font-size:14px;font-weight:700;color:#1e293b;">${title}</p>
                      <p style="margin:0 0 8px;font-size:13px;color:#64748b;line-height:1.5;">${desc}</p>
                      <a href="${link}" style="font-size:12px;color:#1e40af;font-weight:600;text-decoration:none;">Get started →</a>
                    </td>
                  </tr>
                </table>
              </td></tr>
            `).join('')}
          </table>

          <!-- CTA -->
          <a href="${appUrl}/dashboard"
             style="display:block;text-align:center;background:#d97706;color:#ffffff;font-weight:700;font-size:15px;padding:15px 32px;border-radius:9px;text-decoration:none;letter-spacing:0.2px;">
            Go to your dashboard →
          </a>
        </td></tr>

        <!-- Referral -->
        <tr><td style="padding:0 40px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
            <tr><td style="padding:16px 20px;">
              <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#92400e;">
                🎁 Your referral code: <span style="font-family:monospace;letter-spacing:2px;color:#d97706;">${referralCode}</span>
              </p>
              <p style="margin:0;font-size:12px;color:#78350f;line-height:1.5;">
                Share it — you earn 1 free month for every paying subscriber you refer.
              </p>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:18px 40px;border-top:1px solid #e2e8f0;">
          <table width="100%"><tr>
            <td style="color:#94a3b8;font-size:12px;">AlphaWeek · AI Investment Intelligence</td>
            <td align="right">
              <a href="${appUrl}/settings" style="color:#94a3b8;font-size:12px;text-decoration:none;">Preferences</a>
            </td>
          </tr></table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Telegram builder ─────────────────────────────────────────────────────────
function buildTelegramMessage(content: string, briefId: string, weekOf: string, briefType: 'weekly' | 'daily'): string {
  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';
  const sections = content.split('\n## ');
  // Show intro + first section only on Telegram
  const teaser = sections.slice(0, 2).join('\n## ').trim();
  const truncated = teaser.length > 800 ? teaser.slice(0, 800) + '…' : teaser;
  const header = briefType === 'daily'
    ? `*AlphaWeek Daily Pulse — ${weekOf}*`
    : `*AlphaWeek Weekly Brief — ${weekOf}*`;

  return `${header}\n\n${truncated}\n\n[Read full brief + download PDF](${appUrl}/briefs/${briefId})`;
}

// ─── Web push notification (multi-device) ────────────────────────────────────
export async function sendPushNotification(userId: string, briefId: string, briefType: 'weekly' | 'daily'): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;

  // Read from the new multi-device list; fall back to the legacy single-key for
  // accounts that subscribed before the multi-device migration.
  const [subsList, legacyRaw] = await Promise.all([
    redis.lrange(`push:subs:${userId}`, 0, -1),
    redis.get(`push:sub:${userId}`),
  ]);
  const rawSubs = subsList.length > 0 ? subsList : (legacyRaw ? [legacyRaw] : []);
  if (rawSubs.length === 0) return;

  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';
  const payload = JSON.stringify({
    title: briefType === 'daily' ? '📊 Your morning market pulse is ready' : '📈 Your weekly brief is ready',
    body: 'Tap to read your personalised AI investment brief.',
    url: `${appUrl}/briefs/${briefId}`,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: `brief-${briefId}`,
  });

  for (const raw of rawSubs) {
    let subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    try {
      subscription = JSON.parse(raw) as typeof subscription;
    } catch {
      continue;
    }

    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: subscription.keys },
        payload,
        { TTL: 3600 }
      );
      logger.info('Push notification sent', { userId, briefId });
    } catch (err) {
      logger.warn('Push notification failed', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Remove stale subscription — 410 Gone means the browser unsubscribed
      if (err instanceof webpush.WebPushError && err.statusCode === 410) {
        if (subsList.length > 0) {
          await redis.lrem(`push:subs:${userId}`, 0, raw);
        } else {
          await redis.del(`push:sub:${userId}`);
        }
      }
    }
  }
}

// ─── Public delivery functions ────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, name: string | null, referralCode: string): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME ?? 'AlphaWeek'} <${process.env.RESEND_FROM_EMAIL ?? 'briefs@alphaweek.io'}>`,
      to: email,
      subject: '🎉 Welcome to AlphaWeek — your first brief arrives Monday',
      html: buildWelcomeEmailHtml(name ?? 'there', referralCode),
    });
    if (error) throw new Error(error.message);
    logger.info('Welcome email sent', { email });
  } catch (err) {
    logger.warn('Failed to send welcome email', {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function deliverByEmail(
  userId: string,
  userEmail: string,
  userName: string,
  briefId: string,
  content: string,
  weekOf: string,
  plan: string = 'free',
  briefType: 'weekly' | 'daily' = 'weekly'
): Promise<void> {
  if (await isEmailUnsubscribed(userId)) {
    logger.info('Skipping email — user is unsubscribed', { userId });
    return;
  }

  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';
  // The unsubscribe handler is hosted on the API so the link works even if
  // the marketing site is unreachable. API_PUBLIC_URL falls back to APP_URL
  // for single-domain dev setups.
  const apiUrl = process.env.API_PUBLIC_URL ?? appUrl;
  const unsubToken = makeUnsubscribeToken(userId);
  const unsubUrl = `${apiUrl}/unsubscribe?token=${unsubToken}`;

  await withRetry(
    async () => {
      const subject = buildSubjectLine(content, briefType, plan);

      const { error } = await resend.emails.send({
        from: `${process.env.RESEND_FROM_NAME ?? 'AlphaWeek'} <${process.env.RESEND_FROM_EMAIL ?? 'briefs@alphaweek.io'}>`,
        to: userEmail,
        subject,
        html: buildEmailHtml(content, briefId, userName, weekOf, plan, briefType, unsubUrl),
        // RFC 2369 / 8058 unsubscribe headers — Gmail/Outlook surface a
        // one-click "Unsubscribe" link in the UI and reduce spam risk.
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@alphaweek.io?subject=unsubscribe-${userId}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      if (error) throw new Error(`Resend error: ${error.message}`);

      await prisma.alert.create({
        data: {
          userId,
          type: 'system',
          message: `Your ${briefType} brief has been delivered to ${userEmail}.`,
        },
      });

      logger.info('Email delivered', { userId, briefId, email: userEmail, briefType });
    },
    'deliverByEmail',
    { maxAttempts: 3, delayMs: 2000 }
  );
}

export async function deliverByTelegram(
  userId: string,
  chatId: string,
  briefId: string,
  content: string,
  weekOf: string,
  briefType: 'weekly' | 'daily' = 'weekly'
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.warn('Telegram bot token not configured, skipping Telegram delivery');
    return;
  }

  await withRetry(
    async () => {
      const message = buildTelegramMessage(content, briefId, weekOf, briefType);

      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        }),
      });

      if (!response.ok) {
        const err = await response.json() as { description: string };
        throw new Error(`Telegram API error: ${err.description}`);
      }

      logger.info('Telegram message delivered', { userId, briefId, chatId, briefType });
    },
    'deliverByTelegram',
    { maxAttempts: 3, delayMs: 2000 }
  );
}

export async function notifyBriefFailure(userId: string, userEmail: string, weekOf: string): Promise<void> {
  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';

  try {
    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME ?? 'AlphaWeek'} <${process.env.RESEND_FROM_EMAIL ?? 'briefs@alphaweek.io'}>`,
      to: userEmail,
      subject: 'Your AlphaWeek brief is delayed — we\'re on it',
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:32px 16px;background:#f1f5f9;font-family:Inter,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:36px 40px;box-shadow:0 2px 8px rgba(0,0,0,0.07);">
    <tr><td>
      <p style="margin:0 0 6px;font-size:22px;font-weight:800;color:#1e293b;">Alpha<span style="color:#f59e0b;">Week</span></p>
      <h2 style="margin:20px 0 12px;font-size:18px;color:#dc2626;">Brief generation delayed</h2>
      <p style="color:#475569;line-height:1.7;margin:0 0 16px;">Hi there — we hit a snag generating your brief for <strong>week of ${weekOf}</strong>. Our systems have been notified and we're retrying automatically.</p>
      <p style="color:#475569;line-height:1.7;margin:0 0 24px;">You'll receive your brief as soon as it's ready, usually within the hour. We're sorry for the delay.</p>
      <a href="${appUrl}/briefs" style="display:inline-block;background:#1e40af;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;">Check brief status →</a>
      <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">— The AlphaWeek Team</p>
    </td></tr>
  </table>
</body></html>`,
    });

    await prisma.alert.create({
      data: {
        userId,
        type: 'brief_failed',
        message: `Your brief for week of ${weekOf} was delayed. We're working on it.`,
      },
    });
  } catch (err) {
    logger.error('Failed to send failure notification', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
