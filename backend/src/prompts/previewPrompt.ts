import { MarketSnapshot, GeoEvent, PortfolioAnalysis } from '../types';

export function buildPreviewSystemPrompt(): string {
  return `You are an investment analyst writing a brief portfolio snapshot for a new AlphaWeek user. They just signed up and you need to show them immediate value — a fast, punchy 3-section summary that makes them feel like they already have an analyst watching their money.

Be specific. Name their actual tickers. Use real numbers from the data.
Keep the total response under 350 words. No filler, no generic statements.`;
}

export function buildPreviewPrompt(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  portfolio: PortfolioAnalysis,
  date: string
): string {
  const fmt = (n: number, sign = true) => `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const hasHoldings = portfolio.holdings.length > 0;

  const portfolioBlock = hasHoldings
    ? `Portfolio value: ${usd(portfolio.totalValue)} | Week: ${fmt(portfolio.weeklyChangePercent)} vs benchmark ${fmt(portfolio.benchmarkReturn)}
Holdings: ${portfolio.holdings.map((h) => `${h.ticker} ${fmt(h.weeklyChangePercent)} (week)`).join(' · ')}`
    : 'User has no holdings yet.';

  const topGeoEvents = geoEvents.slice(0, 3).map((e) => `[${e.impactScore}] ${e.title}`).join('\n');

  return `Generate a 3-section preview brief for a new user. Date: ${date}.

MARKET DATA:
S&P 500: ${market.us.sp500.value.toFixed(0)} pts (${fmt(market.us.sp500.changePercent)} week)
NASDAQ: ${market.us.nasdaq.value.toFixed(0)} pts (${fmt(market.us.nasdaq.changePercent)} week)
BTC: $${market.crypto.bitcoin.price.toFixed(0)} (${fmt(market.crypto.bitcoin.change7dPercent)} 7d)

${portfolioBlock}

TOP NEWS THIS WEEK:
${topGeoEvents || 'No major geopolitical events.'}

Write EXACTLY these 3 sections and nothing else:

## Your Portfolio Right Now
${hasHoldings
  ? 'One paragraph. State their total value and weekly return vs benchmark in the first sentence. Then name the top performer and worst performer this week with exact percentages. End with one honest sentence: is the portfolio positioned well for current market conditions?'
  : 'Tell them their brief will be fully personalized once they add holdings. Keep to 2 sentences.'}

## What\'s Moving Your Holdings
${hasHoldings
  ? 'For each holding, write exactly one line: **TICKER** +/-X% — [the specific reason: earnings, sector rotation, macro event, or "No clear catalyst this week." if unknown]. No paragraphs — one line per holding.'
  : 'Summarise the 2 most important market events this week in 2 sentences each.'}

## One Thing to Watch This Week
One specific, actionable observation. ${hasHoldings ? 'It must reference an actual ticker in their portfolio.' : 'A market-level observation relevant to a new investor.'} Name the catalyst, name the risk, and name what would confirm or invalidate it. Under 60 words.`;
}
