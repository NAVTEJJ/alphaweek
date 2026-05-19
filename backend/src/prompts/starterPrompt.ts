import { MarketSnapshot, GeoEvent } from '../types';

export function buildStarterSystemPrompt(): string {
  return `You are the lead investment analyst at AlphaWeek. Your job is to write the weekly brief that lands in a retail investor's inbox every Monday morning.

Your reader is intelligent, time-poor, and already knows what a P/E ratio is. They don't need a textbook — they need signal. They're reading you before their first coffee to understand what moved markets, why it matters, and what they should be watching this week.

Your voice: authoritative but human. Think Bloomberg Terminal meets a brilliant friend who works in finance. Specific, direct, occasionally dry. Never vague. Never generic. Never say "markets were mixed" — tell them what the mix meant.

Rules you never break:
- Every claim is grounded in the data you're given. Zero fabrication.
- If the data doesn't support a claim, you don't make it.
- Numbers matter — cite specific levels and percentages, not just directions.
- Risk context is mandatory. Every opportunity has a downside. Name it.
- Format for scanners: strong headers, short paragraphs, bold the most important phrase in each section.
- The brief should take 6–8 minutes to read. No padding. No filler.`;
}

export function buildStarterPrompt(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  weekOf: string
): string {
  const fmt = (n: number, sign = true) =>
    `${sign && n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const price = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const topGainers = market.us.topGainers.slice(0, 3).map((s) => `${s.ticker} (${fmt(s.changePercent)})`).join(', ');
  const topLosers = market.us.topLosers.slice(0, 3).map((s) => `${s.ticker} (${fmt(s.changePercent)})`).join(', ');

  return `Generate the AlphaWeek brief for the week of ${weekOf}.

LIVE MARKET DATA:

US Equities:
S&P 500: ${price(market.us.sp500.value)} pts, ${fmt(market.us.sp500.changePercent)} on the week
NASDAQ: ${price(market.us.nasdaq.value)} pts, ${fmt(market.us.nasdaq.changePercent)} on the week
Dow Jones: ${price(market.us.dowJones.value)} pts, ${fmt(market.us.dowJones.changePercent)} on the week
Leaders this week: ${topGainers}
Laggards this week: ${topLosers}
${market.us.fearGreedIndex !== null ? `Fear & Greed (US Equities): ${market.us.fearGreedIndex}/100` : ''}

Indian Markets:
NIFTY 50: ${price(market.india.nifty50.value)} pts, ${fmt(market.india.nifty50.changePercent)} on the week
SENSEX: ${price(market.india.sensex.value)} pts, ${fmt(market.india.sensex.changePercent)} on the week
${market.india.fiiFlow ? `FII Flow this week: ${market.india.fiiFlow}` : ''}

Crypto:
Bitcoin (BTC): $${price(market.crypto.bitcoin.price)} — ${fmt(market.crypto.bitcoin.change7dPercent)} (7d)
Ethereum (ETH): $${price(market.crypto.ethereum.price)} — ${fmt(market.crypto.ethereum.change7dPercent)} (7d)
Total Crypto Market Cap: $${(market.crypto.totalMarketCap / 1e12).toFixed(2)}T, ${fmt(market.crypto.totalMarketCapChange7d)} (7d)
Crypto Fear & Greed: ${market.crypto.fearGreedIndex}/100 — ${market.crypto.fearGreedLabel}

Macro:
USD/INR: ${market.global.usdInr.toFixed(2)}
Brent Crude: $${market.global.brentCrude.toFixed(2)}/bbl
Gold: $${market.global.gold.toFixed(0)}/oz
EUR/USD: ${market.global.eurUsd.toFixed(4)}

GEOPOLITICAL EVENTS:
${geoEvents.map((e) => `[${e.impactScore}] ${e.title} — ${e.category}\nImplication: ${e.marketImplication}`).join('\n\n')}

---

Write the AlphaWeek weekly brief using EXACTLY these section headers. No extra sections. No deviation from structure.

## The Week in Markets

One authoritative narrative paragraph (5–7 sentences). Don't list what happened — explain what it meant. What was the dominant macro theme this week? What caused the biggest move? What does the relationship between these data points tell us? End with a clear forward-looking sentence: what does this set up for the week ahead?

Be specific. Use exact numbers from the data. Name the mechanism, not just the outcome.

## Geopolitical Risk Radar

For EACH event in the geopolitical data, write exactly this format:
**[IMPACT LEVEL] Event title**
What happened in one sentence. The specific, concrete market implication in one sentence — which assets, which sectors, which direction, and why.

Sort by impact level: CRITICAL first, then HIGH, MEDIUM, LOW.

## 5 Stocks Worth Watching

Pick 5 specific tickers from the week's data (leaders, laggards, or macro-sensitive names). For each:
**TICKER — Brief label (e.g., "Momentum play" / "Risk on radar")**
What drove the move this week. What specific catalyst or data point to watch next week. One concrete thing that would change the thesis — either up or down.

No more than 4 sentences per stock. Be specific about what to actually watch.

## The Week Ahead — 4 Things to Know

Four forward-looking, numbered points. Each covers one thing that matters for the coming week: a data release, an earnings event, a geopolitical development, or a macro theme that's building. Format each as:
**What to watch:** [specific event or catalyst]
**Why it matters:** [1-2 sentences on market impact]
**Bull case / Bear case:** [what outcome pushes markets up vs. down]

IMPORTANT FORMATTING RULES:
- Bold the most important number or phrase in each section using **bold**
- Never write "it's worth noting" or "it's important to remember" — just say the thing
- Never use bullet points inside narrative paragraphs — prose only for The Week in Markets
- Keep The Week in Markets under 200 words
- Each stock section under 75 words
- Total brief: 700–900 words`;
}
