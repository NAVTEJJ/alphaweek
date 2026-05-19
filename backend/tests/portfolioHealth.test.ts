import { computeHealthScore, LiveHolding } from '../src/services/portfolioHealthService';

// Test helpers — build a holding with sensible defaults so each test only
// specifies the fields it cares about.
function makeHolding(overrides: Partial<LiveHolding> = {}): LiveHolding {
  return {
    ticker: 'AAPL',
    name: 'Apple',
    exchange: 'NASDAQ',
    quantity: 10,
    avgBuyPrice: 100,
    currentPrice: 120,
    currentValue: 1200,
    costBasis: 1000,
    totalPnL: 200,
    totalPnLPercent: 20,
    dayChange: 1,
    dayChangeDollar: 10,
    weight: 10,
    analystRating: 'Buy',
    analystTargetPrice: 130,
    analystUpside: 8.3,
    analystCount: 10,
    sector: 'Technology',
    marketCap: 3_000_000_000_000,
    peRatio: 30,
    weekHigh52: 200,
    weekLow52: 80,
    ...overrides,
  };
}

// Build N evenly-weighted holdings — each holding gets weight = 100/N
function buildEvenPortfolio(n: number, overrides: Partial<LiveHolding> = {}): LiveHolding[] {
  const weight = 100 / n;
  return Array.from({ length: n }, (_, i) =>
    makeHolding({ ticker: `T${i}`, weight, ...overrides })
  );
}

describe('computeHealthScore — empty', () => {
  it('returns grade F for empty portfolio', () => {
    const result = computeHealthScore([]);
    expect(result.grade).toBe('F');
    expect(result.score).toBe(0);
    expect(result.topRisk).toMatch(/Add holdings/);
  });
});

describe('computeHealthScore — diversification axis', () => {
  it('awards full diversification points for 15+ holdings', () => {
    const result = computeHealthScore(buildEvenPortfolio(15));
    expect(result.breakdown.diversification.score).toBe(35);
    expect(result.breakdown.diversification.label).toBe('Excellent');
  });

  it('gives lowest diversification score for 1-2 holdings', () => {
    const result = computeHealthScore([makeHolding({ weight: 100 })]);
    expect(result.breakdown.diversification.score).toBe(2);
    expect(result.breakdown.diversification.label).toBe('Very concentrated');
  });

  it('scales diversification monotonically with holding count', () => {
    const scores = [3, 5, 7, 10, 15].map(
      (n) => computeHealthScore(buildEvenPortfolio(n)).breakdown.diversification.score
    );
    // Each step should be ≥ the previous (monotonic non-decreasing)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});

describe('computeHealthScore — concentration axis', () => {
  it('rewards a well-balanced portfolio (max weight ≤ 10%)', () => {
    const result = computeHealthScore(buildEvenPortfolio(15)); // each ≈ 6.67%
    expect(result.breakdown.concentration.score).toBe(35);
    expect(result.breakdown.concentration.label).toBe('Well balanced');
  });

  it('penalizes overweight single positions', () => {
    // 50% in one stock, rest spread across 5 others at 10% each
    const holdings: LiveHolding[] = [
      makeHolding({ ticker: 'CONC', weight: 50 }),
      ...Array.from({ length: 5 }, (_, i) => makeHolding({ ticker: `T${i}`, weight: 10 })),
    ];
    const result = computeHealthScore(holdings);
    expect(result.breakdown.concentration.score).toBe(2);
    expect(result.breakdown.concentration.label).toMatch(/Overweight/);
  });

  it('surfaces concentration risk in topRisk when one position > 30%', () => {
    const holdings: LiveHolding[] = [
      makeHolding({ ticker: 'CONC', weight: 50 }),
      ...Array.from({ length: 5 }, (_, i) => makeHolding({ ticker: `T${i}`, weight: 10 })),
    ];
    const result = computeHealthScore(holdings);
    expect(result.topRisk).toMatch(/50% of your portfolio/);
  });
});

describe('computeHealthScore — analyst sentiment axis', () => {
  it('rewards Strong Buy consensus', () => {
    const holdings = buildEvenPortfolio(5, { analystRating: 'Strong Buy', analystCount: 10 });
    const result = computeHealthScore(holdings);
    expect(result.breakdown.analystSentiment.score).toBe(20);
    expect(result.breakdown.analystSentiment.label).toBe('Strong Buy consensus');
  });

  it('falls back to neutral when no holding has enough analyst coverage', () => {
    const holdings = buildEvenPortfolio(5, { analystRating: null, analystCount: 0 });
    const result = computeHealthScore(holdings);
    expect(result.breakdown.analystSentiment.score).toBe(10);
    expect(result.breakdown.analystSentiment.label).toMatch(/Insufficient/);
  });

  it('ignores holdings with fewer than 2 analysts', () => {
    const holdings = buildEvenPortfolio(5, { analystRating: 'Strong Buy', analystCount: 1 });
    const result = computeHealthScore(holdings);
    // 1-analyst ratings excluded → falls back to neutral default
    expect(result.breakdown.analystSentiment.label).toMatch(/Insufficient/);
  });
});

describe('computeHealthScore — profitability axis', () => {
  it('rewards a mostly profitable portfolio', () => {
    const holdings = [
      ...Array.from({ length: 4 }, () => makeHolding({ totalPnL: 100, totalPnLPercent: 10, weight: 20 })),
      makeHolding({ ticker: 'LOSER', totalPnL: -50, totalPnLPercent: -5, weight: 20 }),
    ];
    const result = computeHealthScore(holdings);
    expect(result.breakdown.profitability.score).toBe(10); // 4/5 = 80%
    expect(result.breakdown.profitability.label).toBe('4/5 positions profitable');
  });

  it('penalizes a portfolio where most positions are underwater', () => {
    const holdings = buildEvenPortfolio(5, { totalPnL: -50, totalPnLPercent: -5 });
    const result = computeHealthScore(holdings);
    expect(result.breakdown.profitability.score).toBe(2);
  });
});

describe('computeHealthScore — grade boundaries', () => {
  it('returns A for an excellent portfolio (15 diversified, balanced, strong buy, all profitable)', () => {
    const holdings = buildEvenPortfolio(15, {
      analystRating: 'Strong Buy',
      analystCount: 10,
      totalPnL: 100,
      totalPnLPercent: 10,
    });
    const result = computeHealthScore(holdings);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.grade).toBe('A');
  });

  it('returns F for a concentrated, unprofitable portfolio', () => {
    const holdings: LiveHolding[] = [
      makeHolding({ ticker: 'BAGHOLDER', weight: 80, totalPnL: -500, totalPnLPercent: -50, analystRating: null, analystCount: 0 }),
      makeHolding({ ticker: 'OTHER', weight: 20, totalPnL: -100, totalPnLPercent: -25, analystRating: null, analystCount: 0 }),
    ];
    const result = computeHealthScore(holdings);
    expect(result.grade).toBe('F');
  });
});

describe('computeHealthScore — topRisk priority', () => {
  it('prefers concentration risk over loser risk when both apply', () => {
    const holdings: LiveHolding[] = [
      makeHolding({ ticker: 'OVERWEIGHT', weight: 60, totalPnL: -300, totalPnLPercent: -25 }),
      ...Array.from({ length: 4 }, (_, i) =>
        makeHolding({ ticker: `T${i}`, weight: 10, totalPnL: -50, totalPnLPercent: -20 })
      ),
    ];
    const result = computeHealthScore(holdings);
    expect(result.topRisk).toMatch(/60% of your portfolio/);
  });

  it('shows healthy message when no risks trigger', () => {
    const holdings = buildEvenPortfolio(15, {
      analystRating: 'Buy',
      analystCount: 10,
      totalPnL: 100,
      totalPnLPercent: 10,
    });
    const result = computeHealthScore(holdings);
    expect(result.topRisk).toMatch(/healthy/i);
  });
});
