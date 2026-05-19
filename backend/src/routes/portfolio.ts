import { Router, Response } from 'express';
import { body } from 'express-validator';
import { prisma } from '../../config/db';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validate, isValidTicker } from '../utils/validator';
import { apiRateLimit } from '../middleware/rateLimit';
import { PortfolioHolding } from '../types';
import { getEnrichedQuotes } from '../services/stockService';
import { buildLivePortfolio } from '../services/portfolioHealthService';
import portfolioImportRouter from './portfolioImport';

const router = Router();
router.use(requireAuth as never);
router.use(apiRateLimit);

// GET /portfolio
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: req.user.id },
    select: { id: true, holdings: true, updatedAt: true },
  });

  res.json({ data: portfolio ?? { holdings: [] } });
});

// PUT /portfolio — replace all holdings
router.put(
  '/',
  validate([
    body('holdings').isArray().withMessage('Holdings must be an array'),
    body('holdings.*.ticker').isString().custom((val: string) => {
      if (!isValidTicker(val)) throw new Error(`Invalid ticker: ${val}`);
      return true;
    }),
    body('holdings.*.quantity').isFloat({ min: 0.000001 }).withMessage('Quantity must be positive'),
    body('holdings.*.avgBuyPrice').isFloat({ min: 0.000001 }).withMessage('Average buy price must be positive'),
    body('holdings.*.exchange')
      .isIn(['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO'])
      .withMessage('Invalid exchange'),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { holdings } = req.body as { holdings: PortfolioHolding[] };
    try {
      const portfolio = await prisma.portfolio.update({
        where: { userId: req.user.id },
        data: { holdings: holdings as never },
        select: { id: true, holdings: true, updatedAt: true },
      });

      res.json({ data: portfolio });
    } catch {
      res.status(500).json({ error: 'Failed to update portfolio', code: 'PORTFOLIO_UPDATE_ERROR' });
    }
  }
);

// GET /portfolio/live — real-time P&L, analyst data, health score
router.get(
  '/live',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const portfolio = await prisma.portfolio.findUnique({
        where: { userId: req.user.id },
        select: { holdings: true },
      });

      const rawHoldings = (portfolio?.holdings ?? []) as unknown as PortfolioHolding[];

      if (rawHoldings.length === 0) {
        res.json({
          data: {
            totalValue: 0,
            totalCost: 0,
            totalPnL: 0,
            totalPnLPercent: 0,
            dayChange: 0,
            dayChangePercent: 0,
            benchmarkDayChangePercent: null,
            health: {
              score: 0,
              grade: 'F',
              breakdown: {
                diversification: { score: 0, max: 35, label: 'No holdings' },
                concentration: { score: 0, max: 35, label: 'No holdings' },
                analystSentiment: { score: 0, max: 20, label: 'No data' },
                profitability: { score: 0, max: 10, label: 'No holdings' },
              },
              topRisk: 'Add holdings to track your portfolio health.',
            },
            holdings: [],
            sectorAllocation: {},
            lastUpdated: new Date().toISOString(),
          },
        });
        return;
      }

      // Build Yahoo Finance tickers for all holdings + SPY benchmark
      const toYahoo = (ticker: string, exchange: string): string => {
        if (exchange === 'NSE') return `${ticker}.NS`;
        if (exchange === 'BSE') return `${ticker}.BO`;
        if (exchange === 'CRYPTO') return `${ticker}-USD`;
        return ticker;
      };

      const holdingTickers = rawHoldings.map((h) => toYahoo(h.ticker, h.exchange));
      const allTickers = [...new Set([...holdingTickers, 'SPY'])];

      const quotes = await getEnrichedQuotes(allTickers);

      const spyQuote = quotes['SPY'];
      const spyDayChangePercent = spyQuote?.dayChangePercent ?? null;

      // Re-key quotes by Yahoo ticker so buildLivePortfolio can look them up
      const result = buildLivePortfolio(
        rawHoldings.map((h) => ({
          ticker: h.ticker,
          exchange: h.exchange,
          quantity: h.quantity,
          avgBuyPrice: h.avgBuyPrice,
        })),
        quotes,
        spyDayChangePercent
      );

      res.json({ data: result });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch live portfolio', code: 'LIVE_PORTFOLIO_ERROR' });
    }
  }
);

// GET /portfolio/watchlist
router.get(
  '/watchlist',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const watchlist = await prisma.watchlist.findUnique({
      where: { userId: req.user.id },
      select: { tickers: true, updatedAt: true },
    });

    res.json({ data: watchlist ?? { tickers: [] } });
  }
);

// PUT /portfolio/watchlist
router.put(
  '/watchlist',
  validate([
    body('tickers').isArray({ max: 50 }).withMessage('Max 50 tickers in watchlist'),
    body('tickers.*').isString().custom((val: string) => {
      if (!isValidTicker(val)) throw new Error(`Invalid ticker: ${val}`);
      return true;
    }),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { tickers } = req.body as { tickers: string[] };

    try {
      const watchlist = await prisma.watchlist.update({
        where: { userId: req.user.id },
        data: { tickers },
        select: { tickers: true, updatedAt: true },
      });

      res.json({ data: watchlist });
    } catch {
      res.status(500).json({ error: 'Failed to update watchlist', code: 'WATCHLIST_UPDATE_ERROR' });
    }
  }
);

router.use(portfolioImportRouter);

export default router;
