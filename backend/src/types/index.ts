// ─── Database row types ───────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  stripe_customer_id: string | null;
  plan: 'free' | 'starter' | 'pro' | 'elite' | 'whitelabel';
  telegram_chat_id: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
}

export interface DbPortfolio {
  id: string;
  user_id: string;
  holdings: PortfolioHolding[];
  updated_at: string;
}

export interface DbWatchlist {
  id: string;
  user_id: string;
  tickers: string[];
  updated_at: string;
}

export interface DbBrief {
  id: string;
  user_id: string;
  content: string;
  pdf_url: string | null;
  week_of: string;
  plan_at_generation: string;
  created_at: string;
}

export interface DbSubscription {
  id: string;
  user_id: string;
  stripe_sub_id: string;
  plan: string;
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid';
  renewed_at: string | null;
  created_at: string;
}

export interface DbAlert {
  id: string;
  user_id: string;
  type: 'brief_failed' | 'geopolitical' | 'rebalancing' | 'system';
  message: string;
  sent_at: string | null;
  read_at: string | null;
  created_at: string;
}

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface PortfolioHolding {
  ticker: string;
  name?: string;
  quantity: number;
  avgBuyPrice: number;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO';
  currency?: 'USD' | 'INR';
}

export interface MarketSnapshot {
  us: {
    sp500: MarketIndex;
    nasdaq: MarketIndex;
    dowJones: MarketIndex;
    topGainers: StockMove[];
    topLosers: StockMove[];
    fearGreedIndex: number | null;
  };
  india: {
    nifty50: MarketIndex;
    sensex: MarketIndex;
    topGainers: StockMove[];
    topLosers: StockMove[];
    fiiFlow: string | null;
  };
  crypto: {
    bitcoin: CryptoSnapshot;
    ethereum: CryptoSnapshot;
    totalMarketCap: number;
    totalMarketCapChange7d: number;
    fearGreedIndex: number;
    fearGreedLabel: string;
    topGainers: CryptoMove[];
    topLosers: CryptoMove[];
  };
  global: {
    usdInr: number;
    eurUsd: number;
    brentCrude: number;
    gold: number;
    events: string[];
  };
  fetchedAt: string;
}

export interface MarketIndex {
  value: number;
  change: number;
  changePercent: number;
}

export interface StockMove {
  ticker: string;
  name: string;
  change: number;
  changePercent: number;
  price: number;
}

export interface CryptoSnapshot {
  price: number;
  change7d: number;
  change7dPercent: number;
  marketCap: number;
}

export interface CryptoMove {
  symbol: string;
  name: string;
  change7d: number;
  change7dPercent: number;
}

export interface GeoEvent {
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  impactScore: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'TRADE' | 'MONETARY_POLICY' | 'CONFLICT' | 'ENERGY' | 'TECH_REGULATION' | 'OTHER';
  marketImplication: string;
}

export interface PortfolioAnalysis {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  weeklyChange: number;
  weeklyChangePercent: number;
  benchmarkReturn: number;
  sectorAllocation: Record<string, number>;
  holdings: HoldingAnalysis[];
}

export interface HoldingAnalysis extends PortfolioHolding {
  currentPrice: number;
  currentValue: number;
  pnL: number;
  pnLPercent: number;
  weeklyChange: number;
  weeklyChangePercent: number;
  recommendation: 'HOLD' | 'WATCH' | 'REVIEW';
  recommendationReason: string;
}

export interface BriefGenerationJob {
  userId: string;
  weekOf: string;
  plan: string;
  briefId: string;
  briefType?: 'weekly' | 'daily';
}

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
}
