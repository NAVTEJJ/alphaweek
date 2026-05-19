import { EnrichedQuote } from './stockService';

export interface LiveHolding {
  ticker: string;
  name: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangeDollar: number;
  weight: number;
  analystRating: string | null;
  analystTargetPrice: number | null;
  analystUpside: number | null;
  analystCount: number;
  sector: string | null;
  marketCap: number | null;
  peRatio: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
}

export interface PortfolioHealthResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    diversification: { score: number; max: number; label: string };
    concentration: { score: number; max: number; label: string };
    analystSentiment: { score: number; max: number; label: string };
    profitability: { score: number; max: number; label: string };
  };
  topRisk: string;
}

export interface LivePortfolioResult {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  benchmarkDayChangePercent: number | null;
  health: PortfolioHealthResult;
  holdings: LiveHolding[];
  sectorAllocation: Record<string, number>;
  lastUpdated: string;
}

export function buildLivePortfolio(
  rawHoldings: { ticker: string; exchange: string; quantity: number; avgBuyPrice: number }[],
  quotes: Record<string, EnrichedQuote>,
  spyDayChangePercent: number | null
): LivePortfolioResult {
  let totalValue = 0;
  let totalCost = 0;
  let totalDayChangeDollar = 0;

  const holdings: LiveHolding[] = rawHoldings.map((h) => {
    const yahooTicker = toYahooTicker(h.ticker, h.exchange);
    const q = quotes[yahooTicker];

    const currentPrice = q?.price ?? h.avgBuyPrice;
    const currentValue = currentPrice * h.quantity;
    const costBasis = h.avgBuyPrice * h.quantity;
    const totalPnL = currentValue - costBasis;
    const totalPnLPercent = costBasis > 0 ? (totalPnL / costBasis) * 100 : 0;
    const dayChangeDollar = (q?.dayChange ?? 0) * h.quantity;
    const dayChangePercent = q?.dayChangePercent ?? 0;

    totalValue += currentValue;
    totalCost += costBasis;
    totalDayChangeDollar += dayChangeDollar;

    const analystTarget = q?.analystTargetPrice ?? null;
    const analystUpside =
      analystTarget && currentPrice > 0
        ? ((analystTarget - currentPrice) / currentPrice) * 100
        : null;

    return {
      ticker: h.ticker,
      name: q?.name ?? h.ticker,
      exchange: h.exchange,
      quantity: h.quantity,
      avgBuyPrice: h.avgBuyPrice,
      currentPrice,
      currentValue,
      costBasis,
      totalPnL,
      totalPnLPercent,
      dayChange: dayChangePercent,
      dayChangeDollar,
      weight: 0, // filled after totalValue is known
      analystRating: q?.analystRating ?? null,
      analystTargetPrice: analystTarget,
      analystUpside,
      analystCount: q?.analystCount ?? 0,
      sector: q?.sector ?? null,
      marketCap: q?.marketCap ?? null,
      peRatio: q?.peRatio ?? null,
      weekHigh52: q?.weekHigh52 ?? null,
      weekLow52: q?.weekLow52 ?? null,
    };
  });

  // Fill weights now that totalValue is known
  for (const h of holdings) {
    h.weight = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
  }

  // Sort by value descending
  holdings.sort((a, b) => b.currentValue - a.currentValue);

  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const dayChangePercent = totalValue > 0 ? (totalDayChangeDollar / totalValue) * 100 : 0;

  const sectorAllocation: Record<string, number> = {};
  for (const h of holdings) {
    const s = h.sector ?? 'Unknown';
    sectorAllocation[s] = (sectorAllocation[s] ?? 0) + h.weight;
  }

  return {
    totalValue,
    totalCost,
    totalPnL,
    totalPnLPercent,
    dayChange: totalDayChangeDollar,
    dayChangePercent,
    benchmarkDayChangePercent: spyDayChangePercent,
    health: computeHealthScore(holdings),
    holdings,
    sectorAllocation,
    lastUpdated: new Date().toISOString(),
  };
}

export function computeHealthScore(holdings: LiveHolding[]): PortfolioHealthResult {
  if (holdings.length === 0) {
    return {
      score: 0,
      grade: 'F',
      breakdown: {
        diversification: { score: 0, max: 35, label: 'No holdings' },
        concentration: { score: 0, max: 35, label: 'No holdings' },
        analystSentiment: { score: 0, max: 20, label: 'No data' },
        profitability: { score: 0, max: 10, label: 'No holdings' },
      },
      topRisk: 'Add holdings to track your portfolio health.',
    };
  }

  // ── Diversification (35 pts) ─────────────────────────────────────────────
  const n = holdings.length;
  const divScore = n >= 15 ? 35 : n >= 10 ? 28 : n >= 7 ? 20 : n >= 5 ? 12 : n >= 3 ? 6 : 2;
  const divLabel =
    n >= 15 ? 'Excellent' : n >= 10 ? 'Good' : n >= 7 ? 'Fair' : n >= 5 ? 'Concentrated' : 'Very concentrated';

  // ── Concentration risk (35 pts) ──────────────────────────────────────────
  const maxWeight = Math.max(...holdings.map((h) => h.weight));
  const concScore =
    maxWeight <= 10 ? 35 : maxWeight <= 15 ? 28 : maxWeight <= 20 ? 20 : maxWeight <= 30 ? 12 : maxWeight <= 40 ? 6 : 2;
  const concLabel =
    maxWeight <= 10
      ? 'Well balanced'
      : maxWeight <= 20
      ? `Largest position: ${maxWeight.toFixed(0)}%`
      : maxWeight <= 30
      ? `High concentration: ${maxWeight.toFixed(0)}%`
      : `Overweight: ${maxWeight.toFixed(0)}% in one stock`;

  // ── Analyst sentiment (20 pts) ───────────────────────────────────────────
  const ratedHoldings = holdings.filter((h) => h.analystRating && h.analystCount >= 2);
  let sentScore = 10; // neutral default when no data
  let sentLabel = 'Insufficient analyst coverage';

  if (ratedHoldings.length > 0) {
    const RATING_SCORE: Record<string, number> = {
      'Strong Buy': 5,
      'Buy': 4,
      'Hold': 2,
      'Sell': 1,
      'Strong Sell': 0,
    };
    const avg =
      ratedHoldings.reduce((sum, h) => sum + (RATING_SCORE[h.analystRating!] ?? 2), 0) /
      ratedHoldings.length;

    sentScore =
      avg >= 4.2 ? 20 : avg >= 3.5 ? 17 : avg >= 2.8 ? 13 : avg >= 2 ? 9 : 4;
    sentLabel =
      avg >= 4.2
        ? 'Strong Buy consensus'
        : avg >= 3.5
        ? 'Buy consensus'
        : avg >= 2.8
        ? 'Mixed / Hold consensus'
        : 'Below Hold consensus';
  }

  // ── Profitability (10 pts) ───────────────────────────────────────────────
  const profitable = holdings.filter((h) => h.totalPnL >= 0).length;
  const profitRatio = profitable / holdings.length;
  const profitScore =
    profitRatio >= 0.8 ? 10 : profitRatio >= 0.6 ? 7 : profitRatio >= 0.4 ? 4 : 2;
  const profitLabel = `${profitable}/${holdings.length} positions profitable`;

  const total = divScore + concScore + sentScore + profitScore;
  const grade: PortfolioHealthResult['grade'] =
    total >= 80 ? 'A' : total >= 65 ? 'B' : total >= 50 ? 'C' : total >= 35 ? 'D' : 'F';

  // Top risk string
  const risks: { text: string; priority: number }[] = [];
  if (maxWeight > 30) risks.push({ text: `One stock is ${maxWeight.toFixed(0)}% of your portfolio`, priority: 3 });
  if (n < 5) risks.push({ text: 'Too few holdings — high single-stock risk', priority: 2 });
  const loserCount = holdings.filter((h) => h.totalPnLPercent < -15).length;
  if (loserCount > 0) risks.push({ text: `${loserCount} holding${loserCount > 1 ? 's' : ''} down >15% — review your thesis`, priority: 2 });
  if (ratedHoldings.length === 0) risks.push({ text: 'No analyst coverage data available', priority: 1 });
  risks.sort((a, b) => b.priority - a.priority);
  const topRisk = risks[0]?.text ?? 'Portfolio looks healthy — keep monitoring.';

  return {
    score: total,
    grade,
    breakdown: {
      diversification: { score: divScore, max: 35, label: divLabel },
      concentration: { score: concScore, max: 35, label: concLabel },
      analystSentiment: { score: sentScore, max: 20, label: sentLabel },
      profitability: { score: profitScore, max: 10, label: profitLabel },
    },
    topRisk,
  };
}

function toYahooTicker(ticker: string, exchange: string): string {
  if (exchange === 'NSE') return `${ticker}.NS`;
  if (exchange === 'BSE') return `${ticker}.BO`;
  if (exchange === 'CRYPTO') return `${ticker}-USD`;
  return ticker;
}
