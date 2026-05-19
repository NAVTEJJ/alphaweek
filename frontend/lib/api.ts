import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// Bare axios instance — token injection is handled by useApiAuth() in DashboardShell
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Types: User ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  name?: string | null;
  plan: 'free' | 'starter' | 'pro' | 'elite' | 'whitelabel';
  telegramChatId?: string | null;
  referralCode: string;
  referredBy?: string | null;
  createdAt: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export async function fetchProfile() {
  const { data } = await api.get('/user/profile');
  return data.data as UserProfile;
}

export async function updateProfile(payload: { name?: string; telegramChatId?: string }) {
  const { data } = await api.put('/user/profile', payload);
  return data.data;
}

export async function fetchAlerts() {
  const { data } = await api.get('/user/alerts');
  return data.data as unknown[];
}

export async function markAlertRead(id: string) {
  await api.patch(`/user/alerts/${id}/read`);
}


// ─── Briefs ───────────────────────────────────────────────────────────────────

export async function fetchBriefs(page = 1, limit = 10) {
  const { data } = await api.get('/briefs', { params: { page, limit } });
  return data as { data: BriefSummary[]; meta: BriefMeta };
}

export async function fetchLatestBrief() {
  const { data } = await api.get('/briefs/latest');
  return data.data as BriefDetail;
}

export async function fetchBrief(id: string) {
  const { data } = await api.get(`/briefs/${id}`);
  return data.data as BriefDetail;
}

export async function triggerBriefGeneration() {
  const { data } = await api.post('/briefs/generate');
  return data.data as { briefId: string; weekOf: string; status: string };
}

export async function fetchBriefPreview(id: string) {
  const { data } = await axios.get(`${API_URL}/briefs/preview/${id}`);
  return data.data as BriefPreview;
}

export interface SampleBrief {
  content: string;
  weekOf: string;
  mood: string | null;
  moodReason: string | null;
  briefSummary: string | null;
  closingQuestion: string | null;
  generatedAt: string;
  isDemo: true;
  demoPortfolio: { ticker: string; exchange: string; quantity: number }[];
}

export async function fetchInstantPreview(): Promise<{ content: string; generatedAt: string; isPreview: true }> {
  const { data } = await api.get('/briefs/instant-preview');
  return data.data;
}

export async function fetchSampleBrief(): Promise<SampleBrief> {
  const { data } = await axios.get(`${API_URL}/briefs/sample`);
  return data.data as SampleBrief;
}

export async function applyReferralCode(code: string) {
  const { data } = await api.post('/user/referral/apply', { code });
  return data.data as { applied: boolean; message: string };
}

export interface ReferralStats {
  referralCount: number;
  recentReferrals: { displayName: string; joinedAt: string }[];
}

export async function fetchReferralStats() {
  const { data } = await api.get('/user/referral/stats');
  return data.data as ReferralStats;
}

export async function fetchSignedBriefPdfUrl(briefId: string) {
  const { data } = await api.get(`/briefs/${briefId}/pdf`);
  return data.data as { url: string; expiresInSeconds: number };
}

export async function fetchOnboardedStatus() {
  const { data } = await api.get('/user/onboarded');
  return data.data as { completed: boolean };
}

export async function markOnboarded() {
  const { data } = await api.post('/user/onboarded');
  return data.data as { completed: boolean };
}

export async function fetchEmailSubscription() {
  const { data } = await api.get('/user/email-subscription');
  return data.data as { subscribed: boolean };
}

export async function updateEmailSubscription(subscribed: boolean) {
  const { data } = await api.put('/user/email-subscription', { subscribed });
  return data.data as { subscribed: boolean };
}

// ─── Ticker detail ───────────────────────────────────────────────────────────

export type PriceRange = '1W' | '1M' | '3M' | '1Y';

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
  description: string | null;
  analystRating: string | null;
  analystTargetPrice: number | null;
  analystCount: number;
  analystUpside: number | null;
  nextEarningsDate: string | null;
  series: { range: PriceRange; points: { date: string; close: number }[] };
  inWatchlist: boolean;
  userPosition: null | {
    quantity: number;
    avgBuyPrice: number;
    currentValue: number;
    costBasis: number;
    pnL: number;
    pnLPercent: number;
  };
  fetchedAt: string;
}

// ─── Ticker search (autocomplete) ────────────────────────────────────────────

export interface TickerSearchResult {
  ticker: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  quoteType: string;
}

export async function searchTickers(query: string): Promise<TickerSearchResult[]> {
  if (!query.trim()) return [];
  const { data } = await api.get('/market/search', { params: { q: query } });
  return (data.data ?? []) as TickerSearchResult[];
}

export async function fetchTickerDetail(symbol: string, exchange: string, range: PriceRange = '1M') {
  const { data } = await api.get(`/market/ticker/${encodeURIComponent(symbol)}`, {
    params: { exchange, range },
  });
  return data.data as TickerDetail;
}

// ─── Brief feedback ──────────────────────────────────────────────────────────

export interface BriefFeedback {
  up: number;
  down: number;
  myVote: 'up' | 'down' | null;
}

export async function fetchBriefFeedback(briefId: string) {
  const { data } = await api.get(`/briefs/${briefId}/feedback`);
  return data.data as BriefFeedback;
}

export async function submitBriefFeedback(briefId: string, vote: 'up' | 'down', reason?: string) {
  const { data } = await api.post(`/briefs/${briefId}/feedback`, { vote, reason });
  return data.data as BriefFeedback;
}

export interface BriefQueueStatus {
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
  positionInQueue: number | null;
  ahead: number | null;
  estimatedSecondsUntilStart: number | null;
  estimatedSecondsUntilComplete: number | null;
}

export async function fetchBriefQueueStatus(briefId: string) {
  const { data } = await api.get(`/briefs/${briefId}/queue-status`);
  return data.data as BriefQueueStatus;
}

export interface BriefDiff {
  topChanges: string[];
  newTickersHighlighted: string[];
  removedTickersHighlighted: string[];
  sentimentShift: string;
  summary: string;
  empty: boolean;
}

export async function fetchBriefDiff(briefId: string) {
  const { data } = await api.get(`/briefs/${briefId}/diff`);
  return data.data as BriefDiff;
}

// ─── Chat history (server-side) ──────────────────────────────────────────────

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

export async function fetchChatHistory() {
  const { data } = await api.get('/chat/history');
  return (data.data ?? []) as ChatHistoryMessage[];
}

export async function clearChatHistoryServer() {
  await api.delete('/chat/history');
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export async function fetchPortfolio() {
  const { data } = await api.get('/portfolio');
  return data.data as { id?: string; holdings: PortfolioHolding[]; updatedAt?: string };
}

export async function updatePortfolio(holdings: PortfolioHolding[]) {
  const { data } = await api.put('/portfolio', { holdings });
  return data.data as { holdings: PortfolioHolding[] };
}

export async function fetchLivePortfolio() {
  const { data } = await api.get('/portfolio/live');
  return data.data as LivePortfolioResult;
}

export async function fetchWatchlist() {
  const { data } = await api.get('/portfolio/watchlist');
  return data.data as { tickers: string[]; updatedAt?: string };
}

export async function updateWatchlist(tickers: string[]) {
  const { data } = await api.put('/portfolio/watchlist', { tickers });
  return data.data as { tickers: string[] };
}

// ─── Telegram ────────────────────────────────────────────────────────────────

export async function startTelegramConnect() {
  const { data } = await api.post('/user/telegram/connect');
  return data.data as { token: string; deeplink: string };
}

export async function getTelegramStatus() {
  const { data } = await api.get('/user/telegram/status');
  return data.data as { connected: boolean; chatId: string | null };
}

export async function disconnectTelegram() {
  await api.delete('/user/telegram/disconnect');
}

// ─── WhiteLabel API Keys ──────────────────────────────────────────────────────

export async function fetchApiKeys() {
  const { data } = await api.get('/user/api-keys');
  return data.data as ApiKeyRecord[];
}

export async function createApiKey(name: string) {
  const { data } = await api.post('/user/api-keys', { name });
  return data.data as ApiKeyRecord & { key: string };
}

export async function deleteApiKey(id: string) {
  await api.delete(`/user/api-keys/${id}`);
}

// ─── Price Alerts ─────────────────────────────────────────────────────────────

export async function fetchPriceAlerts() {
  const { data } = await api.get('/alerts/price');
  return data.data as PriceAlert[];
}

export async function createPriceAlert(payload: {
  ticker: string;
  exchange: string;
  targetPrice: number;
  direction: 'above' | 'below';
}) {
  const { data } = await api.post('/alerts/price', payload);
  return data.data as PriceAlert;
}

export async function deletePriceAlert(id: string) {
  await api.delete(`/alerts/price/${id}`);
}

// ─── Earnings Calendar ────────────────────────────────────────────────────────

export async function fetchEarningsCalendar() {
  const { data } = await api.get('/market/earnings');
  return data.data as EarningsEvent[];
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BriefSummary {
  id: string;
  briefType?: 'weekly' | 'daily';
  weekOf: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  planAtGeneration: string;
  pdfUrl?: string | null;
  generatedAt?: string | null;
  createdAt: string;
}

export interface BriefDetail extends BriefSummary {
  content?: string | null;
  aiTokensUsed?: number | null;
  errorMessage?: string | null;
  mood?: string | null;
  moodReason?: string | null;
  briefSummary?: string | null;
  closingQuestion?: string | null;
  publicSlug?: string | null;
}

export interface SharedBriefData {
  id: string;
  weekOf: string;
  generatedAt: string | null;
  mood: string | null;
  moodReason: string | null;
  briefSummary: string | null;
  preview: string;
  isTruncated: boolean;
}

export async function fetchSharedBrief(slug: string): Promise<SharedBriefData> {
  const { data } = await axios.get(`${API_URL}/briefs/share/${slug}`);
  return data.data as SharedBriefData;
}

export interface BriefMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BriefPreview {
  id: string;
  weekOf: string;
  planAtGeneration: string;
  generatedAt?: string | null;
  preview: string;
  isTruncated: boolean;
}

export interface PortfolioHolding {
  ticker: string;
  exchange: 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO';
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
  weeklyChangePercent?: number;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  exchange: string;
  targetPrice: number;
  direction: 'above' | 'below';
  triggered: boolean;
  triggeredAt?: string | null;
  createdAt: string;
}

export interface EarningsEvent {
  ticker: string;
  name: string;
  earningsDate: string;
  earningsDateEnd?: string | null;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface LiveHolding {
  ticker: string;
  name: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  currentValue: number;
  costBasis: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangeDollar: number;
  weight: number;
  analystRating: string | null;
  analystTargetPrice: number | null;
  analystUpside: number | null;
  analystCount: number;
  sector: string | null;
  marketCap: number | null;
  peRatio: number | null;
  weekHigh52: number | null;
  weekLow52: number | null;
}

export interface PortfolioHealthResult {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: {
    diversification: { score: number; max: number; label: string };
    concentration: { score: number; max: number; label: string };
    analystSentiment: { score: number; max: number; label: string };
    profitability: { score: number; max: number; label: string };
  };
  topRisk: string;
}

export interface LivePortfolioResult {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dayChange: number;
  dayChangePercent: number;
  benchmarkDayChangePercent: number | null;
  health: PortfolioHealthResult;
  holdings: LiveHolding[];
  sectorAllocation: Record<string, number>;
  lastUpdated: string;
}
