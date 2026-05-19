import { Router, Response } from 'express';
import { getYF } from '../utils/yahooFinance';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import { cacheGet, cacheSet, CACHE_TTL } from '../../config/redis';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth as never);
router.use(apiRateLimit);

// Preset screens available to the user
const PRESET_SCREENS = [
  'most_actives',
  'day_gainers',
  'day_losers',
  'undervalued_growth_stocks',
  'growth_technology_stocks',
  'aggressive_small_caps',
  'undervalued_large_caps',
  'strong_undervalued_stocks',
] as const;

type PresetScreen = typeof PRESET_SCREENS[number];

interface ScreenerResult {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  peRatio: number | null;
  sector: string | null;
  analystRating: string | null;
}

const RATING_MAP: Record<string, string> = {
  strongBuy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strongSell: 'Strong Sell',
};

async function runScreen(scrId: PresetScreen, count: number): Promise<ScreenerResult[]> {
  const cacheKey = `screener:${scrId}:${count}`;
  const cached = await cacheGet<ScreenerResult[]>(cacheKey);
  if (cached) return cached;

  const yahooFinance = await getYF();
  const raw = await yahooFinance.screener(
    { scrIds: scrId, count },
    { validateResult: false }
  ) as {
    quotes?: {
      symbol?: string;
      shortName?: string;
      longName?: string;
      regularMarketPrice?: number;
      regularMarketChange?: number;
      regularMarketChangePercent?: number;
      regularMarketVolume?: number;
      marketCap?: number;
      trailingPE?: number;
      sector?: string;
      averageAnalystRating?: string;
    }[];
  };

  const results: ScreenerResult[] = (raw.quotes ?? []).map((q) => ({
    ticker: q.symbol ?? '',
    name: q.shortName ?? q.longName ?? q.symbol ?? '',
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
    volume: q.regularMarketVolume ?? 0,
    marketCap: q.marketCap ?? null,
    peRatio: q.trailingPE ?? null,
    sector: q.sector ?? null,
    analystRating: q.averageAnalystRating
      ? (RATING_MAP[q.averageAnalystRating] ?? q.averageAnalystRating)
      : null,
  })).filter((r) => r.ticker);

  await cacheSet(cacheKey, results, CACHE_TTL.MARKET_DATA);
  return results;
}

// GET /screener?screen=day_gainers&minPrice=5&maxPE=50&limit=25
router.get(
  '/',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      screen = 'most_actives',
      minPrice,
      maxPrice,
      maxPE,
      minMarketCap,
      limit = '25',
    } = req.query as Record<string, string>;

    if (!PRESET_SCREENS.includes(screen as PresetScreen)) {
      res.status(400).json({
        error: `Invalid screen. Valid options: ${PRESET_SCREENS.join(', ')}`,
        code: 'INVALID_SCREEN',
      });
      return;
    }

    const count = Math.min(parseInt(limit, 10) || 25, 50);

    try {
      let results = await runScreen(screen as PresetScreen, 50);

      // Apply optional filters
      if (minPrice) results = results.filter((r) => r.price >= parseFloat(minPrice));
      if (maxPrice) results = results.filter((r) => r.price <= parseFloat(maxPrice));
      if (maxPE) results = results.filter((r) => r.peRatio !== null && r.peRatio <= parseFloat(maxPE));
      if (minMarketCap) results = results.filter((r) => r.marketCap !== null && r.marketCap >= parseFloat(minMarketCap));

      res.json({
        data: {
          screen,
          count: results.slice(0, count).length,
          results: results.slice(0, count),
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Screener failed', { screen, error: error.message });
      res.status(500).json({ error: 'Failed to run screener', code: 'SCREENER_ERROR' });
    }
  }
);

// GET /screener/presets — list available presets
router.get(
  '/presets',
  (_req: AuthenticatedRequest, res: Response): void => {
    res.json({
      data: PRESET_SCREENS.map((id) => ({
        id,
        label: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      })),
    });
  }
);

export default router;
