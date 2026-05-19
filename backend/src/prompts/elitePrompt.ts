import { MarketSnapshot, GeoEvent, PortfolioAnalysis } from '../types';
import { buildProPrompt } from './proPrompt';
import { SentimentSummary } from '../services/sentimentService';
import { PriorResearchOutcome } from '../services/aiService';

export function buildEliteSystemPrompt(): string {
  return `You are a senior buy-side analyst writing the AlphaWeek Elite brief. Your reader has a meaningful amount of money invested and treats your brief as a serious input to their weekly research process — not casual reading.

You think in second and third-order effects. Rising oil prices aren't just "bullish for energy" — you trace the chain: inflation expectations → Fed tone → rate-sensitive sector rotation → dollar strength → EM currency pressure → Indian market impact. You make those connections explicit.

You are willing to take a view. "Markets face headwinds" is cowardly. "The risk/reward on tech favors downside this week given earnings season uncertainty and crowded positioning" is analysis.

You integrate ALL available data: price action, macro, geopolitics, portfolio specifics, AND retail sentiment. The synthesis of all four is where the alpha is.

Your brief reads like a Goldman Sachs morning note crossed with a thoughtful Substack. Authoritative, specific, occasionally contrarian, always grounded in data.

Standards for the Elite brief:
1. Every claim traces to a specific data point
2. Contrarian views are clearly labeled and defended
3. Risk context is always paired with opportunity
4. Retail sentiment is treated as a signal, not noise — extreme readings are contrarian indicators
5. The brief is 1,000–1,300 words. Not a word more. Not a word less if the data supports it.

MANDATORY OUTPUT STRUCTURE — your response must start with this block, then the markdown:

<<<ALPHAWEEK_META>>>
MOOD: [BULLISH|CAUTIOUS|BEARISH|VOLATILE]
MOOD_REASON: [One sentence, max 20 words, grounded in the dominant data point this week.]
SUMMARY_1: [Most important market development this week. Max 15 words.]
SUMMARY_2: [Most important thing for this user's portfolio. Max 15 words.]
SUMMARY_3: [Most important thing to watch next week. Max 15 words.]
<<<END_META>>>

Then write the full brief markdown. After the final section, end with:

<<<ALPHAWEEK_CLOSING>>>
CLOSING_QUESTION: [One thought-provoking question personalized to this user's portfolio. Max 25 words. Make it specific — name an actual ticker or situation.]
<<<END_CLOSING>>>

No other text outside these blocks and the markdown.`;
}

export function buildElitePrompt(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  portfolio: PortfolioAnalysis,
  sentiment: SentimentSummary | null,
  weekOf: string,
  priorResearch?: PriorResearchOutcome[]
): string {
  const base = buildProPrompt(market, geoEvents, portfolio, weekOf);

  const sentimentBlock = sentiment ? `
RETAIL SENTIMENT DATA — Week of ${weekOf}:
Platform: Reddit (r/investing, r/stocks, r/wallstreetbets)
Overall Sentiment: ${sentiment.sentiment.toUpperCase()}
Distribution: ${sentiment.bullishCount} bullish / ${sentiment.bearishCount} bearish / ${sentiment.neutralCount} neutral posts
Bullish/Bearish Ratio: ${(sentiment.bullishCount / Math.max(1, sentiment.bearishCount)).toFixed(1)}:1
Most-Discussed Tickers: ${sentiment.trendingTickers.slice(0, 8).join(', ')}
Top Posts This Week:
${sentiment.topPosts.slice(0, 5).map((p, i) => `${i + 1}. [${p.score} upvotes] "${p.title}" (r/${p.subreddit})`).join('\n')}` : '';

  const calledItBlock = priorResearch && priorResearch.length > 0 ? `

LAST WEEK'S RESEARCH IDEAS — SCORECARD:
${priorResearch.map((r) => {
  const change = r.weeklyChangePercent !== null
    ? `${r.weeklyChangePercent >= 0 ? '+' : ''}${r.weeklyChangePercent.toFixed(1)}% this week`
    : 'price data unavailable';
  return `${r.ticker}: "${r.thesis}" → ${change}`;
}).join('\n')}

MANDATORY: Before the 7 sections, after the META block, add a section:

## AlphaWeek Called It — Last Week's Scorecard

Score each research idea explicitly and honestly. If a ticker went up when we called it bullish — say so and by how much. If we were wrong — say so directly. Honesty here builds more trust than being right.

Format for each idea:
✓ or ✗ **TICKER** — [brief outcome: up X% / down X% / flat]. [One sentence: was the thesis confirmed or contradicted?]

End with one sentence: the net scorecard (e.g., "2 out of 3 theses played out this week").

Under 80 words total for this section. Be specific. Never be vague.` : '';

  return `${base}
${sentimentBlock}
${calledItBlock}

---

APPEND these Elite-only sections after all Pro sections:

## Sentiment vs. Price: What the Crowd Is Missing

This is your most analytical section. Do not summarize the sentiment data — interpret it.

Three things to cover:
1. **Sentiment alignment check:** Is retail sentiment confirmed by price action, or is there a divergence? A bullish crowd + falling prices, or bearish crowd + rising prices, are your most important signals. Be explicit about which scenario you see.
2. **Most dangerous consensus:** What is the most crowded retail belief right now? What specific data point contradicts or challenges it?
3. **Contrarian signal, if any:** Extreme readings (very high bullish or bearish ratios, specific tickers dominating the conversation) are historically contrarian. If you see one, call it.

Under 150 words. Specific. Cite actual numbers from the sentiment data.

## Sector Rotation Map

Based on this week's cross-asset data (equities, rates, commodities, FX), identify which sectors of the cycle we are in:

Format:
**ROTATING IN (early outperformers to watch):** [sectors + brief rationale]
**EXTENDED (late-stage, potential fatigue):** [sectors showing potential exhaustion]
**ROTATING OUT (confirmed weakness):** [sectors with sustained selling]
**MACRO TAILWIND:** [one macro factor — rate expectations, dollar, oil — and which sector it benefits]

Under 120 words.

## 3 High-Conviction Research Ideas

Three specific setups worth deeper research this week. These are NOT buy recommendations — they are investment theses to examine.

For each, use this exact format:
**Ticker: [SYMBOL]** — [Setup type: Momentum / Value / Catalyst / Rotation]
**Thesis:** [Why this is interesting right now — specific catalyst or data point driving it. 2 sentences max.]
**What confirms it:** [The specific thing that would validate the thesis — earnings beat, technical breakout, macro catalyst. 1 sentence.]
**What kills it:** [The specific risk that would invalidate the thesis. 1 sentence.]
**Relevance to your portfolio:** [If the user holds this or a correlated stock, note it. If not, skip this line.]`;
}
