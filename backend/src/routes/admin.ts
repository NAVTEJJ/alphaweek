import { Router, Request, Response } from 'express';
import { prisma } from '../../config/db';
import { briefQueue } from '../jobs/briefQueue';
import { logger } from '../utils/logger';

const router = Router();

// Simple admin key auth — not exposed in public auth middleware
function requireAdminKey(req: Request, res: Response, next: () => void): void {
  const adminKey = process.env.ADMIN_API_KEY;
  const provided = req.headers['x-admin-key'];

  if (!adminKey || provided !== adminKey) {
    res.status(403).json({ error: 'Forbidden', code: 'ADMIN_FORBIDDEN' });
    return;
  }

  next();
}

router.use(requireAdminKey as never);

// GET /admin/stats — platform overview
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      planBreakdown,
      totalBriefs,
      briefs7d,
      failedBriefs,
      jobCounts,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['plan'], _count: { plan: true } }),
      prisma.brief.count(),
      prisma.brief.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
      prisma.brief.count({ where: { status: 'failed' } }),
      briefQueue.getJobCounts('active', 'waiting', 'completed', 'failed'),
    ]);

    const planMap: Record<string, number> = {};
    for (const row of planBreakdown) {
      planMap[row.plan] = row._count.plan;
    }

    res.json({
      data: {
        users: {
          total: totalUsers,
          byPlan: planMap,
          paid: (planMap.starter ?? 0) + (planMap.pro ?? 0) + (planMap.elite ?? 0) + (planMap.whitelabel ?? 0),
        },
        briefs: {
          total: totalBriefs,
          last7Days: briefs7d,
          failed: failedBriefs,
        },
        queue: jobCounts,
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Admin stats error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch stats', code: 'STATS_ERROR' });
  }
});

// GET /admin/users — recent users
router.get('/users', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string ?? '50', 10), 200);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      createdAt: true,
      subscription: { select: { status: true, renewedAt: true } },
    },
  });

  res.json({ data: users });
});

// GET /admin/queue — job queue status
router.get('/queue', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      briefQueue.getWaiting(),
      briefQueue.getActive(),
      briefQueue.getCompleted(0, 10),
      briefQueue.getFailed(0, 10),
      briefQueue.getDelayed(),
    ]);

    res.json({
      data: {
        waiting: waiting.length,
        active: active.length,
        delayed: delayed.length,
        recentCompleted: completed.map((j) => ({ id: j.id, name: j.name, completedOn: j.finishedOn })),
        recentFailed: failed.map((j) => ({ id: j.id, name: j.name, reason: j.failedReason })),
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Admin queue error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch queue status', code: 'QUEUE_STATUS_ERROR' });
  }
});

// POST /admin/briefs/generate — generate a brief for a user by email
router.post('/briefs/generate', async (req: Request, res: Response): Promise<void> => {
  const { email, userId: rawUserId } = req.body as { email?: string; userId?: string };

  let user: { id: string; plan: string } | null = null;

  if (rawUserId) {
    user = await prisma.user.findUnique({ where: { id: rawUserId }, select: { id: true, plan: true } });
  } else if (email) {
    user = await prisma.user.findUnique({ where: { email }, select: { id: true, plan: true } });
  }

  if (!user) {
    res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
    return;
  }

  const weekOf = new Date().toISOString().split('T')[0];

  const { enqueueBriefJob } = await import('../jobs/briefQueue');

  const brief = await prisma.brief.create({
    data: {
      userId: user.id,
      weekOf: new Date(weekOf),
      status: 'pending',
      content: '',
    },
  });

  await enqueueBriefJob({ userId: user.id, weekOf, plan: user.plan, briefId: brief.id });

  logger.info('Admin triggered brief generation', { userId: user.id, briefId: brief.id });
  res.json({ success: true, briefId: brief.id, weekOf, message: 'Brief queued — check /briefs in ~30s' });
});

// POST /admin/briefs/:id/retry — retry a failed brief
router.post('/briefs/:id/retry', async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  const brief = await prisma.brief.findUnique({
    where: { id },
    select: { id: true, userId: true, weekOf: true, status: true, user: { select: { plan: true } } },
  });

  if (!brief) {
    res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
    return;
  }

  if (brief.status !== 'failed') {
    res.status(400).json({ error: 'Can only retry failed briefs', code: 'INVALID_STATUS' });
    return;
  }

  const { enqueueBriefJob } = await import('../jobs/briefQueue');

  await prisma.brief.update({
    where: { id },
    data: { status: 'pending', errorMessage: null, failedAt: null },
  });

  await enqueueBriefJob({
    userId: brief.userId,
    weekOf: brief.weekOf.toISOString().split('T')[0],
    plan: brief.user.plan,
    briefId: brief.id,
  });

  logger.info('Admin retried brief', { briefId: id });
  res.json({ success: true, message: 'Brief requeued for generation' });
});

export default router;
