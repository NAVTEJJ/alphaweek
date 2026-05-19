import cron from 'node-cron';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { enqueueBriefJob } from './briefQueue';
import { createBriefRecord, getCurrentWeekOf } from '../services/briefService';
import { refreshSampleBrief } from '../services/sampleBriefService';
import { startBriefWorker } from './briefWorker';
import { logger } from '../utils/logger';

// Lock TTL is intentionally shorter than the cron interval so the lock
// self-expires before the next scheduled run if the process dies mid-job.
const DAILY_LOCK_KEY = 'lock:daily-scheduler';
const WEEKLY_LOCK_KEY = 'lock:weekly-scheduler';
const LOCK_TTL_S = 50 * 60; // 50 minutes — daily fires at 11:30 UTC, weekly at 12:00 UTC

// Scheduler throughput knobs:
// - PAGE_SIZE: users fetched per Prisma round-trip
// - ENQUEUE_CONCURRENCY: how many enqueue ops run in parallel per page
// Tuned so a 10K-user run finishes in ~30s of scheduler work (the long pole
// is then the BullMQ worker pool, not the enqueue path).
const PAGE_SIZE = 200;
const ENQUEUE_CONCURRENCY = 25;

function getTodayISO(): string {
  return new Date().toISOString().split('T')[0];
}

type BriefType = 'weekly' | 'daily';

// Process one page of users:
//   1) Single SQL query for existing briefs of these users on this week/date.
//   2) Filter out users who already have a brief.
//   3) Fan out createBriefRecord + enqueueBriefJob in parallel chunks of
//      ENQUEUE_CONCURRENCY so we don't open thousands of DB connections at once.
async function processUserPage(
  users: { id: string; plan: string }[],
  weekOf: string,
  briefType: BriefType
): Promise<{ enqueued: number; skipped: number; failed: number }> {
  if (users.length === 0) return { enqueued: 0, skipped: 0, failed: 0 };

  const weekDate = new Date(weekOf);
  const existingBriefs = await prisma.brief.findMany({
    where: {
      userId: { in: users.map((u) => u.id) },
      weekOf: weekDate,
      status: { in: ['pending', 'generating', 'completed'] },
    },
    select: { userId: true },
  });
  const existingUserIds = new Set(existingBriefs.map((b) => b.userId));

  const pending = users.filter((u) => !existingUserIds.has(u.id));
  const skipped = users.length - pending.length;

  let enqueued = 0;
  let failed = 0;

  for (let i = 0; i < pending.length; i += ENQUEUE_CONCURRENCY) {
    const chunk = pending.slice(i, i + ENQUEUE_CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map(async (user) => {
        const briefId = await createBriefRecord(user.id, weekOf, user.plan);
        await enqueueBriefJob({
          userId: user.id,
          weekOf,
          plan: user.plan,
          briefId,
          ...(briefType === 'daily' ? { briefType: 'daily' as const } : {}),
        });
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') enqueued++;
      else {
        failed++;
        logger.error('Failed to enqueue brief for user', { error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
      }
    }
  }

  return { enqueued, skipped, failed };
}

async function enqueueAllBriefs(
  briefType: BriefType,
  weekOf: string,
  lockKey: string
): Promise<void> {
  const lockAcquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_S, 'NX');
  if (!lockAcquired) {
    logger.debug(`${briefType} scheduler: skipped (lock held by another instance)`);
    return;
  }

  logger.info(`${briefType} scheduler: starting brief enqueue run`, { weekOf, pageSize: PAGE_SIZE });

  try {
    let cursor: string | undefined;
    let totalUsers = 0;
    let totalEnqueued = 0;
    let totalSkipped = 0;
    let totalFailed = 0;
    let pageNum = 0;

    while (true) {
      pageNum++;
      const page = await prisma.user.findMany({
        select: { id: true, plan: true },
        take: PAGE_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: 'asc' },
      });

      if (page.length === 0) break;

      const { enqueued, skipped, failed } = await processUserPage(page, weekOf, briefType);
      totalUsers += page.length;
      totalEnqueued += enqueued;
      totalSkipped += skipped;
      totalFailed += failed;

      logger.debug(`${briefType} scheduler: page ${pageNum}`, {
        size: page.length,
        enqueued,
        skipped,
        failed,
      });

      cursor = page[page.length - 1].id;
      if (page.length < PAGE_SIZE) break;
    }

    logger.info(`${briefType} scheduler: enqueue run complete`, {
      weekOf,
      total: totalUsers,
      enqueued: totalEnqueued,
      skipped: totalSkipped,
      failed: totalFailed,
      pages: pageNum,
    });
  } finally {
    await redis.del(lockKey);
  }
}

export async function startWeeklyScheduler(): Promise<void> {
  startBriefWorker();

  // Every Monday at 12:00 UTC (7:00 AM ET) — weekly deep-dive lands before US market open
  cron.schedule('0 12 * * 1', () => {
    enqueueAllBriefs('weekly', getCurrentWeekOf(), WEEKLY_LOCK_KEY).catch((err) => {
      logger.error('Weekly scheduler run failed', { error: err instanceof Error ? err.message : String(err) });
    });
    // Refresh the public sample brief in parallel so it's always dated this week.
    refreshSampleBrief().catch((err) => {
      logger.warn('Sample brief refresh failed', { error: err instanceof Error ? err.message : String(err) });
    });
  }, { timezone: 'UTC' });

  // Mon–Fri at 11:30 UTC (6:30 AM ET) — daily micro-briefs before market open
  cron.schedule('30 11 * * 1-5', () => {
    enqueueAllBriefs('daily', getTodayISO(), DAILY_LOCK_KEY).catch((err) => {
      logger.error('Daily scheduler run failed', { error: err instanceof Error ? err.message : String(err) });
    });
  }, { timezone: 'UTC' });

  logger.info('Schedulers registered (Weekly: Mon 12:00 UTC / 7:00 AM ET | Daily: Mon–Fri 11:30 UTC / 6:30 AM ET | distributed lock protected, paginated, parallel)');
}
