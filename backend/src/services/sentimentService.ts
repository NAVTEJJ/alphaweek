import Groq from 'groq-sdk';
import { cacheGet, cacheSet, CACHE_TTL } from '../../config/redis';
import { withRetry } from '../utils/retryHelper';
import { logger } from '../utils/logger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const SENTIMENT_MODEL = 'llama-3.3-70b-versatile';

export interface RedditPost {
  title: string;
  score: number;
  numComments: number;
  subreddit: string;
  url: string;
  selftext: string;
  createdUtc: number;
}

export interface SentimentSummary {
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  topPosts: RedditPost[];
  trendingTickers: string[];
  fetchedAt: string;
}

const CACHE_KEY_SENTIMENT = 'sentiment:reddit:weekly';
const SUBREDDITS = ['investing', 'stocks', 'wallstreetbets'];

// Simple rule-based ticker extractor from post titles.
// Prefer "$TICKER" or "TICKER stock"/"TICKER calls"/"TICKER puts"/"TICKER earnings"
// patterns over bare uppercase tokens. Bare uppercase still allowed but heavily
// filtered through a stop-word list of common-acronym noise.
const STOP_TICKERS = new Set([
  // Acronyms / metrics — never a ticker in context
  'ETF', 'IPO', 'EPS', 'GDP', 'CEO', 'CFO', 'CPI', 'PPI', 'SEC', 'FED', 'RBI',
  'USD', 'EUR', 'JPY', 'INR', 'GBP', 'API', 'SaaS', 'IRA', '401K', 'YTD', 'YOY',
  'ATH', 'ATL', 'AH', 'PR', 'PE', 'PT', 'EV', 'BS', 'CC', 'DD', 'IR', 'MD',
  'PM', 'AM', 'NYC', 'LA', 'SF', 'UK', 'US', 'EU', 'UN', 'NATO', 'OPEC',
  // English common words sometimes capitalized
  'THE', 'FOR', 'AND', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'ANY', 'CAN',
  'GET', 'HOW', 'NEW', 'NOW', 'OUR', 'WAS', 'WHO', 'WHY', 'YES', 'ONE',
  'TWO', 'THREE', 'BIG', 'OWN', 'GOT', 'TLDR', 'TLDW', 'IIRC', 'IMO', 'IMHO',
  // Reddit/finance slang capitalized
  'WSB', 'YOLO', 'FOMO', 'FUD', 'HODL', 'BTFD', 'ATM', 'OTM', 'ITM',
]);

// Strong signal: $AAPL or AAPL with context (stock|calls|puts|earnings|short|long)
const DOLLAR_TICKER = /\$([A-Z]{1,5})\b/g;
const CONTEXTUAL_TICKER = /\b([A-Z]{2,5})\s+(?:stock|calls?|puts?|earnings|shares?|short|long)\b/gi;
// Bare uppercase tokens (last-resort signal, filtered by STOP_TICKERS)
const BARE_TICKER = /\b([A-Z]{2,5})\b/g;

function extractTickers(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;

  while ((m = DOLLAR_TICKER.exec(text)) !== null) found.add(m[1].toUpperCase());
  while ((m = CONTEXTUAL_TICKER.exec(text)) !== null) found.add(m[1].toUpperCase());

  // Bare matches only count if not in stop list AND have at least one stronger signal already
  // OR appear with a contextual word elsewhere in the text. Otherwise too noisy.
  while ((m = BARE_TICKER.exec(text)) !== null) {
    const candidate = m[1];
    if (STOP_TICKERS.has(candidate)) continue;
    // Allow 4-5 letter bare tokens (less likely to be a generic acronym)
    if (candidate.length >= 4) found.add(candidate);
  }

  return Array.from(found);
}

async function getRedditAccessToken(): Promise<string> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const userAgent = process.env.REDDIT_USER_AGENT ?? 'AlphaWeek/1.0';

  if (!clientId || !clientSecret) {
    throw new Error('Reddit API credentials not configured');
  }

  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(`Reddit OAuth failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

async function fetchSubredditTop(subreddit: string, token: string, limit: number = 25): Promise<RedditPost[]> {
  const userAgent = process.env.REDDIT_USER_AGENT ?? 'AlphaWeek/1.0';

  const response = await fetch(
    `https://oauth.reddit.com/r/${subreddit}/top?t=week&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} for r/${subreddit}`);
  }

  interface RedditApiPost {
    data: {
      title: string;
      score: number;
      num_comments: number;
      subreddit: string;
      url: string;
      selftext: string;
      created_utc: number;
    };
  }

  interface RedditApiResponse {
    data: { children: RedditApiPost[] };
  }

  const data = await response.json() as RedditApiResponse;
  return data.data.children.map((child) => ({
    title: child.data.title,
    score: child.data.score,
    numComments: child.data.num_comments,
    subreddit: child.data.subreddit,
    url: child.data.url,
    selftext: child.data.selftext?.slice(0, 500) ?? '',
    createdUtc: child.data.created_utc,
  }));
}

// Keyword fallback used only if the LLM call fails. Way better than the original
// version: requires a bullish/bearish keyword to also appear *near* a stock-related
// token AND uses negation guards. Still crude — we want LLM scoring as primary.
function analyzeSentimentFallback(posts: RedditPost[]): Pick<SentimentSummary, 'bullishCount' | 'bearishCount' | 'neutralCount' | 'sentiment'> {
  const bullishHints = /\b(bullish|moon|long|undervalued|breakout|squeeze|rally|outperform)\b/i;
  const bearishHints = /\b(bearish|short|crash|dump|overvalued|recession|sell[- ]?off|underperform)\b/i;
  const negation = /\b(not|don'?t|never|no(?!\s+more)|isn'?t|aren'?t|won'?t)\s+\w*\s*(?:\b(bullish|bearish|buy|sell|long|short))/i;

  let bullish = 0, bearish = 0, neutral = 0;
  for (const post of posts) {
    const text = `${post.title} ${post.selftext}`;
    const isNeg = negation.test(text);
    const bull = bullishHints.test(text) && !isNeg;
    const bear = bearishHints.test(text) && !isNeg;
    if (bull && !bear) bullish++;
    else if (bear && !bull) bearish++;
    else neutral++;
  }
  const total = bullish + bearish + neutral;
  const sentiment: SentimentSummary['sentiment'] = total === 0 ? 'NEUTRAL'
    : bullish / total > 0.55 ? 'BULLISH'
    : bearish / total > 0.55 ? 'BEARISH'
    : 'NEUTRAL';
  return { bullishCount: bullish, bearishCount: bearish, neutralCount: neutral, sentiment };
}

// Bulk-classifies posts via the LLM. Returns the same shape as the legacy
// keyword classifier so callers don't need to change. Single batched call —
// cheap and avoids per-post latency. Falls back to the regex classifier if
// the model is unreachable.
async function analyzeSentiment(
  posts: RedditPost[]
): Promise<Pick<SentimentSummary, 'bullishCount' | 'bearishCount' | 'neutralCount' | 'sentiment'>> {
  if (posts.length === 0) {
    return { bullishCount: 0, bearishCount: 0, neutralCount: 0, sentiment: 'NEUTRAL' };
  }

  const numbered = posts
    .map((p, i) => {
      const body = (p.selftext ?? '').slice(0, 280);
      return `${i}. r/${p.subreddit} [${p.score}↑] ${p.title}${body ? `\n   ${body}` : ''}`;
    })
    .join('\n\n');

  const system = `You classify retail-investor posts as BULLISH (expects price up), BEARISH (expects price down), or NEUTRAL (commentary, question, or no clear directional view). Consider negation, sarcasm, and meme phrases (e.g. "to the moon" is bullish, "guh" is bearish, "diamond hands" is bullish-hold).

Return STRICT JSON only — no prose, no markdown fences. Shape: {"classifications":[{"i":0,"label":"BULLISH"},...]} using exactly BULLISH | BEARISH | NEUTRAL.`;

  const user = `Posts:\n\n${numbered}`;

  try {
    const raw = await withRetry(
      async () => {
        const response = await groq.chat.completions.create({
          model: SENTIMENT_MODEL,
          max_tokens: 800,
          temperature: 0.1,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('Empty response from Groq');
        return content;
      },
      'analyzeSentiment',
      { maxAttempts: 2, delayMs: 1500 }
    );

    const parsed = JSON.parse(raw) as { classifications?: { i: number; label: string }[] };
    let bullish = 0, bearish = 0, neutral = 0;
    for (const c of parsed.classifications ?? []) {
      if (typeof c.i !== 'number') continue;
      const label = (c.label ?? '').toUpperCase();
      if (label === 'BULLISH') bullish++;
      else if (label === 'BEARISH') bearish++;
      else neutral++;
    }
    const total = bullish + bearish + neutral;
    // If the LLM returned far fewer labels than posts (parser glitch),
    // fall back to keyword classification on the whole set to keep stats honest.
    if (total < posts.length * 0.7) {
      logger.warn('LLM sentiment under-returned — using regex fallback', { total, expected: posts.length });
      return analyzeSentimentFallback(posts);
    }

    const sentiment: SentimentSummary['sentiment'] = total === 0 ? 'NEUTRAL'
      : bullish / total > 0.55 ? 'BULLISH'
      : bearish / total > 0.55 ? 'BEARISH'
      : 'NEUTRAL';

    return { bullishCount: bullish, bearishCount: bearish, neutralCount: neutral, sentiment };
  } catch (err) {
    logger.warn('LLM sentiment classification failed — using regex fallback', { error: String(err) });
    return analyzeSentimentFallback(posts);
  }
}

export async function getRedditSentiment(): Promise<SentimentSummary> {
  const cached = await cacheGet<SentimentSummary>(CACHE_KEY_SENTIMENT);
  if (cached) return cached;

  const summary = await withRetry(
    async () => {
      const token = await getRedditAccessToken();

      const allPosts = (
        await Promise.all(SUBREDDITS.map((sub) => fetchSubredditTop(sub, token, 25)))
      ).flat();

      const sortedPosts = allPosts.sort((a, b) => b.score - a.score);
      const topPosts = sortedPosts.slice(0, 10);

      const tickerCounts = new Map<string, number>();
      for (const post of sortedPosts) {
        const tickers = extractTickers(post.title);
        for (const ticker of tickers) {
          tickerCounts.set(ticker, (tickerCounts.get(ticker) ?? 0) + 1);
        }
      }

      const trendingTickers = [...tickerCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ticker]) => ticker);

      const sentimentStats = await analyzeSentiment(sortedPosts);

      return {
        ...sentimentStats,
        topPosts,
        trendingTickers,
        fetchedAt: new Date().toISOString(),
      } satisfies SentimentSummary;
    },
    'getRedditSentiment',
    { maxAttempts: 3, delayMs: 2000 }
  );

  await cacheSet(CACHE_KEY_SENTIMENT, summary, CACHE_TTL.GEO_EVENTS);
  logger.info('Reddit sentiment fetched', { sentiment: summary.sentiment, tickers: summary.trendingTickers });
  return summary;
}
