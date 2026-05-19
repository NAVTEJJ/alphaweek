'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, SlidersHorizontal } from 'lucide-react';

// Screener results come from Yahoo's US presets, so default to NASDAQ. The
// ticker detail page will redirect if Yahoo returns it under a different
// exchange (e.g. NYSE-listed companies still resolve fine via the bare ticker).
function tickerHref(ticker: string): string {
  return `/ticker/${encodeURIComponent(ticker)}?exchange=NASDAQ`;
}

interface ScreenerStock {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number | null;
  peRatio: number | null;
  sector: string | null;
  analystRating: string | null;
}

const PRESETS: { id: string; label: string }[] = [
  { id: 'most_actives', label: 'Most Active' },
  { id: 'day_gainers', label: 'Top Gainers' },
  { id: 'day_losers', label: 'Top Losers' },
  { id: 'undervalued_growth_stocks', label: 'Undervalued Growth' },
  { id: 'growth_technology_stocks', label: 'Tech Growth' },
  { id: 'aggressive_small_caps', label: 'Small Caps' },
  { id: 'undervalued_large_caps', label: 'Undervalued Large Cap' },
  { id: 'strong_undervalued_stocks', label: 'Strong Undervalued' },
];

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

function formatMarketCap(mc: number | null): string {
  if (!mc) return '—';
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(1)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(0)}M`;
  return `$${mc.toLocaleString()}`;
}

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-muted text-xs font-mono">—</span>;
  const color =
    rating === 'Strong Buy' ? 'text-profit bg-profit/10 border-profit/20' :
    rating === 'Buy' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
    rating === 'Hold' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' :
    'text-loss bg-loss/10 border-loss/20';
  return <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border', color)}>{rating}</span>;
}

function ChangeCell({ value }: { value: number }) {
  const flat = Math.abs(value) < 0.01;
  return (
    <span className={cn('flex items-center gap-1 font-mono text-sm', flat ? 'text-muted' : value > 0 ? 'text-profit' : 'text-loss')}>
      {flat ? <Minus className="h-3 w-3" /> : value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatPercent(value)}
    </span>
  );
}

export default function ScreenerPage() {
  const [screen, setScreen] = useState('most_actives');
  const [maxPE, setMaxPE] = useState('');
  const [minPrice, setMinPrice] = useState('');

  const params: Record<string, string> = { screen, limit: '25' };
  if (maxPE) params.maxPE = maxPE;
  if (minPrice) params.minPrice = minPrice;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['screener', screen, maxPE, minPrice],
    queryFn: async () => {
      const { data } = await api.get('/screener', { params });
      return data.data as { screen: string; count: number; results: ScreenerStock[] };
    },
    staleTime: 60_000,
  });

  const results = data?.results ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-2xl text-white">Stock Screener</h1>
          <p className="text-muted text-sm mt-1">Powered by Yahoo Finance · prices may be delayed up to 15 minutes</p>
        </div>
        {isFetching && (
          <span className="text-xs text-muted animate-pulse">Refreshing…</span>
        )}
      </div>

      {/* Preset selector */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setScreen(p.id)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              screen === p.id
                ? 'bg-primary/20 border-primary/30 text-primary-light'
                : 'bg-surface border-border text-muted hover:text-slate-200 hover:bg-surface-2'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-primary-light" />
            <CardTitle className="text-sm">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="text-xs text-muted block mb-1">Min Price ($)</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 5"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Max P/E</label>
              <input
                type="number"
                min="0"
                placeholder="e.g. 30"
                value={maxPE}
                onChange={(e) => setMaxPE(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            {(minPrice || maxPE) && (
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => { setMinPrice(''); setMaxPE(''); }}
                  className="text-xs text-muted hover:text-slate-300 transition-colors pb-2"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>Results</CardTitle>
            {data && <Badge variant="muted">{data.count}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-surface animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <p className="text-center text-muted text-sm py-12">No results match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-2/50">
                    <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Ticker</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Price</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Change</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden md:table-cell">Volume</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden lg:table-cell">Mkt Cap</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden lg:table-cell">P/E</th>
                    <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden xl:table-cell">Sector</th>
                    <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden xl:table-cell">Analyst</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {results.map((stock) => (
                    <tr key={stock.ticker} className="hover:bg-surface-3/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={tickerHref(stock.ticker)} className="block group">
                          <span className="font-mono font-semibold text-slate-100 group-hover:text-primary-light transition-colors">{stock.ticker}</span>
                          <p className="text-xs text-muted truncate max-w-[140px]">{stock.name}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-100">
                        {formatCurrency(stock.price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChangeCell value={stock.changePercent} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 hidden md:table-cell">
                        {formatVolume(stock.volume)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 hidden lg:table-cell">
                        {formatMarketCap(stock.marketCap)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-400 hidden lg:table-cell">
                        {stock.peRatio !== null ? stock.peRatio.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-3 text-left hidden xl:table-cell">
                        <span className="text-xs text-muted font-mono">{stock.sector ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell">
                        <RatingBadge rating={stock.analystRating} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
