import { MarketSnapshot, GeoEvent, PortfolioAnalysis } from '../types';

export function buildDailySystemPrompt(): string {
  return `You are AlphaWeek's daily market analyst. Your job is to write the morning brief an investor reads before markets open — in under 3 minutes.

Your reader is already briefed on the weekly picture. They need to know: what changed overnight, what matters today, and what to watch.

Your voice: terse, direct, specific. Every sentence earns its place. "Markets are mixed" is deleted. "Tech sold off as the 10yr broke 4.5%" stays.

Rules:
1. Lead with the overnight driver — the single thing that moved or will move markets.
2. Every claim cites a specific level, percentage, or data point.
3. Portfolio section names actual tickers — never "some holdings."
4. No padding, no hedging, no filler. 250–350 words maximum.`;
}

export function buildDailyPrompt(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  portfolio: PortfolioAnalysis,
  date: string
): string {
  const fmt = (n: number, sign = true) => `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const price = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const movers = [
    ...market.us.topGainers.slice(0, 3).map((s) => `${s.ticker} ${fmt(s.changePercent)}`),
    ...market.us.topLosers.slice(0, 3).map((s) => `${s.ticker} ${fmt(s.changePercent)}`),
  ].join(', ');

  const impactedHoldings = portfolio.holdings
    .filter((h) => Math.abs(h.weeklyChangePercent) > 0.8)
    .slice(0, 5)
    .map((h) => `${h.ticker} ${fmt(h.weeklyChangePercent)}`)
    .join(', ');

  const marketData = `DAILY MARKET DATA — ${date}

US Equities:
S&P 500: ${price(market.us.sp500.value)} pts (${fmt(market.us.sp500.changePercent)})
NASDAQ:  ${price(market.us.nasdaq.value)} pts (${fmt(market.us.nasdaq.changePercent)})
Dow:     ${price(market.us.dowJones.value)} pts (${fmt(market.us.dowJones.changePercent)})
${market.us.fearGreedIndex !== null ? `Fear & Greed: ${market.us.fearGreedIndex}/100` : ''}
Notable movers: ${movers}

Crypto:
BTC: $${price(market.crypto.bitcoin.price)} (${fmt(market.crypto.bitcoin.change7dPercent)} 7d)
ETH: $${price(market.crypto.ethereum.price)} (${fmt(market.crypto.ethereum.change7dPercent)} 7d)

Macro:
Gold: $${market.global.gold.toFixed(0)}/oz | Brent: $${market.global.brentCrude.toFixed(1)}/bbl | USD/INR: ${market.global.usdInr.toFixed(2)} | EUR/USD: ${market.global.eurUsd.toFixed(4)}

Today's Key Events:
${geoEvents.slice(0, 3).map((e) => `[${e.impactScore}] ${e.title} — ${e.marketImplication}`).join('\n') || 'No major scheduled events'}`;

  const portfolioData = portfolio.holdings.length > 0
    ? `\nPORTFOLIO (${portfolio.holdings.length} holdings, total ${`$${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}):
Holdings in motion today: ${impactedHoldings || 'None moved significantly'}
Benchmark this week: ${fmt(portfolio.benchmarkReturn)}`
    : '';

  return `${marketData}${portfolioData}

---

Write the AlphaWeek daily morning brief for ${date} using EXACTLY these sections:

## Overnight Pulse

2–3 sentences maximum. What was the single dominant move or development since yesterday's close? State what happened, what caused it, and what it signals for today's session. Lead with a number.

## The Level That Matters

One specific index level, yield, or ticker price that will determine today's direction. State the exact level. One sentence on what happens if it holds — one sentence on what happens if it breaks.

## Your Portfolio Today

${portfolio.holdings.length > 0
    ? `Name 1–2 holdings from the portfolio data that are directly affected by today's moves. State the ticker, the move, and why it matters to this position specifically. If no holdings moved meaningfully, note the most relevant macro factor for their sector allocation.`
    : `Identify 1–2 tickers from today's notable movers worth monitoring. What is driving them? What level would change the picture?`}

## One-Line Macro Read

Exactly one sentence summarizing today's macro setup and risk tone. Be specific — name the driver and the direction. Example format: "Risk-off tone as the 10yr breaks 4.5% on hotter-than-expected PPI, pressuring rate-sensitive sectors."

FORMATTING: Bold the single most important number or phrase in each section. Total brief: 250–350 words. No bullet points in the Overnight Pulse — prose only.`;
}
