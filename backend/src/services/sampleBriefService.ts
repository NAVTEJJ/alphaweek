import { getMarketSnapshot } from './stockService';
import { getGeopoliticalEvents } from './newsService';
import { analyzePortfolio } from './portfolioService';
import { generateBrief } from './aiService';
import { parseBriefOutput } from '../utils/parseBriefOutput';
import { checkBrief, SANITY_FLAG_NOTE } from '../utils/briefSanityCheck';
import { cacheGet, cacheSet, redis } from '../../config/redis';
import { getCurrentWeekOf } from './briefService';
import { PortfolioHolding } from '../types';
import { logger } from '../utils/logger';

// Demo portfolio: US tech heavy + crypto + India. Shows off all three markets
// that make AlphaWeek unique. Buy prices are realistic trailing averages.
const DEMO_HOLDINGS: PortfolioHolding[] = [
  { ticker: 'AAPL',     quantity: 10,  avgBuyPrice: 178,   exchange: 'NASDAQ' },
  { ticker: 'NVDA',     quantity: 5,   avgBuyPrice: 495,   exchange: 'NASDAQ' },
  { ticker: 'MSFT',     quantity: 8,   avgBuyPrice: 385,   exchange: 'NASDAQ' },
  { ticker: 'GOOGL',    quantity: 6,   avgBuyPrice: 155,   exchange: 'NASDAQ' },
  { ticker: 'BTC-USD',  quantity: 0.1, avgBuyPrice: 68000, exchange: 'CRYPTO' },
  { ticker: 'RELIANCE', quantity: 50,  avgBuyPrice: 2850,  exchange: 'NSE'    },
];

const CACHE_KEY  = 'sample:brief:v1';
const LOCK_KEY   = 'lock:sample:brief';
const CACHE_TTL  = 7 * 24 * 3600; // 7 days — refresh every Monday via cron
const LOCK_TTL   = 180;            // 3 min max generation time

export interface SampleBrief {
  content: string;
  weekOf: string;
  mood: string | null;
  moodReason: string | null;
  briefSummary: string | null;
  closingQuestion: string | null;
  generatedAt: string;
  isDemo: true;
  demoPortfolio: { ticker: string; exchange: string; quantity: number }[];
}

export async function getSampleBrief(): Promise<SampleBrief | null> {
  const cached = await cacheGet<SampleBrief>(CACHE_KEY);
  if (cached) return cached;

  // Distributed lock — only one instance generates at a time.
  const lock = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
  if (!lock) {
    // Another process is generating — client should retry in ~60s.
    return null;
  }

  try {
    logger.info('Generating sample brief');

    const weekOf = getCurrentWeekOf();
    const [market, geoEvents, portfolio] = await Promise.all([
      getMarketSnapshot(),
      getGeopoliticalEvents().catch(() => []),
      analyzePortfolio(DEMO_HOLDINGS),
    ]);

    const briefResult = await generateBrief({ weekOf, market, geoEvents, portfolio, sentiment: undefined });
    const parsed      = parseBriefOutput(briefResult.content);
    const sanity      = checkBrief(parsed.cleanContent);
    const finalContent = sanity.flagged ? parsed.cleanContent + SANITY_FLAG_NOTE : parsed.cleanContent;

    const sample: SampleBrief = {
      content:         finalContent,
      weekOf,
      mood:            parsed.mood,
      moodReason:      parsed.moodReason,
      briefSummary:    parsed.briefSummary,
      closingQuestion: parsed.closingQuestion,
      generatedAt:     new Date().toISOString(),
      isDemo:          true,
      demoPortfolio:   DEMO_HOLDINGS.map((h) => ({ ticker: h.ticker, exchange: h.exchange, quantity: h.quantity })),
    };

    await cacheSet(CACHE_KEY, sample, CACHE_TTL);
    logger.info('Sample brief cached', { weekOf, mood: parsed.mood });
    return sample;
  } finally {
    await redis.del(LOCK_KEY);
  }
}

// Called by the weekly scheduler every Monday to keep the sample brief fresh.
export async function refreshSampleBrief(): Promise<void> {
  await redis.del(CACHE_KEY);
  const result = await getSampleBrief();
  if (!result) logger.warn('Sample brief refresh failed — lock contention');
}
