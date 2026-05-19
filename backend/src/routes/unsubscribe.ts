import { Router, Request, Response } from 'express';
import { publicRateLimit } from '../middleware/rateLimit';
import { verifyUnsubscribeToken, unsubscribeEmail } from '../utils/emailSubscription';
import { logger } from '../utils/logger';

const router = Router();

// Confirmation page sent on GET — required by RFC 8058 one-click flows.
// Mail clients (Gmail, Outlook) POST here directly when the user clicks the
// "Unsubscribe" link they surface in the message header.
async function handleUnsubscribe(req: Request, res: Response, method: 'GET' | 'POST'): Promise<void> {
  const token = (req.query.token ?? req.body?.token) as string | undefined;
  if (!token || typeof token !== 'string') {
    res.status(400).send('Missing or invalid unsubscribe token.');
    return;
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    res.status(400).send('Invalid or expired unsubscribe link.');
    return;
  }

  try {
    await unsubscribeEmail(userId);
    logger.info('User unsubscribed from emails', { userId, method });

    if (method === 'POST') {
      // RFC 8058 expects an empty 200 OK for one-click unsubscribe POSTs
      res.status(200).end();
      return;
    }

    // Friendly confirmation page for browser visits
    res.status(200).send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Unsubscribed</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{max-width:480px;background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;text-align:center}
h1{margin:0 0 12px;font-size:22px;color:#fff}
p{margin:0 0 8px;color:#94a3b8;line-height:1.6}
a{color:#fbbf24;text-decoration:none}</style></head>
<body><div class="card">
<h1>You're unsubscribed</h1>
<p>You won't receive any more brief emails from AlphaWeek at this address.</p>
<p>Changed your mind? <a href="${process.env.APP_URL ?? ''}/settings">Re-enable from Settings</a>.</p>
</div></body></html>`);
  } catch (err) {
    logger.error('Unsubscribe failed', { error: String(err) });
    res.status(500).send('Could not process unsubscribe. Please try again.');
  }
}

router.get('/', publicRateLimit, (req, res) => { void handleUnsubscribe(req, res, 'GET'); });
router.post('/', publicRateLimit, (req, res) => { void handleUnsubscribe(req, res, 'POST'); });

export default router;
