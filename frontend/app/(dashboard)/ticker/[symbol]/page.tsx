'use client';

import { useState, useMemo, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LineChart, Line, ResponsiveContainer, YAxis, XAxis, Tooltip, ReferenceLine } from 'recharts';
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus, Eye, EyeOff, Bell, AlertCircle, Loader2,
  ExternalLink, Briefcase, Calendar,
} from 'lucide-react';
import { fetchTickerDetail, PriceRange, TickerDetail, createPriceAlert, updateWatchlist, fetchWatchlist } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils';

const RANGES: PriceRange[] = ['1W', '1M', '3M', '1Y'];

function TickerDetailInner() {
  const params = useParams<{ symbol: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const qc = useQueryClient();

  const symbol = (params?.symbol ?? '').toUpperCase();
  const exchange = (search?.get('exchange') ?? 'NASDAQ').toUpperCase();
  const [range, setRange] = useState<PriceRange>('1M');

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['ticker-detail', symbol, exchange, range],
    queryFn: () => fetchTickerDetail(symbol, exchange, range),
    enabled: !!symbol,
    staleTime: 60_000,
  });

  const { mutate: toggleWatchlist, isPending: togglingWatchlist } = useMutation({
    mutationFn: async () => {
      const current = await fetchWatchlist();
      const next = current.tickers.includes(symbol)
        ? current.tickers.filter((t) => t !== symbol)
        : [...current.tickers, symbol];
      return updateWatchlist(next);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ticker-detail', symbol, exchange] });
      qc.invalidateQueries({ queryKey: ['watchlist'] });
      toast.success(detail?.inWatchlist ? `${symbol} removed from watchlist` : `${symbol} added to watchlist`);
    },
    onError: () => toast.error('Could not update watchlist.'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-light animate-spin" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-10 w-10 text-loss" />
        <p className="text-slate-300">No data for {symbol} on {exchange}</p>
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Go back
        </Button>
      </div>
    );
  }

  const isUp = detail.dayChangePercent > 0;
  const isFlat = Math.abs(detail.dayChangePercent) < 0.01;
  const colorClass = isFlat ? 'text-muted' : isUp ? 'text-profit' : 'text-loss';

  return (
    <div className="space-y-6 max-w-6xl">
      {/* ── Header bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={detail.inWatchlist ? 'outline' : 'primary'}
            onClick={() => toggleWatchlist()}
            loading={togglingWatchlist}
          >
            {detail.inWatchlist ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {detail.inWatchlist ? 'On watchlist' : 'Add to watchlist'}
          </Button>
          <SetAlertButton symbol={symbol} exchange={exchange} currentPrice={detail.price} />
        </div>
      </div>

      {/* ── Title + price block */}
      <div className="flex items-end justify-between gap-6 flex-wrap pb-4 border-b border-border">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-heading text-3xl text-white tracking-tight">{detail.ticker}</h1>
            <Badge variant="muted" className="text-xs">{detail.exchange}</Badge>
            {detail.sector && <span className="text-xs text-muted">{detail.sector}</span>}
          </div>
          <p className="text-sm text-muted mt-1 truncate max-w-md">{detail.longName ?? detail.name}</p>
        </div>
        <div className="text-right">
          <p className={cn('font-heading text-4xl font-bold', colorClass)}>
            {formatCurrency(detail.price, detail.currency)}
          </p>
          <p className={cn('flex items-center justify-end gap-1 font-mono text-sm mt-1', colorClass)}>
            {isFlat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isUp ? '+' : ''}{detail.dayChange.toFixed(2)} ({formatPercent(detail.dayChangePercent)}) today
          </p>
        </div>
      </div>

      {/* ── Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm text-muted font-mono uppercase tracking-wider">Price History</CardTitle>
            <div className="flex gap-1 p-0.5 bg-surface-2 rounded-lg border border-border">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    'px-2.5 py-1 text-xs font-mono rounded transition-colors',
                    range === r ? 'bg-primary text-white' : 'text-muted hover:text-slate-200'
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <PriceChart series={detail.series} previousClose={detail.previousClose ?? detail.price} />
        </CardContent>
      </Card>

      {/* ── Two-column: stats + analyst / your position */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Key stats (2/3) */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted font-mono uppercase tracking-wider">Key Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyStatsGrid detail={detail} />
          </CardContent>
        </Card>

        {/* Right: Analyst + Your position (1/3) */}
        <div className="space-y-4">
          <AnalystCard detail={detail} />
          {detail.userPosition && (
            <PositionCard symbol={symbol} position={detail.userPosition} currency={detail.currency} />
          )}
          {detail.nextEarningsDate && (
            <EarningsCard date={detail.nextEarningsDate} />
          )}
        </div>
      </div>

      {/* ── Description */}
      {detail.description && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted font-mono uppercase tracking-wider">About {detail.ticker}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 leading-relaxed">
              {detail.description.length > 600 ? detail.description.slice(0, 600) + '…' : detail.description}
            </p>
            {detail.industry && (
              <p className="text-xs text-muted mt-3">Industry: <span className="text-slate-300">{detail.industry}</span></p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── External link footer */}
      <div className="flex items-center justify-end pt-2">
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(detail.yahooTicker)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-muted hover:text-slate-200 transition-colors"
        >
          View on Yahoo Finance <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function PriceChart({ series, previousClose }: { series: TickerDetail['series']; previousClose: number }) {
  const data = useMemo(
    () => series.points.map((p) => ({ ...p, ts: new Date(p.date).getTime() })),
    [series.points]
  );

  if (data.length < 2) {
    return <div className="h-64 flex items-center justify-center text-sm text-muted">Insufficient price history</div>;
  }

  const lastPrice = data[data.length - 1].close;
  const firstPrice = data[0].close;
  const isUp = lastPrice >= firstPrice;
  const strokeColor = isUp ? '#22c55e' : '#ef4444';

  // Y-axis padding so the line doesn't kiss the top/bottom
  const minClose = Math.min(...data.map((d) => d.close));
  const maxClose = Math.max(...data.map((d) => d.close));
  const pad = (maxClose - minClose) * 0.08;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            interval="preserveStartEnd"
            stroke="#334155"
          />
          <YAxis
            domain={[minClose - pad, maxClose + pad]}
            tick={{ fill: '#64748b', fontSize: 10 }}
            tickFormatter={(v) => v.toFixed(2)}
            stroke="#334155"
            width={50}
            orientation="right"
          />
          <ReferenceLine y={previousClose} stroke="#475569" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#94a3b8' }}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(value: number) => [value.toFixed(2), 'Close']}
            labelFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: strokeColor, strokeWidth: 2, stroke: '#0f172a' }}
            fill="url(#lineGradient)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function KeyStatsGrid({ detail }: { detail: TickerDetail }) {
  const cells: { label: string; value: string }[] = [
    { label: 'Market Cap', value: detail.marketCap ? formatNumber(detail.marketCap) : '—' },
    { label: 'P/E (TTM)', value: detail.peRatio ? detail.peRatio.toFixed(1) : '—' },
    { label: 'Forward P/E', value: detail.forwardPE ? detail.forwardPE.toFixed(1) : '—' },
    { label: 'EPS (TTM)', value: detail.eps !== null ? detail.eps.toFixed(2) : '—' },
    { label: 'Beta', value: detail.beta ? detail.beta.toFixed(2) : '—' },
    { label: 'Dividend Yield', value: detail.dividendYield ? `${detail.dividendYield.toFixed(2)}%` : '—' },
    { label: 'Volume', value: detail.volume ? formatNumber(detail.volume) : '—' },
    { label: 'Avg Volume', value: detail.averageVolume ? formatNumber(detail.averageVolume) : '—' },
    { label: 'Day Range', value: detail.dayLow && detail.dayHigh ? `${detail.dayLow.toFixed(2)} – ${detail.dayHigh.toFixed(2)}` : '—' },
    { label: '52W Range', value: detail.weekLow52 && detail.weekHigh52 ? `${detail.weekLow52.toFixed(2)} – ${detail.weekHigh52.toFixed(2)}` : '—' },
    { label: 'Prev Close', value: detail.previousClose ? detail.previousClose.toFixed(2) : '—' },
    { label: 'Currency', value: detail.currency },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
      {cells.map((c) => (
        <div key={c.label} className="flex justify-between text-sm border-b border-border/40 pb-2">
          <span className="text-muted">{c.label}</span>
          <span className="font-mono text-slate-100">{c.value}</span>
        </div>
      ))}
    </div>
  );
}

function AnalystCard({ detail }: { detail: TickerDetail }) {
  if (!detail.analystRating && !detail.analystTargetPrice) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-muted font-mono uppercase tracking-wider">Analyst View</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted">No analyst coverage available.</p></CardContent>
      </Card>
    );
  }

  const upsideColor = (detail.analystUpside ?? 0) >= 0 ? 'text-profit' : 'text-loss';
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-muted font-mono uppercase tracking-wider">Analyst View</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {detail.analystRating && (
          <div>
            <p className="text-xs text-muted">Consensus</p>
            <p className="font-heading text-lg text-slate-100">{detail.analystRating}</p>
            <p className="text-xs text-muted mt-0.5">{detail.analystCount} analyst{detail.analystCount === 1 ? '' : 's'}</p>
          </div>
        )}
        {detail.analystTargetPrice && (
          <div className="pt-3 border-t border-border">
            <p className="text-xs text-muted">12mo Target</p>
            <p className="font-heading text-lg text-slate-100">{formatCurrency(detail.analystTargetPrice, detail.currency)}</p>
            {detail.analystUpside !== null && (
              <p className={cn('text-xs font-mono mt-0.5', upsideColor)}>
                {detail.analystUpside >= 0 ? '+' : ''}{detail.analystUpside.toFixed(1)}% from current
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PositionCard({ symbol, position, currency }: {
  symbol: string;
  position: NonNullable<TickerDetail['userPosition']>;
  currency: string;
}) {
  const isUp = position.pnL >= 0;
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Briefcase className="h-3.5 w-3.5 text-primary-light" />
          <CardTitle className="text-sm text-primary-light font-mono uppercase tracking-wider">Your Position</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Shares</span>
          <span className="font-mono text-slate-100">{position.quantity.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">Avg buy</span>
          <span className="font-mono text-slate-100">{formatCurrency(position.avgBuyPrice, currency)}</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted">Value</span>
          <span className="font-mono text-slate-100">{formatCurrency(position.currentValue, currency)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted">P&L</span>
          <span className={cn('font-mono', isUp ? 'text-profit' : 'text-loss')}>
            {isUp ? '+' : ''}{formatCurrency(position.pnL, currency)} ({formatPercent(position.pnLPercent)})
          </span>
        </div>
        <p className="text-[10px] text-muted pt-1">Click &ldquo;{symbol}&rdquo; in Portfolio to edit.</p>
      </CardContent>
    </Card>
  );
}

function EarningsCard({ date }: { date: string }) {
  const earningsDate = new Date(date);
  const daysAway = Math.ceil((earningsDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (daysAway < -7) return null; // hide stale earnings

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-accent" />
          <CardTitle className="text-sm text-muted font-mono uppercase tracking-wider">Next Earnings</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="font-heading text-base text-slate-100">
          {earningsDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {daysAway > 0 ? `In ${daysAway} day${daysAway === 1 ? '' : 's'}` : daysAway === 0 ? 'Today' : `${Math.abs(daysAway)} day${Math.abs(daysAway) === 1 ? '' : 's'} ago`}
        </p>
      </CardContent>
    </Card>
  );
}

function SetAlertButton({ symbol, exchange, currentPrice }: { symbol: string; exchange: string; currentPrice: number }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const toast = useToast();
  const qc = useQueryClient();

  const { mutate: create, isPending } = useMutation({
    mutationFn: () => createPriceAlert({
      ticker: symbol,
      exchange,
      targetPrice: parseFloat(target),
      direction,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-alerts'] });
      toast.success(`Alert set: ${symbol} ${direction} ${target}`);
      setOpen(false);
      setTarget('');
    },
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast.error(err?.response?.data?.error ?? 'Could not create alert'),
  });

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Bell className="h-4 w-4" /> Set alert
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-surface border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div>
              <p className="text-xs text-muted font-mono uppercase tracking-wider mb-1">Set price alert</p>
              <p className="font-heading text-lg text-white">{symbol}</p>
              <p className="text-xs text-muted">Currently at {currentPrice.toFixed(2)}</p>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['above', 'below'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDirection(d)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm border transition-colors',
                      direction === d ? 'bg-primary/15 border-primary/30 text-primary-light' : 'bg-surface-2 border-border text-muted hover:text-slate-200'
                    )}
                  >
                    {d === 'above' ? '↑ Crosses above' : '↓ Drops below'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target price"
                step="any"
                min="0"
                className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                variant="primary"
                className="flex-1"
                loading={isPending}
                disabled={!target || parseFloat(target) <= 0}
                onClick={() => create()}
              >
                Set alert
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TickerDetailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 text-primary-light animate-spin" /></div>}>
      <TickerDetailInner />
    </Suspense>
  );
}
