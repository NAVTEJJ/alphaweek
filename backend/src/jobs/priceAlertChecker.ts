import cron from 'node-cron';
import { checkPriceAlerts, AlertScope } from '../services/priceAlertService';
import { redis } from '../../config/redis';
import { logger } from '../utils/logger';

// Three separate schedules, one per asset class, so each set of alerts is
// polled while its own market is liquid:
//   US:     14:00–21:00 UTC Mon–Fri (09:30–16:00 ET regular session)
//   INDIA:  03:30–10:00 UTC Mon–Fri (09:00–15:30 IST)
//   CRYPTO: 24/7, every 5 minutes (crypto never closes)
// Distributed locks per scope prevent duplicate runs across instances.
const SCHEDULES: { scope: AlertScope; cron: string; intervalSeconds: number }[] = [
  { scope: 'US',     cron: '*/15 14-21 * * 1-5', intervalSeconds: 15 * 60 },
  { scope: 'INDIA',  cron: '*/15 3-10 * * 1-5',  intervalSeconds: 15 * 60 },
  { scope: 'CRYPTO', cron: '*/5 * * * *',        intervalSeconds: 5 * 60 },
];

function lockKey(scope: AlertScope): string {
  return `lock:price-alert-checker:${scope.toLowerCase()}`;
}

async function runScope(scope: AlertScope, intervalSeconds: number): Promise<void> {
  // TTL just under the cron interval — auto-expires if a worker dies mid-run.
  const lockTtl = Math.max(60, intervalSeconds - 30);
  const acquired = await redis.set(lockKey(scope), '1', 'EX', lockTtl, 'NX');
  if (acquired !== 'OK') {
    logger.debug(`Price alert checker [${scope}]: skipped — lock held`);
    return;
  }

  logger.info(`Price alert checker [${scope}]: running`);
  try {
    await checkPriceAlerts(scope);
  } catch (err) {
    logger.error(`Price alert checker [${scope}]: unhandled error`, { error: String(err) });
  } finally {
    await redis.del(lockKey(scope));
  }
}

export function startPriceAlertChecker(): void {
  for (const { scope, cron: expr, intervalSeconds } of SCHEDULES) {
    cron.schedule(expr, () => { void runScope(scope, intervalSeconds); }, { timezone: 'UTC' });
    logger.info(`Price alert checker registered: ${scope} on '${expr}' UTC`);
  }
}
