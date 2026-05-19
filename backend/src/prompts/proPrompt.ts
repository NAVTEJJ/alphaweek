import { MarketSnapshot, GeoEvent, PortfolioAnalysis } from '../types';
import { buildStarterPrompt, buildStarterSystemPrompt } from './starterPrompt';

export function buildProSystemPrompt(): string {
  return `${buildStarterSystemPrompt()}

You are writing the Pro-tier brief, which includes the user's actual portfolio data. This is personalisation at the core — every portfolio insight must reference their ACTUAL holdings and numbers, not generic advice.

The portfolio section is the most valuable part of this brief. A user who sees their own stocks named, their actual P&L discussed, and specific suggestions for their specific holdings will read this section first every week.

Key rules for portfolio analysis:
- Always compare to the benchmark. "Your portfolio returned X% vs the benchmark's Y%" is more valuable than just X%.
- Name individual holdings. "AAPL dragged performance this week" beats "some holdings underperformed."
- Be honest. If the portfolio had a bad week, say it clearly. Don't soften it.
- Rebalancing suggestions must reference actual tickers in their portfolio, not generic sectors.
- If they have no holdings, acknowledge it and tell them why adding holdings matters.`;
}

function deriveHealthGrade(portfolio: PortfolioAnalysis): { grade: string; label: string } {
  if (portfolio.holdings.length === 0) return { grade: 'N/A', label: 'No holdings to grade.' };
  const outperforming = portfolio.weeklyChangePercent >= portfolio.benchmarkReturn;
  const outperformDelta = portfolio.weeklyChangePercent - portfolio.benchmarkReturn;
  const reviewCount = portfolio.holdings.filter((h) => h.recommendation === 'REVIEW').length;
  const sectorCount = Object.keys(portfolio.sectorAllocation).length;
  const n = portfolio.holdings.length;

  let score = 50;
  score += outperformDelta * 4;             // each pp over benchmark = +4pts
  score += Math.min(n * 3, 20);            // more holdings = more diversified
  score += Math.min(sectorCount * 4, 16);  // sector spread
  score -= reviewCount * 12;               // each REVIEW holding = -12pts

  const grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';
  const direction = outperforming ? `outperforming benchmark by ${Math.abs(outperformDelta).toFixed(1)}pp` : `underperforming benchmark by ${Math.abs(outperformDelta).toFixed(1)}pp`;
  const riskNote = reviewCount > 0 ? ` ${reviewCount} holding${reviewCount > 1 ? 's' : ''} flagged for review.` : '';
  return { grade, label: `${direction}.${riskNote}` };
}

export function buildProPrompt(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  portfolio: PortfolioAnalysis,
  weekOf: string
): string {
  const fmt = (n: number, sign = true) => `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const base = buildStarterPrompt(market, geoEvents, weekOf);

  const hasHoldings = portfolio.holdings.length > 0;
  const health = hasHoldings ? deriveHealthGrade(portfolio) : null;

  const portfolioBlock = hasHoldings ? `
PORTFOLIO DATA (user's actual holdings):
Total Portfolio Value: ${usd(portfolio.totalValue)}
Total P&L (all-time): ${usd(portfolio.totalPnL)} (${fmt(portfolio.totalPnLPercent)})
This Week: ${usd(portfolio.weeklyChange)} (${fmt(portfolio.weeklyChangePercent)})
Benchmark This Week: ${fmt(portfolio.benchmarkReturn)} — portfolio ${portfolio.weeklyChangePercent >= portfolio.benchmarkReturn ? 'OUTPERFORMED ✓' : 'UNDERPERFORMED ✗'} by ${Math.abs(portfolio.weeklyChangePercent - portfolio.benchmarkReturn).toFixed(2)}pp
Portfolio Health Grade: ${health!.grade} — ${health!.label}

Holdings Breakdown:
${portfolio.holdings.map((h) =>
    `${h.ticker} (${h.exchange}): ${usd(h.currentPrice)} | Qty: ${h.quantity} | Value: ${usd(h.currentValue)} | All-time P&L: ${fmt(h.pnLPercent)} | Week: ${fmt(h.weeklyChangePercent)} | Signal: ${h.recommendation} | Reason: ${h.recommendationReason}`
  ).join('\n')}

Sector Allocation:
${Object.entries(portfolio.sectorAllocation).map(([s, pct]) => `${s}: ${pct.toFixed(1)}%`).join(' | ')}` : `
PORTFOLIO DATA: User has not added any holdings yet.`;

  return `${base}
${portfolioBlock}

---

In addition to the standard brief sections above, APPEND these portfolio-specific sections at the end:

## Your Portfolio This Week

${hasHoldings ? `Open with: "PORTFOLIO HEALTH: ${health!.grade} — [one short sentence on what this grade means for the user]."
Then cover:
- Which holding drove performance the most (up or down)? Name it and give the exact contribution.
- Any holding that posted a significantly different return from the overall market — explain why.
- Honest assessment: did the portfolio's composition help or hurt given this week's macro theme?
- If any holding has a "REVIEW" signal, mention it specifically.

Then add a per-holding line for every holding in the portfolio:
**TICKER** +/-X% — [one sentence: the specific reason this holding moved this week. Name the actual catalyst — earnings, guidance, macro, sector rotation, news event. Not generic. If you don't know the specific reason, say "No clear catalyst this week."]

Keep the narrative under 120 words. The per-holding lines are additional and required.` : `Tell the user clearly that adding holdings is how AlphaWeek becomes truly personalised — their brief will then include weekly P&L, portfolio vs benchmark comparison, and rebalancing signals specific to their holdings. Point them to the Portfolio section to get started. Keep this to 2 sentences.`}

## Rebalancing Signals

${hasHoldings ? `Based on the actual portfolio holdings and sector allocation above, provide 2–3 specific observations:
- Any sector that's over- or under-represented vs. a typical diversified portfolio (flag anything >35% in one sector)
- Any single holding that represents an outsized % of total value (flag anything >25%)
- One specific action worth considering — must reference an actual ticker in the portfolio

Format each as: **Signal:** [observation] → **Consider:** [specific action]
Not financial advice — frame as things worth reviewing with their advisor or thinking through themselves.` : `Explain that rebalancing signals will appear here once they add holdings to their portfolio.`}

## Sector Signals This Week

Identify 2–3 sector-level trends visible in this week's US market data:
**[Sector Name] — [STRENGTH / WEAKNESS / ROTATION]**
One sentence on what the data shows. One sentence on what it might signal for the coming week. If any of the user's holdings sit in this sector, note it: "Relevant to your [TICKER] position."`;
}
