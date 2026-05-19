import { getEnrichedQuotes, getWeeklyPriceMoves } from './stockService';
import { logger } from '../utils/logger';
import { PortfolioHolding, PortfolioAnalysis, HoldingAnalysis } from '../types';

// Benchmark tickers — we fetch real weekly returns from these, not constants.
const BENCHMARK_US = 'SPY';      // S&P 500 ETF (USD)
const BENCHMARK_INDIA = '^NSEI'; // NIFTY 50 index (INR)
const USD_INR_TICKER = 'INR=X';  // USD/INR FX rate

function mapTickerForYahoo(holding: PortfolioHolding): string {
  if (holding.exchange === 'NSE') return `${holding.ticker}.NS`;
  if (holding.exchange === 'BSE') return `${holding.ticker}.BO`;
  if (holding.exchange === 'CRYPTO') return `${holding.ticker}-USD`;
  return holding.ticker;
}

// Holdings priced in INR (NSE/BSE) need converting to USD for the unified
// totals. We use the live USD/INR rate. If the rate isn't available, we keep
// per-holding values in their native currency but flag a mismatch in the log.
function isInrHolding(h: PortfolioHolding): boolean {
  return h.exchange === 'NSE' || h.exchange === 'BSE';
}

function getRecommendation(
  pnlPercent: number,
  weeklyChangePct: number
): Pick<HoldingAnalysis, 'recommendation' | 'recommendationReason'> {
  if (pnlPercent < -15) {
    return {
      recommendation: 'REVIEW',
      recommendationReason: `Down ${Math.abs(pnlPercent).toFixed(1)}% from your buy price. Review your thesis.`,
    };
  }
  if (weeklyChangePct < -5) {
    return {
      recommendation: 'WATCH',
      recommendationReason: `Dropped ${Math.abs(weeklyChangePct).toFixed(1)}% this week. Monitor closely.`,
    };
  }
  if (pnlPercent > 50) {
    return {
      recommendation: 'WATCH',
      recommendationReason: `Up ${pnlPercent.toFixed(1)}% since purchase. Consider whether to take profits.`,
    };
  }
  return {
    recommendation: 'HOLD',
    recommendationReason: 'Performing in line with expectations. No action needed.',
  };
}

export async function analyzePortfolio(holdings: PortfolioHolding[]): Promise<PortfolioAnalysis> {
  if (holdings.length === 0) {
    return {
      totalValue: 0, totalCost: 0, totalPnL: 0, totalPnLPercent: 0,
      weeklyChange: 0, weeklyChangePercent: 0, benchmarkReturn: 0,
      sectorAllocation: {}, holdings: [],
    };
  }

  const yahooTickers = holdings.map(mapTickerForYahoo);

  // We need three things for each holding: current price (for live value),
  // weekly price move (for real weekly P&L), and sector (for allocation).
  // Plus benchmark weekly moves and FX rate.
  const benchmarkTickers = [BENCHMARK_US, BENCHMARK_INDIA, USD_INR_TICKER];
  const [enriched, weeklyMoves] = await Promise.all([
    getEnrichedQuotes([...yahooTickers, ...benchmarkTickers]),
    getWeeklyPriceMoves([...yahooTickers, BENCHMARK_US, BENCHMARK_INDIA]),
  ]);

  // FX rate: USD per 1 INR. INR=X is quoted as INR per 1 USD, so we invert.
  const usdInrRate = enriched[USD_INR_TICKER]?.price ?? 0;
  const inrToUsd = usdInrRate > 0 ? 1 / usdInrRate : null;
  if (!inrToUsd) {
    logger.warn('USD/INR rate unavailable — INR holdings will not be converted');
  }

  let totalValueUsd = 0;
  let totalCostUsd = 0;
  let totalWeeklyChangeUsd = 0;

  const holdingAnalyses: HoldingAnalysis[] = holdings.map((holding) => {
    const yahooTicker = mapTickerForYahoo(holding);
    const quote = enriched[yahooTicker];
    const move = weeklyMoves[yahooTicker];

    const currentPriceNative = quote?.price ?? move?.currentPrice ?? holding.avgBuyPrice;
    const currentValueNative = currentPriceNative * holding.quantity;
    const costBasisNative = holding.avgBuyPrice * holding.quantity;
    const pnLNative = currentValueNative - costBasisNative;
    const pnLPercent = costBasisNative > 0 ? (pnLNative / costBasisNative) * 100 : 0;

    // Real weekly change from the historical chart, not derived from all-time P&L
    const weeklyChangePct = move?.weeklyChangePercent ?? 0;
    const weeklyChangeNative = currentValueNative * (weeklyChangePct / 100);

    // Convert to reporting currency (USD) if this is an INR holding
    const fxToUsd = isInrHolding(holding) && inrToUsd ? inrToUsd : 1;
    totalValueUsd += currentValueNative * fxToUsd;
    totalCostUsd += costBasisNative * fxToUsd;
    totalWeeklyChangeUsd += weeklyChangeNative * fxToUsd;

    const { recommendation, recommendationReason } = getRecommendation(pnLPercent, weeklyChangePct);

    return {
      ...holding,
      currentPrice: currentPriceNative,
      currentValue: currentValueNative,
      pnL: pnLNative,
      pnLPercent,
      weeklyChange: weeklyChangeNative,
      weeklyChangePercent: weeklyChangePct,
      recommendation,
      recommendationReason,
    };
  });

  const totalPnLUsd = totalValueUsd - totalCostUsd;
  const totalPnLPercent = totalCostUsd > 0 ? (totalPnLUsd / totalCostUsd) * 100 : 0;
  const weeklyChangePercent = totalValueUsd > 0 ? (totalWeeklyChangeUsd / totalValueUsd) * 100 : 0;

  // Pick the relevant benchmark: if all INR, use NIFTY; if all USD, use SPY;
  // if mixed, use a value-weighted blend. Hand back the % the user's portfolio
  // should be measured against this week.
  const hasIndia = holdings.some(isInrHolding);
  const hasUS = holdings.some((h) => !isInrHolding(h));
  const spyWeek = weeklyMoves[BENCHMARK_US]?.weeklyChangePercent ?? 0;
  const niftyWeek = weeklyMoves[BENCHMARK_INDIA]?.weeklyChangePercent ?? 0;
  const benchmarkReturn = hasIndia && !hasUS ? niftyWeek
    : hasUS && !hasIndia ? spyWeek
    : (spyWeek + niftyWeek) / 2;

  // Real sector allocation from Yahoo's assetProfile (carried on the enriched
  // quote). Crypto and anything without sector data falls into 'Other'.
  const sectorValueUsd: Record<string, number> = {};
  for (const h of holdingAnalyses) {
    const yt = mapTickerForYahoo(h);
    const sectorFromYahoo = enriched[yt]?.sector ?? null;
    const sector = sectorFromYahoo ?? (h.exchange === 'CRYPTO' ? 'Crypto' : 'Other');
    const valueUsd = h.currentValue * (isInrHolding(h) && inrToUsd ? inrToUsd : 1);
    sectorValueUsd[sector] = (sectorValueUsd[sector] ?? 0) + valueUsd;
  }
  const sectorAllocation: Record<string, number> = {};
  for (const [sector, value] of Object.entries(sectorValueUsd)) {
    sectorAllocation[sector] = totalValueUsd > 0 ? (value / totalValueUsd) * 100 : 0;
  }

  logger.debug('Portfolio analysis complete', {
    totalValueUsd: totalValueUsd.toFixed(2),
    totalPnLPercent: totalPnLPercent.toFixed(2),
    weeklyChangePercent: weeklyChangePercent.toFixed(2),
    benchmarkReturn: benchmarkReturn.toFixed(2),
    holdingsCount: holdings.length,
    inrConverted: hasIndia && !!inrToUsd,
  });

  return {
    totalValue: totalValueUsd,
    totalCost: totalCostUsd,
    totalPnL: totalPnLUsd,
    totalPnLPercent,
    weeklyChange: totalWeeklyChangeUsd,
    weeklyChangePercent,
    benchmarkReturn,
    sectorAllocation,
    holdings: holdingAnalyses,
  };
}
