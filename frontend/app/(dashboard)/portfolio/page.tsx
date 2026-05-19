'use client';

import { useState } from 'react';
import { usePortfolio, useLivePortfolio, useWatchlist } from '@/lib/hooks';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePortfolio, updateWatchlist } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { HoldingsTable } from '@/components/portfolio/HoldingsTable';
import { PortfolioSummary } from '@/components/portfolio/PortfolioSummary';
import { CsvImport } from '@/components/portfolio/CsvImport';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TickerSearch } from '@/components/ui/ticker-search';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  Briefcase,
  Eye,
  Plus,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { trackEvent, Events } from '@/lib/analytics';
import { cn } from '@/lib/utils';

type Exchange = 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO';

interface HoldingInput {
  ticker: string;
  exchange: Exchange;
  quantity: number;
  avgBuyPrice: number;
}

const EXCHANGE_OPTIONS: Exchange[] = ['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO'];

export default function PortfolioPage() {
  const { data: portfolio, isLoading: portfolioLoading } = usePortfolio();
  const { data: liveData, isLoading: liveLoading, isFetching: liveFetching, refetch: refetchLive } = useLivePortfolio();
  const { data: watchlist, isLoading: watchlistLoading } = useWatchlist();
  const qc = useQueryClient();

  const toast = useToast();
  const [newTicker, setNewTicker] = useState('');
  const [newHolding, setNewHolding] = useState<HoldingInput>({
    ticker: '',
    exchange: 'NASDAQ',
    quantity: 0,
    avgBuyPrice: 0,
  });

  const { mutate: savePortfolio, isPending: savingPortfolio } = useMutation({
    mutationFn: (holdings: HoldingInput[]) => updatePortfolio(holdings),
    onSuccess: (_, holdings) => {
      qc.invalidateQueries({ queryKey: ['portfolio'] });
      qc.invalidateQueries({ queryKey: ['portfolio', 'live'] });
      trackEvent(Events.PORTFOLIO_UPDATED, { holdingsCount: holdings.length });
      toast.success(`Portfolio saved — ${holdings.length} holding${holdings.length !== 1 ? 's' : ''}`);
    },
    onError: () => {
      toast.error('Failed to save portfolio. Try again.');
    },
  });

  const { mutate: saveWatchlist, isPending: savingWatchlist } = useMutation({
    mutationFn: (tickers: string[]) => updateWatchlist(tickers),
    onSuccess: (_, tickers) => {
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      trackEvent(Events.WATCHLIST_UPDATED, { tickerCount: tickers.length });
      toast.success(`Watchlist updated — ${tickers.length} ticker${tickers.length !== 1 ? 's' : ''}`);
    },
    onError: () => {
      toast.error('Failed to update watchlist. Try again.');
    },
  });

  const holdings: HoldingInput[] = Array.isArray(portfolio?.holdings) ? portfolio.holdings : [];
  const tickers: string[] = Array.isArray(watchlist?.tickers) ? watchlist.tickers : [];

  const hasMixedCurrencies = holdings.some((h) => h.exchange === 'NSE' || h.exchange === 'BSE') &&
    holdings.some((h) => h.exchange === 'NASDAQ' || h.exchange === 'NYSE' || h.exchange === 'CRYPTO');

  function addHolding() {
    if (!newHolding.ticker || newHolding.quantity <= 0 || newHolding.avgBuyPrice <= 0) return;
    savePortfolio([...holdings, { ...newHolding, ticker: newHolding.ticker.toUpperCase() }]);
    setNewHolding({ ticker: '', exchange: 'NASDAQ', quantity: 0, avgBuyPrice: 0 });
  }

  function removeHolding(ticker: string) {
    savePortfolio(holdings.filter((h) => h.ticker !== ticker));
  }

  function addTicker() {
    const t = newTicker.trim().toUpperCase();
    if (!t || tickers.includes(t)) return;
    saveWatchlist([...tickers, t]);
    setNewTicker('');
  }

  function removeTicker(t: string) {
    saveWatchlist(tickers.filter((tk) => tk !== t));
  }

  const showLive = !portfolioLoading && holdings.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl text-white">Portfolio</h1>
          <p className="text-muted text-sm mt-1">
            Track your holdings for personalized AI brief analysis
          </p>
        </div>
        {showLive && (
          <button
            type="button"
            onClick={() => refetchLive()}
            disabled={liveFetching}
            className={cn(
              'flex items-center gap-1.5 text-xs text-muted hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg border border-border',
              liveFetching && 'opacity-50'
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', liveFetching && 'animate-spin')} />
            Refresh prices
          </button>
        )}
      </div>

      {/* Mixed-currency warning */}
      {hasMixedCurrencies && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Your portfolio mixes INR (NSE/BSE) and USD holdings. Total values shown in USD — INR positions use live USD/INR conversion but may not reflect exact broker prices.
          </span>
        </div>
      )}

      {/* Live summary — shown when user has holdings */}
      {showLive && (
        liveLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : liveData ? (
          <PortfolioSummary data={liveData} />
        ) : null
      )}

      {/* Holdings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary-light" />
              <CardTitle>Holdings</CardTitle>
              <Badge variant="muted">{holdings.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <>
              {/* Use live-enriched table when data is available, fall back to static */}
              {liveData && liveData.holdings.length > 0 ? (
                <HoldingsTable
                  mode="live"
                  holdings={liveData.holdings}
                  loading={liveLoading}
                  onRemove={removeHolding}
                />
              ) : (
                <HoldingsTable
                  mode="static"
                  holdings={holdings}
                  loading={portfolioLoading}
                  onRemove={removeHolding}
                />
              )}

              {/* Add holding form */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-medium text-muted uppercase tracking-wider mb-3">
                  Add Holding
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <TickerSearch
                    value={newHolding.ticker}
                    onValueChange={(v) => setNewHolding((h) => ({ ...h, ticker: v.toUpperCase() }))}
                    onPick={(r) => setNewHolding((h) => ({
                      ...h,
                      ticker: r.ticker,
                      exchange: r.exchange as Exchange,
                    }))}
                    placeholder="Search ticker…"
                    ariaLabel="Search ticker"
                  />
                  <select
                    aria-label="Exchange"
                    value={newHolding.exchange}
                    onChange={(e) => setNewHolding((h) => ({ ...h, exchange: e.target.value as Exchange }))}
                    className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    {EXCHANGE_OPTIONS.map((ex) => <option key={ex}>{ex}</option>)}
                  </select>
                  <Input
                    type="number"
                    placeholder="Quantity"
                    min={0}
                    step="any"
                    value={newHolding.quantity || ''}
                    onChange={(e) => setNewHolding((h) => ({ ...h, quantity: parseFloat(e.target.value) || 0 }))}
                  />
                  <Input
                    type="number"
                    placeholder="Avg. Buy Price"
                    min={0}
                    step="any"
                    value={newHolding.avgBuyPrice || ''}
                    onChange={(e) => setNewHolding((h) => ({ ...h, avgBuyPrice: parseFloat(e.target.value) || 0 }))}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={addHolding}
                    loading={savingPortfolio}
                    className="col-span-2 md:col-span-1"
                  >
                    <Plus className="h-4 w-4" /> Add
                  </Button>
                </div>
              </div>
          </>
        </CardContent>
        {holdings.length > 0 && (
          <CardFooter className="justify-end">
            <p className="text-xs text-muted mr-auto">
              {liveData
                ? `Prices updated · ${new Date(liveData.lastUpdated).toLocaleTimeString()}`
                : 'Changes save automatically when you add or remove holdings.'}
            </p>
          </CardFooter>
        )}
      </Card>

      {/* Watchlist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-accent" />
              <CardTitle>Watchlist</CardTitle>
              <Badge variant="muted">{tickers.length}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <>
              <div className="flex flex-wrap gap-2 mb-4 min-h-[2.5rem]">
                {watchlistLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-7 w-16 rounded bg-surface animate-pulse" />
                    ))
                  : tickers.map((t) => (
                      <span
                        key={t}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-surface-2 border border-border text-sm font-mono text-slate-200"
                      >
                        <Link
                          href={`/ticker/${encodeURIComponent(t)}?exchange=NASDAQ`}
                          className="hover:text-primary-light transition-colors"
                        >
                          {t}
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeTicker(t)}
                          aria-label={`Remove ${t}`}
                          className="text-muted hover:text-loss transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                {tickers.length === 0 && !watchlistLoading && (
                  <p className="text-sm text-muted">No tickers yet. Add your first below.</p>
                )}
              </div>

              <div className="flex gap-3">
                <div className="flex-1 max-w-xs">
                  <TickerSearch
                    value={newTicker}
                    onValueChange={(v) => setNewTicker(v.toUpperCase())}
                    onPick={(r) => {
                      // For the watchlist we only need the bare symbol; the
                      // user can re-pick a different exchange when they hold it.
                      const t = r.ticker.trim().toUpperCase();
                      if (t && !tickers.includes(t)) {
                        saveWatchlist([...tickers, t]);
                        setNewTicker('');
                      }
                    }}
                    placeholder="Add ticker (e.g. AAPL)"
                    ariaLabel="Add to watchlist"
                  />
                </div>
                <Button variant="primary" size="sm" onClick={addTicker} loading={savingWatchlist}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
          </>
        </CardContent>
      </Card>

      {/* CSV Import */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Import from CSV</CardTitle>
          <p className="text-xs text-muted mt-1">
            Upload a CSV export from any broker (Fidelity, Schwab, Robinhood, Zerodha, etc.)
          </p>
        </CardHeader>
        <CardContent>
          <CsvImport />
        </CardContent>
      </Card>
    </div>
  );
}
