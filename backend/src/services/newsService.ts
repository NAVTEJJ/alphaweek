import { cacheGet, cacheSet, CACHE_TTL } from '../../config/redis';
import { withRetry } from '../utils/retryHelper';
import { logger } from '../utils/logger';
import { GeoEvent } from '../types';
import { enrichGeoEventsWithImplications } from './geoEnrich';

interface NewsApiArticle {
  title: string;
  description: string | null;
  source: { name: string };
  publishedAt: string;
  url: string;
}

interface NewsApiResponse {
  status: string;
  articles: NewsApiArticle[];
}

const CACHE_KEY_NEWS = 'news:financial:weekly';
const CACHE_KEY_GEO = 'news:geopolitical:weekly';

const MARKET_RELEVANT_KEYWORDS = [
  'fed', 'federal reserve', 'interest rate', 'inflation', 'gdp', 'recession',
  'rbi', 'sensex', 'nifty', 'nasdaq', 's&p', 'dow jones',
  'sanctions', 'tariff', 'trade war', 'opec', 'oil', 'supply chain',
  'china', 'russia', 'ukraine', 'middle east', 'iran', 'taiwan',
  'earnings', 'revenue', 'profit', 'quarterly results', 'ipo',
  'crypto', 'bitcoin', 'ethereum', 'sec', 'regulation',
];

function scoreFundamentalImpact(text: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const lower = text.toLowerCase();
  const criticalKeywords = ['war', 'sanctions', 'crash', 'collapse', 'emergency', 'crisis', 'default'];
  const highKeywords = ['recession', 'rate hike', 'rate cut', 'tariff', 'trade ban', 'ban', 'fed decision'];
  const mediumKeywords = ['inflation', 'gdp', 'earnings miss', 'earnings beat', 'ipo', 'merger', 'acquisition'];

  if (criticalKeywords.some((k) => lower.includes(k))) return 'CRITICAL';
  if (highKeywords.some((k) => lower.includes(k))) return 'HIGH';
  if (mediumKeywords.some((k) => lower.includes(k))) return 'MEDIUM';
  return 'LOW';
}

function classifyCategory(text: string): GeoEvent['category'] {
  const lower = text.toLowerCase();
  if (lower.includes('tariff') || lower.includes('trade') || lower.includes('import') || lower.includes('export')) return 'TRADE';
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('rbi')) return 'MONETARY_POLICY';
  if (lower.includes('war') || lower.includes('conflict') || lower.includes('attack') || lower.includes('military')) return 'CONFLICT';
  if (lower.includes('oil') || lower.includes('opec') || lower.includes('energy') || lower.includes('gas')) return 'ENERGY';
  if (lower.includes('regulation') || lower.includes('sec') || lower.includes('antitrust') || lower.includes('ban')) return 'TECH_REGULATION';
  return 'OTHER';
}

async function fetchNewsApiArticles(query: string, days: number = 7): Promise<NewsApiArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    logger.warn('NEWS_API_KEY not set, skipping news fetch');
    return [];
  }

  const from = new Date(Date.now() - days * 86400 * 1000).toISOString().split('T')[0];
  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q', query);
  url.searchParams.set('from', from);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'relevancy');
  url.searchParams.set('pageSize', '50');
  url.searchParams.set('apiKey', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`NewsAPI returned ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as NewsApiResponse;
  return data.articles ?? [];
}

export async function getFinancialNews(): Promise<NewsApiArticle[]> {
  const cached = await cacheGet<NewsApiArticle[]>(CACHE_KEY_NEWS);
  if (cached) return cached;

  const articles = await withRetry(
    () => fetchNewsApiArticles('stock market OR financial markets OR federal reserve OR earnings', 7),
    'getFinancialNews',
    { maxAttempts: 3, delayMs: 1000 }
  );

  await cacheSet(CACHE_KEY_NEWS, articles, CACHE_TTL.GEO_EVENTS);
  return articles;
}

export async function getGeopoliticalEvents(): Promise<GeoEvent[]> {
  const cached = await cacheGet<GeoEvent[]>(CACHE_KEY_GEO);
  if (cached) return cached;

  const articles = await withRetry(
    () => fetchNewsApiArticles('geopolitical OR sanctions OR tariff OR trade war OR central bank', 7),
    'getGeopoliticalEvents',
    { maxAttempts: 3, delayMs: 1000 }
  );

  // Filter and transform articles into GeoEvents
  const geoEvents: GeoEvent[] = articles
    .filter((article) => {
      const text = `${article.title} ${article.description ?? ''}`.toLowerCase();
      return MARKET_RELEVANT_KEYWORDS.some((kw) => text.includes(kw));
    })
    .slice(0, 10)
    .map((article) => {
      const text = `${article.title} ${article.description ?? ''}`;
      return {
        title: article.title,
        summary: article.description ?? article.title,
        source: article.source.name,
        publishedAt: article.publishedAt,
        impactScore: scoreFundamentalImpact(text),
        category: classifyCategory(text),
        marketImplication: '', // Will be filled in by AI synthesis
      };
    });

  // Sort by impact: CRITICAL > HIGH > MEDIUM > LOW
  const impactOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
  geoEvents.sort((a, b) => impactOrder[b.impactScore] - impactOrder[a.impactScore]);

  // Keep only the top 5 — feeding too many events into the brief makes it noisy.
  const top = geoEvents.slice(0, 5);

  // Enrich each event with a real market implication before caching. Cached
  // value already includes the LLM-written implication, so the heavy work
  // happens once per 6h (CACHE_TTL.GEO_EVENTS) across all users.
  const enriched = await enrichGeoEventsWithImplications(top);

  await cacheSet(CACHE_KEY_GEO, enriched, CACHE_TTL.GEO_EVENTS);
  return enriched;
}
