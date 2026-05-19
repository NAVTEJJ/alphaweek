import { Router, Response } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../../config/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import { validate } from '../utils/validator';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth as never);
router.use(apiRateLimit);

const PLAN_ALERT_LIMITS: Record<string, number> = {
  free: Infinity,
  starter: Infinity,
  pro: Infinity,
  elite: Infinity,
  whitelabel: Infinity,
};

// GET /alerts/price — list user's price alerts
router.get('/price', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.priceAlert.findMany({
      where: { userId: req.user.id },
      orderBy: [{ triggered: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ data: alerts });
  } catch (err) {
    logger.error('GET /alerts/price error', { error: String(err) });
    res.status(500).json({ error: 'Failed to fetch price alerts', code: 'INTERNAL_ERROR' });
  }
});

// POST /alerts/price — create price alert
router.post(
  '/price',
  validate([
    body('ticker').isString().trim().isLength({ min: 1, max: 10 }).toUpperCase(),
    body('exchange').isIn(['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO']),
    body('targetPrice').isFloat({ min: 0.001 }),
    body('direction').isIn(['above', 'below']),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { ticker, exchange, targetPrice, direction } = req.body;
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { plan: true },
      });

      if (!user) {
        res.status(404).json({ error: 'User not found', code: 'USER_NOT_FOUND' });
        return;
      }

      const limit = PLAN_ALERT_LIMITS[user.plan] ?? 0;
      if (limit === 0) {
        res.status(403).json({ error: 'Price alerts require Pro plan or higher', code: 'PLAN_REQUIRED' });
        return;
      }

      if (limit !== Infinity) {
        const count = await prisma.priceAlert.count({
          where: { userId: req.user.id, triggered: false },
        });
        if (count >= limit) {
          res.status(403).json({
            error: `Your plan allows up to ${limit} active price alerts. Delete one to add another.`,
            code: 'ALERT_LIMIT_REACHED',
          });
          return;
        }
      }

      const alert = await prisma.priceAlert.create({
        data: {
          userId: req.user.id,
          ticker: ticker.toUpperCase(),
          exchange,
          targetPrice: parseFloat(targetPrice),
          direction,
        },
      });

      res.status(201).json({ data: alert });
    } catch (err) {
      logger.error('POST /alerts/price error', { error: String(err) });
      res.status(500).json({ error: 'Failed to create price alert', code: 'INTERNAL_ERROR' });
    }
  }
);

// DELETE /alerts/price/:id — delete a price alert
router.delete(
  '/price/:id',
  validate([param('id').isString().trim().isLength({ min: 1 })]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const alert = await prisma.priceAlert.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });

      if (!alert || alert.userId !== req.user.id) {
        res.status(404).json({ error: 'Price alert not found', code: 'NOT_FOUND' });
        return;
      }

      await prisma.priceAlert.delete({ where: { id: req.params.id } });
      res.json({ data: { deleted: true } });
    } catch (err) {
      logger.error('DELETE /alerts/price error', { error: String(err) });
      res.status(500).json({ error: 'Failed to delete price alert', code: 'INTERNAL_ERROR' });
    }
  }
);

// GET /alerts/system — list user's system/notification alerts
router.get('/system', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const alerts = await prisma.alert.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ data: alerts });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts', code: 'INTERNAL_ERROR' });
  }
});

// PATCH /alerts/system/:id/read — mark alert as read
router.patch(
  '/system/:id/read',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const alert = await prisma.alert.findUnique({
        where: { id: req.params.id },
        select: { userId: true },
      });
      if (!alert || alert.userId !== req.user.id) {
        res.status(404).json({ error: 'Alert not found', code: 'NOT_FOUND' });
        return;
      }
      await prisma.alert.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
      res.json({ data: { read: true } });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark alert read', code: 'INTERNAL_ERROR' });
    }
  }
);

export default router;
