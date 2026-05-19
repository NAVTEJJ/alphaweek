import { prisma } from '../../config/db';
import { getStockPrices } from './stockService';

import { logger } from '../utils/logger';

function mapTickerForYahoo(ticker: string, exchange: string): string {
  if (exchange === 'NSE') return `${ticker}.NS`;
  if (exchange === 'BSE') return `${ticker}.BO`;
  if (exchange === 'CRYPTO') return `${ticker}-USD`;
  return ticker;
}

function buildPriceAlertEmail(
  ticker: string,
  targetPrice: number,
  currentPrice: number,
  direction: string,
  userName: string
): string {
  const appUrl = process.env.APP_URL ?? 'https://alphaweek.io';
  const arrow = direction === 'above' ? '↑' : '↓';
  const color = direction === 'above' ? '#16a34a' : '#dc2626';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#1e40af;padding:24px 40px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">Alpha<span style="color:#fbbf24;">Week</span> — Price Alert</span>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <p style="color:#334155;font-size:15px;margin:0 0 20px;">Hi ${userName},</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="color:#64748b;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;">Price Alert Triggered</p>
            <p style="color:#0f172a;font-size:32px;font-weight:800;font-family:monospace;margin:0;">${ticker}</p>
            <p style="color:${color};font-size:20px;font-weight:700;font-family:monospace;margin:8px 0;">${arrow} $${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p style="color:#64748b;font-size:13px;margin:0;">Your target: $${targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${direction === 'above' ? 'crossed above' : 'dropped below'})</p>
          </div>
          <p style="color:#64748b;font-size:13px;line-height:1.6;">
            This is an automated price alert from AlphaWeek. Your target has been reached — consider reviewing your position.
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 32px;" align="center">
          <a href="${appUrl}/alerts" style="display:inline-block;background:#d97706;color:#ffffff;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Manage Price Alerts
          </a>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 40px;border-top:1px solid #e2e8f0;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">AlphaWeek · Not financial advice · <a href="${appUrl}/settings" style="color:#94a3b8;">Manage preferences</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export type AlertScope = 'US' | 'INDIA' | 'CRYPTO' | 'ALL';

function exchangesForScope(scope: AlertScope): string[] | null {
  if (scope === 'US') return ['NASDAQ', 'NYSE'];
  if (scope === 'INDIA') return ['NSE', 'BSE'];
  if (scope === 'CRYPTO') return ['CRYPTO'];
  return null; // 'ALL' = no filter
}

// Scoped check so different asset classes can be polled on schedules that
// match their market hours: US 14-21 UTC, India 03-10 UTC, crypto 24/7.
export async function checkPriceAlerts(scope: AlertScope = 'ALL'): Promise<void> {
  const exchanges = exchangesForScope(scope);
  const activeAlerts = await prisma.priceAlert.findMany({
    where: {
      triggered: false,
      ...(exchanges ? { exchange: { in: exchanges as ('NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO')[] } } : {}),
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, telegramChatId: true },
      },
    },
  });

  if (activeAlerts.length === 0) return;

  // Build unique set of Yahoo tickers to fetch
  const yahooTickerMap = new Map<string, { ticker: string; exchange: string }>();
  for (const alert of activeAlerts) {
    const yahoo = mapTickerForYahoo(alert.ticker, alert.exchange);
    yahooTickerMap.set(yahoo, { ticker: alert.ticker, exchange: alert.exchange });
  }

  const yahooTickers = Array.from(yahooTickerMap.keys());
  let prices: Record<string, number> = {};

  try {
    prices = await getStockPrices(yahooTickers);
  } catch (err) {
    logger.error('Price alert check: failed to fetch prices', { error: String(err) });
    return;
  }

  const triggeredIds: string[] = [];

  for (const alert of activeAlerts) {
    const yahooTicker = mapTickerForYahoo(alert.ticker, alert.exchange);
    const currentPrice = prices[yahooTicker];
    if (currentPrice === undefined) continue;

    const isTriggered =
      (alert.direction === 'above' && currentPrice >= alert.targetPrice) ||
      (alert.direction === 'below' && currentPrice <= alert.targetPrice);

    if (!isTriggered) continue;

    triggeredIds.push(alert.id);
    const userName = alert.user.name ?? 'there';

    // Email notification
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: `${process.env.RESEND_FROM_NAME ?? 'AlphaWeek'} <${process.env.RESEND_FROM_EMAIL ?? 'alerts@alphaweek.io'}>`,
        to: alert.user.email,
        subject: `Price Alert: ${alert.ticker} ${alert.direction === 'above' ? '↑' : '↓'} $${alert.targetPrice}`,
        html: buildPriceAlertEmail(alert.ticker, alert.targetPrice, currentPrice, alert.direction, userName),
      });
    } catch (err) {
      logger.error('Price alert email failed', { alertId: alert.id, error: String(err) });
    }

    // Telegram notification
    if (alert.user.telegramChatId) {
      try {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (token) {
          const arrow = alert.direction === 'above' ? '⬆️' : '⬇️';
          const message = `*AlphaWeek Price Alert ${arrow}*\n\n*${alert.ticker}* is now at *$${currentPrice.toFixed(2)}*\nYour target: $${alert.targetPrice} (${alert.direction})\n\n[Manage alerts](${process.env.APP_URL ?? 'https://alphaweek.io'}/alerts)`;
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: alert.user.telegramChatId, text: message, parse_mode: 'Markdown' }),
          });
        }
      } catch (err) {
        logger.error('Price alert Telegram failed', { alertId: alert.id, error: String(err) });
      }
    }

    // System alert record
    await prisma.alert.create({
      data: {
        userId: alert.user.id,
        type: 'price_alert',
        message: `Price alert triggered: ${alert.ticker} reached $${currentPrice.toFixed(2)} (target: $${alert.targetPrice} ${alert.direction})`,
      },
    });

    logger.info('Price alert triggered', { alertId: alert.id, ticker: alert.ticker, currentPrice, targetPrice: alert.targetPrice });
  }

  // Batch-mark as triggered
  if (triggeredIds.length > 0) {
    await prisma.priceAlert.updateMany({
      where: { id: { in: triggeredIds } },
      data: { triggered: true, triggeredAt: new Date() },
    });
  }
}
