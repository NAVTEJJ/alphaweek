import { getYF } from '../utils/yahooFinance';
import { cacheGet, cacheSet, CACHE_TTL, redis } from '../../config/redis';
import { withRetry } from '../utils/retryHelper';
import { recordYahooCall, shouldPreferStaleCache } from '../utils/yahooHealth';
import { logger } from '../utils/logger';
import { MarketSnapshot, MarketIndex, StockMove } from '../types';

const CACHE_KEY_MARKET = 'market:snapshot:global';
const CACHE_KEY_MARKET_STALE = 'market:snapshot:global:stale'; // long-lived backup for stale-while-error
const STALE_TTL_S = 24 * 3600; // 24h — fall back to this when Yahoo is down
const LOCK_KEY_MARKET = 'lock:market:snapshot';
const LOCK_TTL_S = 30;

const FEAR_GREED_CACHE_KEY = 'market:fear-greed';
const FEAR_GREED_TTL_S = 3600; // 1 hour — Alternative.me updates once a day

async function fetchFearGreedIndex(): Promise<{ value: number; label: string }> {
  const cached = await cacheGet<{ value: number; label: string }>(FEAR_GREED_CACHE_KEY);
  if (cached) return cached;

  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json() as { data: [{ value: string; value_classification: string }] };
    const result = {
      value: parseInt(json.data[0].value, 10),
      label: json.data[0].value_classification,
    };
    await cacheSet(FEAR_GREED_CACHE_KEY, result, FEAR_GREED_TTL_S);
    return result;
  } catch {
    logger.warn('Failed to fetch Fear & Greed index from alternative.me — using neutral fallback');
    return { value: 50, label: 'Neutral' };
  }
}

// ─── Ticker search (Yahoo public search endpoint) ────────────────────────────
//
// Yahoo's website uses `query1.finance.yahoo.com/v1/finance/search` to power
// its own ticker autocomplete. No API key required. We expose this through
// our backend so the frontend can debounce-fetch suggestions when the user
// is typing a ticker into the add-holding / set-alert / watchlist forms.

export interface TickerSearchResult {
  ticker: string;       // bare symbol the user would type, e.g. "AAPL", "RELIANCE"
  yahooSymbol: string;  // Yahoo's full symbol including suffix, e.g. "RELIANCE.NS"
  name: string;         // human-readable company / asset name
  exchange: string;     // our enum: NASDAQ / NYSE / NSE / BSE / CRYPTO
  quoteType: string;    // EQUITY / CRYPTOCURRENCY / ETF / INDEX / MUTUALFUND / FUTURE
}

// Map Yahoo's exchange codes onto our internal enum. Anything we don't map is
// filtered out (no point letting users select an unsupported exchange).
function mapYahooExchange(exchDisp: string | undefined, symbol: string): string | null {
  const ex = (exchDisp ?? '').toUpperCase();
  if (symbol.endsWith('.NS')) return 'NSE';
  if (symbol.endsWith('.BO')) return 'BSE';
  if (symbol.endsWith('-USD') || ex === 'CCC' || ex === 'CCY') return 'CRYPTO';
  if (ex === 'NMS' || ex === 'NASDAQ' || ex === 'NCM' || ex === 'NGM') return 'NASDAQ';
  if (ex === 'NYQ' || ex === 'NYSE' || ex === 'PCX' || ex === 'ASE') return 'NYSE';
  return null;
}

export async function searchTickers(query: string, limit: number = 8): Promise<TickerSearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  const cacheKey = `tickersearch:${q.toLowerCase()}`;
  const cached = await cacheGet<TickerSearchResult[]>(cacheKey);
  if (cached) return cached.slice(0, limit);

  try {
    // newsCount=0 — we only want the symbol quotes, not the news block.
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      // Yahoo's CDN rejects requests with no UA; mimic a browser.
      headers: { 'User-Agent': 'Mozilla/5.0 AlphaWeek/1.0' },
    });
    if (!res.ok) {
      void recordYahooCall(false);
      return [];
    }
    const data = (await res.json()) as {
      quotes?: {
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchDisp?: string;
        quoteType?: string;
      }[];
    };

    const results: TickerSearchResult[] = [];
    for (const q of data.quotes ?? []) {
      if (!q.symbol) continue;
      const exchange = mapYahooExchange(q.exchDisp, q.symbol);
      if (!exchange) continue;
      // Strip Yahoo suffix for the bare ticker that the user types/stores
      const bare = q.symbol.replace(/\.NS$|\.BO$|-USD$/, '');
      results.push({
        ticker: bare,
        yahooSymbol: q.symbol,
        name: q.shortname ?? q.longname ?? bare,
        exchange,
        quoteType: q.quoteType ?? 'EQUITY',
      });
    }

    void recordYahooCall(true);
    // Cache 30 min — symbols don't change but new IPOs do; long enough to
    // absorb autocomplete burst typing, short enough to stay fresh.
    await cacheSet(cacheKey, results, 30 * 60);
    return results.slice(0, limit);
  } catch (err) {
    void recordYahooCall(false);
    logger.warn('Ticker search failed', { query: q, error: String(err) });
    return [];
  }
}

interface YahooQuote {
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketPreviousClose?: number;
  shortName?: string;
}

async function fetchQuote(symbol: string): Promise<YahooQuote | null> {
  try {
    const yahooFinance = await getYF();
    const result = await yahooFinance.quote(symbol, {
      fields: ['regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent', 'regularMarketPreviousClose', 'shortName'],
    });
    void recordYahooCall(true);
    return result as YahooQuote;
  } catch {
    void recordYahooCall(false);
    logger.warn('Failed to fetch quote', { symbol });
    return null;
  }
}

function toMarketIndex(quote: YahooQuote | null): MarketIndex {
  return {
    value: quote?.regularMarketPrice ?? 0,
    change: quote?.regularMarketChange ?? 0,
    changePercent: quote?.regularMarketChangePercent ?? 0,
  };
}

async function fetchTopMovers(symbols: string[]): Promise<{ gainers: StockMove[]; losers: StockMove[] }> {
  const quotes = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const q = await fetchQuote(symbol);
      return { symbol, quote: q };
    })
  );

  const moves: StockMove[] = quotes
    .filter((r): r is PromiseFulfilledResult<{ symbol: string; quote: YahooQuote | null }> => r.status === 'fulfilled' && r.value.quote !== null)
    .map(({ value: { symbol, quote } }) => ({
      ticker: symbol,
      name: quote!.shortName ?? symbol,
      change: quote!.regularMarketChange ?? 0,
      changePercent: quote!.regularMarketChangePercent ?? 0,
      price: quote!.regularMarketPrice ?? 0,
    }));

  const sorted = [...moves].sort((a, b) => b.changePercent - a.changePercent);
  return {
    gainers: sorted.filter((m) => m.changePercent > 0).slice(0, 5),
    losers: sorted.filter((m) => m.changePercent < 0).slice(-5).reverse(),
  };
}

// Top movers from Yahoo's day_gainers / day_losers screens — gives us the
// real top-5 of the whole US market instead of a fixed mega-cap shortlist.
async function fetchScreenedMovers(): Promise<{ gainers: StockMove[]; losers: StockMove[] }> {
  type ScreenerQuote = {
    symbol?: string;
    shortName?: string;
    longName?: string;
    regularMarketPrice?: number;
    regularMarketChange?: number;
    regularMarketChangePercent?: number;
  };
  const toMove = (q: ScreenerQuote): StockMove => ({
    ticker: q.symbol ?? '',
    name: q.shortName ?? q.longName ?? q.symbol ?? '',
    price: q.regularMarketPrice ?? 0,
    change: q.regularMarketChange ?? 0,
    changePercent: q.regularMarketChangePercent ?? 0,
  });

  async function runScreen(scrId: 'day_gainers' | 'day_losers'): Promise<StockMove[]> {
    try {
      const yahooFinance = await getYF();
      const raw = await yahooFinance.screener(
        { scrIds: scrId, count: 10 },
        { validateResult: false }
      ) as { quotes?: ScreenerQuote[] };
      void recordYahooCall(true);
      return (raw.quotes ?? []).map(toMove).filter((m) => m.ticker).slice(0, 5);
    } catch (err) {
      void recordYahooCall(false);
      logger.warn(`Yahoo screener ${scrId} failed`, { error: String(err) });
      return [];
    }
  }

  const [gainers, losers] = await Promise.all([runScreen('day_gainers'), runScreen('day_losers')]);
  return { gainers, losers };
}

// Crypto market movers from CoinGecko's free /coins/markets endpoint. Returns
// the top 100 coins by market cap, sorted by 24h %. We pick top/bottom 5 from
// that universe — much better than asking Yahoo about a hardcoded 8-coin list.
// Caches the raw fetch for 10 minutes to stay polite with their rate limit.
async function fetchCryptoMovers(): Promise<{ gainers: StockMove[]; losers: StockMove[] }> {
  const cacheKey = 'cryptomovers:cgecko';
  const cached = await cacheGet<{ gainers: StockMove[]; losers: StockMove[] }>(cacheKey);
  if (cached) return cached;

  try {
    const url = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h';
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = (await res.json()) as {
      symbol: string;
      name: string;
      current_price: number;
      price_change_24h: number | null;
      price_change_percentage_24h: number | null;
    }[];

    const moves: StockMove[] = data
      .filter((c) => typeof c.price_change_percentage_24h === 'number')
      .map((c) => ({
        ticker: c.symbol.toUpperCase(),
        name: c.name,
        price: c.current_price,
        change: c.price_change_24h ?? 0,
        changePercent: c.price_change_percentage_24h ?? 0,
      }));

    const sorted = [...moves].sort((a, b) => b.changePercent - a.changePercent);
    const result = {
      gainers: sorted.filter((m) => m.changePercent > 0).slice(0, 5),
      losers: sorted.filter((m) => m.changePercent < 0).slice(-5).reverse(),
    };
    await cacheSet(cacheKey, result, 10 * 60);
    return result;
  } catch (err) {
    logger.warn('CoinGecko crypto movers fetch failed — falling back to fixed list', { error: String(err) });
    return { gainers: [], losers: [] };
  }
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  const cached = await cacheGet<MarketSnapshot>(CACHE_KEY_MARKET);
  if (cached) {
    logger.debug('Market snapshot cache hit');
    return cached;
  }

  // Yahoo health check — if it's unhealthy and we have a stale snapshot,
  // serve that instead of hammering Yahoo with more failing calls.
  if (await shouldPreferStaleCache()) {
    const stale = await cacheGet<MarketSnapshot>(CACHE_KEY_MARKET_STALE);
    if (stale) {
      logger.warn('Yahoo Finance unhealthy — serving stale market snapshot');
      return stale;
    }
  }

  // Distributed lock — prevents cache stampede when multiple requests hit on expiry
  const lockAcquired = await redis.set(LOCK_KEY_MARKET, '1', 'EX', LOCK_TTL_S, 'NX');
  if (!lockAcquired) {
    // Another instance is fetching — poll cache for up to 5s before giving up
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const polled = await cacheGet<MarketSnapshot>(CACHE_KEY_MARKET);
      if (polled) return polled;
    }
    logger.warn('Market snapshot lock timeout — proceeding with own fetch');
  }

  let snapshot: MarketSnapshot;
  try {
    snapshot = await withRetry(
    async () => {
      const [sp500, nasdaq, dowJones, nifty, sensex, usdInr, gold, brent] = await Promise.all([
        fetchQuote('^GSPC'),
        fetchQuote('^IXIC'),
        fetchQuote('^DJI'),
        fetchQuote('^NSEI'),
        fetchQuote('^BSESN'),
        fetchQuote('INR=X'),
        fetchQuote('GC=F'),
        fetchQuote('BZ=F'),
      ]);

      // US movers: Yahoo screener (whole market) → hardcoded mega-cap fallback.
      // India movers: NIFTY 50 + broader large/mid caps via Yahoo (no screener
      //   coverage we can rely on). Curated but representative of NIFTY 50.
      // Crypto movers: CoinGecko top-100 by market cap, ranked by 24h % →
      //   hardcoded universe fallback.
      const NIFTY_LARGECAP_PROXY = [
        'RELIANCE.NS', 'TCS.NS', 'HDFCBANK.NS', 'INFY.NS', 'ICICIBANK.NS',
        'BAJFINANCE.NS', 'LT.NS', 'WIPRO.NS', 'ITC.NS', 'KOTAKBANK.NS',
        'BHARTIARTL.NS', 'AXISBANK.NS', 'MARUTI.NS', 'SBIN.NS', 'HINDUNILVR.NS',
      ];
      const CRYPTO_FALLBACK = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'BNB-USD', 'XRP-USD', 'ADA-USD', 'AVAX-USD', 'DOT-USD'];

      const [usMoversScreened, inMovers, btc, eth, eurUsd, cryptoMoversCG, fearGreed] = await Promise.all([
        fetchScreenedMovers(),
        fetchTopMovers(NIFTY_LARGECAP_PROXY),
        fetchQuote('BTC-USD'),
        fetchQuote('ETH-USD'),
        fetchQuote('EURUSD=X'),
        fetchCryptoMovers(),
        fetchFearGreedIndex(),
      ]);

      const usMovers =
        usMoversScreened.gainers.length > 0 || usMoversScreened.losers.length > 0
          ? usMoversScreened
          : await fetchTopMovers(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'AMD', 'NFLX', 'INTC']);

      const cryptoMovers =
        cryptoMoversCG.gainers.length > 0 || cryptoMoversCG.losers.length > 0
          ? cryptoMoversCG
          : await fetchTopMovers(CRYPTO_FALLBACK);

      // CoinGecko-style total market cap via BTC dominance approximation
      const btcPrice = btc?.regularMarketPrice ?? 0;
      const ethPrice = eth?.regularMarketPrice ?? 0;

      const result: MarketSnapshot = {
        us: {
          sp500: toMarketIndex(sp500),
          nasdaq: toMarketIndex(nasdaq),
          dowJones: toMarketIndex(dowJones),
          topGainers: usMovers.gainers,
          topLosers: usMovers.losers,
          fearGreedIndex: fearGreed.value,
        },
        india: {
          nifty50: toMarketIndex(nifty),
          sensex: toMarketIndex(sensex),
          topGainers: inMovers.gainers,
          topLosers: inMovers.losers,
          fiiFlow: null, // FII flow not available from free data sources
        },
        crypto: {
          bitcoin: {
            price: btcPrice,
            change7d: btc?.regularMarketChange ?? 0,
            change7dPercent: btc?.regularMarketChangePercent ?? 0,
            marketCap: 0,
          },
          ethereum: {
            price: ethPrice,
            change7d: eth?.regularMarketChange ?? 0,
            change7dPercent: eth?.regularMarketChangePercent ?? 0,
            marketCap: 0,
          },
          totalMarketCap: 0,
          totalMarketCapChange7d: 0,
          fearGreedIndex: fearGreed.value,
          fearGreedLabel: fearGreed.label,
          topGainers: cryptoMovers.gainers.map((m) => ({
            symbol: m.ticker.replace('-USD', ''),
            name: m.name,
            change7d: m.change,
            change7dPercent: m.changePercent,
          })),
          topLosers: cryptoMovers.losers.map((m) => ({
            symbol: m.ticker.replace('-USD', ''),
            name: m.name,
            change7d: m.change,
            change7dPercent: m.changePercent,
          })),
        },
        global: {
          usdInr: usdInr?.regularMarketPrice ?? 0,
          eurUsd: eurUsd?.regularMarketPrice ?? 0,
          brentCrude: brent?.regularMarketPrice ?? 0,
          gold: gold?.regularMarketPrice ?? 0,
          events: [],
        },
        fetchedAt: new Date().toISOString(),
      };

      return result;
    },
      'getMarketSnapshot',
      { maxAttempts: 3, delayMs: 2000 }
    );
  } catch (err) {
    // Yahoo failed even after retries — fall back to the stale snapshot.
    await redis.del(LOCK_KEY_MARKET);
    const stale = await cacheGet<MarketSnapshot>(CACHE_KEY_MARKET_STALE);
    if (stale) {
      logger.warn('Market snapshot fetch failed — serving stale snapshot', { error: String(err) });
      return stale;
    }
    throw err;
  }

  // Update both the short-lived primary cache and the long-lived stale backup.
  await cacheSet(CACHE_KEY_MARKET, snapshot, CACHE_TTL.MARKET_DATA);
  await cacheSet(CACHE_KEY_MARKET_STALE, snapshot, STALE_TTL_S);
  await redis.del(LOCK_KEY_MARKET);
  logger.info('Market snapshot fetched and cached');
  return snapshot;
}

// Fetch the most recent close from N trading days ago. Used for weekly P&L —
// we compare today's price against the close 7 calendar days earlier. Returns
// { currentPrice, weekAgoPrice, weeklyChangePercent } per ticker. Missing
// tickers are omitted from the result.
export interface WeeklyPriceMove {
  currentPrice: number;
  weekAgoPrice: number;
  weeklyChange: number;
  weeklyChangePercent: number;
}

export async function getWeeklyPriceMoves(tickers: string[]): Promise<Record<string, WeeklyPriceMove>> {
  if (tickers.length === 0) return {};

  const result: Record<string, WeeklyPriceMove> = {};
  const yahooFinance = await getYF();

  // Yahoo's chart() with 7d range, 1d interval gives us daily closes. We pick
  // the most recent close as "current" and the oldest as "week ago".
  await Promise.allSettled(
    tickers.map(async (ticker) => {
      const cacheKey = `weeklymove:${ticker}`;
      const cached = await cacheGet<WeeklyPriceMove>(cacheKey);
      if (cached) {
        result[ticker] = cached;
        return;
      }

      try {
        const end = new Date();
        const start = new Date(end.getTime() - 10 * 86400 * 1000); // 10 days back to be safe across weekends
        const chart = await yahooFinance.chart(ticker, {
          period1: start,
          period2: end,
          interval: '1d',
        }) as { quotes?: { date: Date; close: number | null }[] };

        const closes = (chart.quotes ?? [])
          .map((q) => q.close)
          .filter((c): c is number => typeof c === 'number' && c > 0);

        if (closes.length < 2) {
          void recordYahooCall(false);
          return;
        }

        const currentPrice = closes[closes.length - 1];
        // "Week ago" = oldest close in our 10-day window (typically 7-10 days old)
        const weekAgoPrice = closes[0];
        const weeklyChange = currentPrice - weekAgoPrice;
        const weeklyChangePercent = weekAgoPrice > 0 ? (weeklyChange / weekAgoPrice) * 100 : 0;

        const move: WeeklyPriceMove = { currentPrice, weekAgoPrice, weeklyChange, weeklyChangePercent };
        result[ticker] = move;
        void recordYahooCall(true);
        // Cache for an hour — closes don't move within the day for past sessions
        await cacheSet(cacheKey, move, 3600);
      } catch {
        void recordYahooCall(false);
        logger.warn('Weekly price move fetch failed', { ticker });
      }
    })
  );

  return result;
}

export async function getStockPrices(tickers: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      const cacheKey = `price:${ticker}`;
      const cached = await cacheGet<number>(cacheKey);
      if (cached !== null) {
        prices[ticker] = cached;
        return;
      }

      const quote = await fetchQuote(ticker);
      if (quote?.regularMarketPrice) {
        prices[ticker] = quote.regularMarketPrice;
        await cacheSet(cacheKey, quote.regularMarketPrice, CACHE_TTL.STOCK_PRICE);
      }
    })
  );

  return prices;
}

// ─── Single-ticker deep detail ────────────────────────────────────────────────

const RATING_MAP: Record<string, string> = {
  strongBuy: 'Strong Buy',
  buy: 'Buy',
  hold: 'Hold',
  sell: 'Sell',
  strongSell: 'Strong Sell',
};

export type PriceRange = '1W' | '1M' | '3M' | '1Y';

export interface TickerPriceSeries {
  range: PriceRange;
  points: { date: string; close: number }[];
}

export interface TickerDetail {
  ticker: string;
  yahooTicker: string;
  exchange: string;
  name: string;
  longName: string | null;
  currency: string;
  price: number;
  dayChange: number;
  dayChangePercent: number;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  marketCap: number | null;
  volume: number | null;
  averageVolume: number | null;
  peRatio: number | null;
  forwardPE: number | null;
  dividendYield: number | null;
  beta: number | null;
  eps: number | null;
  sector: string | null;
  industry: string | null;
  description: string | null; // longBusinessSummary
  analystRating: string | null;
  analystTargetPrice: number | null;
  analystCount: number;
  analystUpside: number | null;
  nextEarningsDate: string | null;
  series: TickerPriceSeries;
  fetchedAt: string;
}

const RANGE_TO_DAYS: Record<PriceRange, number> = { '1W': 10, '1M': 35, '3M': 100, '1Y': 380 };

async function fetchPriceSeries(yahooTicker: string, range: PriceRange): Promise<TickerPriceSeries> {
  const days = RANGE_TO_DAYS[range];
  const cacheKey = `series:${yahooTicker}:${range}`;
  const cached = await cacheGet<TickerPriceSeries>(cacheKey);
  if (cached) return cached;

  try {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400 * 1000);
    const yahooFinance = await getYF();
    const chart = await yahooFinance.chart(yahooTicker, {
      period1: start,
      period2: end,
      interval: '1d',
    }) as { quotes?: { date: Date; close: number | null }[] };

    const points = (chart.quotes ?? [])
      .filter((q): q is { date: Date; close: number } => typeof q.close === 'number' && q.close > 0)
      .map((q) => ({ date: q.date.toISOString().split('T')[0], close: q.close }));

    void recordYahooCall(true);
    const series: TickerPriceSeries = { range, points };
    // Shorter cache for daily data — market is dynamic
    await cacheSet(cacheKey, series, 30 * 60);
    return series;
  } catch {
    void recordYahooCall(false);
    return { range, points: [] };
  }
}

export async function getTickerDetail(
  ticker: string,
  exchange: string,
  range: PriceRange = '1M'
): Promise<TickerDetail | null> {
  const yahooTicker = ((): string => {
    if (exchange === 'NSE') return `${ticker}.NS`;
    if (exchange === 'BSE') return `${ticker}.BO`;
    if (exchange === 'CRYPTO') return `${ticker}-USD`;
    return ticker;
  })();

  const cacheKey = `tickerdetail:${yahooTicker}`;
  const cached = await cacheGet<Omit<TickerDetail, 'series'>>(cacheKey);

  // Series is fetched alongside but on a shorter cache so it stays fresh.
  const seriesPromise = fetchPriceSeries(yahooTicker, range);

  if (cached) {
    const series = await seriesPromise;
    return { ...cached, series };
  }

  try {
    const yahooFinance = await getYF();
    const summary = await yahooFinance.quoteSummary(yahooTicker, {
      modules: ['price', 'financialData', 'summaryDetail', 'assetProfile', 'defaultKeyStatistics', 'calendarEvents'],
    }) as {
      price?: {
        regularMarketPrice?: number;
        regularMarketChange?: number;
        regularMarketChangePercent?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
        regularMarketPreviousClose?: number;
        regularMarketVolume?: number;
        averageDailyVolume10Day?: number;
        marketCap?: number;
        shortName?: string;
        longName?: string;
        currency?: string;
      };
      financialData?: {
        recommendationKey?: string;
        targetMeanPrice?: number;
        numberOfAnalystOpinions?: number;
      };
      summaryDetail?: {
        trailingPE?: number;
        forwardPE?: number;
        fiftyTwoWeekHigh?: number;
        fiftyTwoWeekLow?: number;
        dividendYield?: number;
        beta?: number;
        averageVolume?: number;
      };
      assetProfile?: { sector?: string; industry?: string; longBusinessSummary?: string };
      defaultKeyStatistics?: { trailingEps?: number };
      calendarEvents?: { earnings?: { earningsDate?: Date[] } };
    };

    const p = summary.price;
    const fin = summary.financialData;
    const detail = summary.summaryDetail;
    const profile = summary.assetProfile;
    if (!p?.regularMarketPrice) {
      void recordYahooCall(false);
      return null;
    }

    const currentPrice = p.regularMarketPrice;
    const target = fin?.targetMeanPrice ?? null;
    // quoteSummary returns regularMarketChangePercent as a fraction (e.g., 0.0123)
    const dayChangePercent = (p.regularMarketChangePercent ?? 0) * 100;
    const analystUpside =
      target && currentPrice > 0 ? ((target - currentPrice) / currentPrice) * 100 : null;
    const earningsDate = summary.calendarEvents?.earnings?.earningsDate?.[0];

    const baseDetail: Omit<TickerDetail, 'series'> = {
      ticker,
      yahooTicker,
      exchange,
      name: p.shortName ?? ticker,
      longName: p.longName ?? null,
      currency: p.currency ?? 'USD',
      price: currentPrice,
      dayChange: p.regularMarketChange ?? 0,
      dayChangePercent,
      previousClose: p.regularMarketPreviousClose ?? null,
      dayHigh: p.regularMarketDayHigh ?? null,
      dayLow: p.regularMarketDayLow ?? null,
      weekHigh52: detail?.fiftyTwoWeekHigh ?? null,
      weekLow52: detail?.fiftyTwoWeekLow ?? null,
      marketCap: p.marketCap ?? null,
      volume: p.regularMarketVolume ?? null,
      averageVolume: detail?.averageVolume ?? p.averageDailyVolume10Day ?? null,
      peRatio: detail?.trailingPE ?? null,
      forwardPE: detail?.forwardPE ?? null,
      dividendYield: detail?.dividendYield ? detail.dividendYield * 100 : null,
      beta: detail?.beta ?? null,
      eps: summary.defaultKeyStatistics?.trailingEps ?? null,
      sector: profile?.sector ?? null,
      industry: profile?.industry ?? null,
      description: profile?.longBusinessSummary ?? null,
      analystRating: fin?.recommendationKey ? (RATING_MAP[fin.recommendationKey] ?? null) : null,
      analystTargetPrice: target,
      analystCount: fin?.numberOfAnalystOpinions ?? 0,
      analystUpside,
      nextEarningsDate: earningsDate ? earningsDate.toISOString() : null,
      fetchedAt: new Date().toISOString(),
    };

    await cacheSet(cacheKey, baseDetail, CACHE_TTL.STOCK_PRICE);
    void recordYahooCall(true);

    const series = await seriesPromise;
    return { ...baseDetail, series };
  } catch (err) {
    void recordYahooCall(false);
    logger.warn('Ticker detail fetch failed', { yahooTicker, error: String(err) });
    return null;
  }
}

export interface EnrichedQuote {
  ticker: string;
  name: string;
  price: number;
  dayChange: number;
  dayChangePercent: number;
  analystRating: string | null;
  analystTargetPrice: number | null;
  analystCount: number;
  marketCap: number | null;
  peRatio: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
  sector: string | null;
}

export async function getEnrichedQuotes(tickers: string[]): Promise<Record<string, EnrichedQuote>> {
  const result: Record<string, EnrichedQuote> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      const cacheKey = `enriched:${ticker}`;
      const cached = await cacheGet<EnrichedQuote>(cacheKey);
      if (cached) {
        result[ticker] = cached;
        return;
      }

      try {
        const yahooFinance = await getYF();
        const summary = await yahooFinance.quoteSummary(ticker, {
          modules: ['price', 'financialData', 'summaryDetail', 'assetProfile'],
        }) as {
          price?: {
            regularMarketPrice?: number;
            regularMarketChange?: number;
            regularMarketChangePercent?: number;
            shortName?: string;
            longName?: string;
            marketCap?: number;
          };
          financialData?: {
            recommendationKey?: string;
            targetMeanPrice?: number;
            numberOfAnalystOpinions?: number;
          };
          summaryDetail?: {
            trailingPE?: number;
            fiftyTwoWeekHigh?: number;
            fiftyTwoWeekLow?: number;
          };
          assetProfile?: { sector?: string };
        };

        const p = summary.price;
        const fin = summary.financialData;
        const detail = summary.summaryDetail;

        const enriched: EnrichedQuote = {
          ticker,
          name: p?.shortName ?? p?.longName ?? ticker,
          price: p?.regularMarketPrice ?? 0,
          dayChange: p?.regularMarketChange ?? 0,
          // quoteSummary price module returns regularMarketChangePercent as a decimal
          // fraction (e.g. 0.0123 for +1.23%), unlike quote() which returns the
          // percentage directly. Multiply by 100 to normalise to percentage form.
          dayChangePercent: (p?.regularMarketChangePercent ?? 0) * 100,
          analystRating: fin?.recommendationKey ? (RATING_MAP[fin.recommendationKey] ?? null) : null,
          analystTargetPrice: fin?.targetMeanPrice ?? null,
          analystCount: fin?.numberOfAnalystOpinions ?? 0,
          marketCap: p?.marketCap ?? null,
          peRatio: detail?.trailingPE ?? null,
          weekHigh52: detail?.fiftyTwoWeekHigh ?? null,
          weekLow52: detail?.fiftyTwoWeekLow ?? null,
          sector: summary.assetProfile?.sector ?? null,
        };

        result[ticker] = enriched;
        void recordYahooCall(true);
        await cacheSet(cacheKey, enriched, CACHE_TTL.STOCK_PRICE);
      } catch {
        void recordYahooCall(false);
        logger.warn('Failed to fetch enriched quote', { ticker });
      }
    })
  );

  return result;
}
