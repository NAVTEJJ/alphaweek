'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Trash2 } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import type { LiveHolding } from '@/lib/api';

function tickerHref(ticker: string, exchange: string): string {
  return `/ticker/${encodeURIComponent(ticker)}?exchange=${encodeURIComponent(exchange)}`;
}

// Static holding type (for the add-form preview / free plan fallback)
interface StaticHolding {
  ticker: string;
  exchange: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice?: number;
  weeklyChangePercent?: number;
}

function ChangeCell({ value }: { value?: number }) {
  if (value === undefined || value === null) return <span className="text-muted font-mono text-sm">—</span>;
  const isUp = value >= 0;
  const isFlat = Math.abs(value) < 0.01;

  return (
    <span
      className={cn(
        'flex items-center gap-1 font-mono text-sm',
        isFlat ? 'text-muted' : isUp ? 'text-profit' : 'text-loss'
      )}
    >
      {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {formatPercent(value)}
    </span>
  );
}

function RatingBadge({ rating }: { rating: string | null }) {
  if (!rating) return <span className="text-muted font-mono text-xs">—</span>;
  const color =
    rating === 'Strong Buy' ? 'text-profit bg-profit/10 border-profit/20' :
    rating === 'Buy' ? 'text-blue-400 bg-blue-400/10 border-blue-400/20' :
    rating === 'Hold' ? 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20' :
    rating === 'Sell' ? 'text-orange-400 bg-orange-400/10 border-orange-400/20' :
    'text-loss bg-loss/10 border-loss/20';
  return (
    <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border', color)}>
      {rating}
    </span>
  );
}

// ─── Live (enriched) table ────────────────────────────────────────────────────

interface LiveHoldingsTableProps {
  holdings: LiveHolding[];
  loading?: boolean;
  onRemove?: (ticker: string) => void;
  mode: 'live';
}

function LiveHoldingsTable({ holdings, loading, onRemove }: LiveHoldingsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (!holdings.length) {
    return (
      <div className="text-center py-12 text-muted text-sm">
        No holdings yet. Add your first stock to get portfolio-aware briefs.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Ticker</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Weight</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden md:table-cell">Value</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">P&L</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Today</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden lg:table-cell">Analyst</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden lg:table-cell">Target</th>
            <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden xl:table-cell">Sector</th>
            {onRemove && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((h) => (
            <tr key={h.ticker} className="hover:bg-surface-3/20 transition-colors">
              <td className="px-4 py-3">
                <Link href={tickerHref(h.ticker, h.exchange)} className="block group">
                  <span className="font-mono font-semibold text-slate-100 group-hover:text-primary-light transition-colors">{h.ticker}</span>
                  <p className="text-xs text-muted font-mono mt-0.5">{h.exchange}</p>
                </Link>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="font-mono text-slate-300 text-sm">{h.weight.toFixed(1)}%</span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-200 hidden md:table-cell">
                {formatCurrency(h.currentValue)}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span className={cn('font-mono text-sm', h.totalPnL >= 0 ? 'text-profit' : 'text-loss')}>
                    {h.totalPnL >= 0 ? '+' : ''}{formatCurrency(h.totalPnL)}
                  </span>
                  <ChangeCell value={h.totalPnLPercent} />
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <ChangeCell value={h.dayChange} />
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell">
                <RatingBadge rating={h.analystRating} />
              </td>
              <td className="px-4 py-3 text-right hidden lg:table-cell">
                {h.analystTargetPrice !== null ? (
                  <div className="flex flex-col items-end">
                    <span className="font-mono text-slate-200 text-sm">{formatCurrency(h.analystTargetPrice)}</span>
                    {h.analystUpside !== null && (
                      <span className={cn('text-xs font-mono', h.analystUpside >= 0 ? 'text-profit' : 'text-loss')}>
                        {h.analystUpside >= 0 ? '+' : ''}{h.analystUpside.toFixed(1)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted font-mono text-sm">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-left hidden xl:table-cell">
                <span className="text-xs text-muted font-mono">{h.sector ?? '—'}</span>
              </td>
              {onRemove && (
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemove(h.ticker)}
                    className="text-muted hover:text-loss transition-colors p-1 rounded"
                    title={`Remove ${h.ticker}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Static (basic) table ─────────────────────────────────────────────────────

interface StaticHoldingsTableProps {
  holdings: StaticHolding[];
  loading?: boolean;
  onRemove?: (ticker: string) => void;
  mode: 'static';
}

function StaticHoldingsTable({ holdings, loading, onRemove }: StaticHoldingsTableProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg bg-surface animate-pulse" />
        ))}
      </div>
    );
  }

  if (!holdings.length) {
    return (
      <div className="text-center py-12 text-muted text-sm">
        No holdings yet. Add your first stock to get portfolio-aware briefs.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Ticker</th>
            <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden sm:table-cell">Exchange</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Qty</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden md:table-cell">Avg. Buy</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Current</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Week Δ</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden lg:table-cell">P&L</th>
            {onRemove && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {holdings.map((h) => {
            const pnl =
              h.currentPrice !== undefined
                ? (h.currentPrice - h.avgBuyPrice) * h.quantity
                : undefined;

            return (
              <tr key={h.ticker} className="hover:bg-surface-3/20 transition-colors">
                <td className="px-4 py-3">
                  <Link href={tickerHref(h.ticker, h.exchange)} className="font-mono font-semibold text-slate-100 hover:text-primary-light transition-colors">
                    {h.ticker}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted hidden sm:table-cell">
                  <span className="font-mono text-xs">{h.exchange}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  {h.quantity.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300 hidden md:table-cell">
                  {formatCurrency(h.avgBuyPrice)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-100">
                  {h.currentPrice !== undefined ? formatCurrency(h.currentPrice) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <ChangeCell value={h.weeklyChangePercent} />
                </td>
                <td className="px-4 py-3 text-right hidden lg:table-cell">
                  {pnl !== undefined ? (
                    <span className={cn('font-mono text-sm', pnl >= 0 ? 'text-profit' : 'text-loss')}>
                      {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
                    </span>
                  ) : (
                    <span className="text-muted font-mono text-sm">—</span>
                  )}
                </td>
                {onRemove && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onRemove(h.ticker)}
                      className="text-muted hover:text-loss transition-colors p-1 rounded"
                      title={`Remove ${h.ticker}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Unified export ───────────────────────────────────────────────────────────

export type HoldingsTableProps =
  | LiveHoldingsTableProps
  | StaticHoldingsTableProps;

export function HoldingsTable(props: HoldingsTableProps) {
  if (props.mode === 'live') {
    return <LiveHoldingsTable {...props} />;
  }
  return <StaticHoldingsTable {...props} />;
}
