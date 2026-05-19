import { Router, Request, Response } from 'express';
import { getYF } from '../utils/yahooFinance';
import { getMarketSnapshot, getTickerDetail, searchTickers, PriceRange } from '../services/stockService';
import { publicRateLimit } from '../middleware/rateLimit';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import { logger } from '../utils/logger';
import { prisma } from '../../config/db';
import { cacheGet, cacheSet } from '../../config/redis';

const EARNINGS_CACHE_TTL = 6 * 3600; // 6 hours

const router = Router();

// GET /market/snapshot — public, cached
router.get('/snapshot', publicRateLimit, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await getMarketSnapshot();
    res.json({ data: snapshot });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Market snapshot error', { error: error.message });
    res.status(503).json({ error: 'Market data temporarily unavailable', code: 'MARKET_UNAVAILABLE' });
  }
});

// GET /market/earnings — upcoming earnings for user's portfolio + watchlist tickers
router.get('/earnings', requireAuth as never, apiRateLimit, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const earningsCacheKey = `earnings:${req.user.id}`;
  const cached = await cacheGet<unknown[]>(earningsCacheKey);
  if (cached) {
    res.json({ data: cached });
    return;
  }

  try {
    const [portfolio, watchlist] = await Promise.all([
      prisma.portfolio.findUnique({ where: { userId: req.user.id }, select: { holdings: true } }),
      prisma.watchlist.findUnique({ where: { userId: req.user.id }, select: { tickers: true } }),
    ]);

    const holdingTickers = (Array.isArray(portfolio?.holdings) ? portfolio!.holdings as { ticker: string; exchange: string }[] : [])
      .map((h) => {
        if (h.exchange === 'NSE') return `${h.ticker}.NS`;
        if (h.exchange === 'BSE') return `${h.ticker}.BO`;
        if (h.exchange === 'CRYPTO') return null; // crypto doesn't have earnings
        return h.ticker;
      })
      .filter(Boolean) as string[];

    const watchlistTickers = (watchlist?.tickers ?? []).filter((t) => !t.includes('-'));

    const allTickers = [...new Set([...holdingTickers, ...watchlistTickers])].slice(0, 30);

    if (allTickers.length === 0) {
      await cacheSet(earningsCacheKey, [], 3600).catch(() => null);
      res.json({ data: [] });
      return;
    }

    const yahooFinance = await getYF();
    const results = await Promise.allSettled(
      allTickers.map(async (ticker) => {
        const summary = await yahooFinance.quoteSummary(ticker, {
          modules: ['calendarEvents', 'price'],
        }) as {
          calendarEvents?: { earnings?: { earningsDate?: Date[] } };
          price?: { shortName?: string };
        };
        const earnings = summary.calendarEvents?.earnings;
        const earningsDate = earnings?.earningsDate?.[0];
        if (!earningsDate) return null;

        const price = summary.price;
        return {
          ticker: ticker.replace('.NS', '').replace('.BO', ''),
          name: price?.shortName ?? ticker,
          earningsDate: earningsDate.toISOString(),
          earningsDateEnd: earnings?.earningsDate?.[1]?.toISOString() ?? null,
        };
      })
    );

    const earnings = results
      .filter((r): r is PromiseFulfilledResult<NonNullable<{
        ticker: string; name: string; earningsDate: string; earningsDateEnd: string | null;
      }>> => r.status === 'fulfilled' && r.value !== null)
      .map((r) => r.value)
      .filter((e) => new Date(e.earningsDate) >= new Date())
      .sort((a, b) => new Date(a.earningsDate).getTime() - new Date(b.earningsDate).getTime());

    await cacheSet(earningsCacheKey, earnings, EARNINGS_CACHE_TTL).catch(() => null);
    res.json({ data: earnings });
  } catch (err) {
    logger.error('Earnings calendar error', { error: String(err) });
    res.status(503).json({ error: 'Earnings data temporarily unavailable', code: 'EARNINGS_UNAVAILABLE' });
  }
});

// GET /market/search?q=apple
// Ticker autocomplete via Yahoo's public search endpoint. Used by the frontend
// to give a real "type to find" UX on the add-holding / set-alert forms.
router.get(
  '/search',
  requireAuth as never,
  apiRateLimit,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const q = ((req.query.q as string) || '').trim();
    if (!q || q.length > 32) {
      res.json({ data: [] });
      return;
    }
    try {
      const results = await searchTickers(q, 8);
      res.json({ data: results });
    } catch (err) {
      logger.warn('Ticker search error', { q, error: String(err) });
      res.json({ data: [] });
    }
  }
);

// GET /market/ticker/:symbol?exchange=NASDAQ&range=1M
// Deep ticker detail: price, fundamentals, analyst targets, history series,
// plus "your position" if the authenticated user holds this ticker.
const VALID_RANGES: PriceRange[] = ['1W', '1M', '3M', '1Y'];
const VALID_EXCHANGES = ['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO'];

router.get(
  '/ticker/:symbol',
  requireAuth as never,
  apiRateLimit,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const symbol = req.params.symbol.toUpperCase();
    const exchange = ((req.query.exchange as string) || 'NASDAQ').toUpperCase();
    const range = (req.query.range as PriceRange) || '1M';

    if (!/^[A-Z0-9.^-]{1,10}$/.test(symbol)) {
      res.status(400).json({ error: 'Invalid ticker', code: 'INVALID_TICKER' });
      return;
    }
    if (!VALID_EXCHANGES.includes(exchange)) {
      res.status(400).json({ error: 'Invalid exchange', code: 'INVALID_EXCHANGE' });
      return;
    }
    if (!VALID_RANGES.includes(range)) {
      res.status(400).json({ error: 'Invalid range', code: 'INVALID_RANGE' });
      return;
    }

    try {
      const [detail, portfolio, watchlist] = await Promise.all([
        getTickerDetail(symbol, exchange, range),
        prisma.portfolio.findUnique({
          where: { userId: req.user.id },
          select: { holdings: true },
        }),
        prisma.watchlist.findUnique({
          where: { userId: req.user.id },
          select: { tickers: true },
        }),
      ]);

      if (!detail) {
        res.status(404).json({ error: 'Ticker not found', code: 'TICKER_NOT_FOUND' });
        return;
      }

      // User context: do they hold this? Is it on their watchlist?
      const holdings = (portfolio?.holdings ?? []) as { ticker: string; exchange: string; quantity: number; avgBuyPrice: number }[];
      const matched = holdings.find((h) => h.ticker === symbol && h.exchange === exchange);
      const inWatchlist = (watchlist?.tickers ?? []).includes(symbol);

      let userPosition: {
        quantity: number;
        avgBuyPrice: number;
        currentValue: number;
        costBasis: number;
        pnL: number;
        pnLPercent: number;
      } | null = null;
      if (matched) {
        const currentValue = detail.price * matched.quantity;
        const costBasis = matched.avgBuyPrice * matched.quantity;
        const pnL = currentValue - costBasis;
        userPosition = {
          quantity: matched.quantity,
          avgBuyPrice: matched.avgBuyPrice,
          currentValue,
          costBasis,
          pnL,
          pnLPercent: costBasis > 0 ? (pnL / costBasis) * 100 : 0,
        };
      }

      res.json({
        data: {
          ...detail,
          inWatchlist,
          userPosition,
        },
      });
    } catch (err) {
      logger.error('Ticker detail error', { symbol, exchange, error: String(err) });
      res.status(503).json({ error: 'Ticker data temporarily unavailable', code: 'TICKER_UNAVAILABLE' });
    }
  }
);

export default router;
