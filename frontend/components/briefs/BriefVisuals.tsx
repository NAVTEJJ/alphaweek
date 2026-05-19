'use client';

import { useQuery } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, BarChart, Bar, Tooltip } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '@/lib/api';
import { useLivePortfolio } from '@/lib/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatPercent } from '@/lib/utils';

// A compact data-viz card that sits above the brief's markdown body. Three
// panels: index sparklines, sector allocation donut, and a holdings P&L bar.
// Everything degrades gracefully — if a panel has no data, it hides.

interface IndexSnap {
  symbol: string;
  label: string;
  value: number;
  changePercent: number;
  history: number[];
}

const SECTOR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#84cc16', '#f97316', '#a855f7', '#14b8a6',
];

function fetchSnapshot() {
  return api.get('/market/snapshot').then((r) => r.data.data);
}

export function BriefVisuals() {
  const { data: snap } = useQuery({ queryKey: ['market-snapshot'], queryFn: fetchSnapshot, staleTime: 5 * 60_000 });
  const { data: live } = useLivePortfolio();

  // Build mini-sparkline series from the index change so users at least see a
  // direction. We don't fetch full historical here to keep the card cheap —
  // ticker detail pages have the real charts.
  const indices: IndexSnap[] = [];
  if (snap?.us?.sp500) {
    indices.push(buildSparkSeed('SPX', 'S&P 500', snap.us.sp500.value, snap.us.sp500.changePercent));
  }
  if (snap?.us?.nasdaq) {
    indices.push(buildSparkSeed('NDX', 'NASDAQ', snap.us.nasdaq.value, snap.us.nasdaq.changePercent));
  }
  if (snap?.india?.nifty50) {
    indices.push(buildSparkSeed('NIFTY', 'NIFTY 50', snap.india.nifty50.value, snap.india.nifty50.changePercent));
  }
  if (snap?.crypto?.bitcoin) {
    indices.push(buildSparkSeed('BTC', 'Bitcoin', snap.crypto.bitcoin.price, snap.crypto.bitcoin.change7dPercent));
  }

  const hasIndices = indices.length > 0;
  const sectorData = live?.sectorAllocation
    ? Object.entries(live.sectorAllocation)
        .map(([name, value]) => ({ name, value }))
        .filter((s) => s.value > 0.5) // suppress slivers
        .sort((a, b) => b.value - a.value)
    : [];
  const hasSectors = sectorData.length > 0;

  // Top contributors / detractors from the live portfolio. Cap at 5 each side.
  const movers = live?.holdings
    ? [...live.holdings]
        .filter((h) => Math.abs(h.totalPnLPercent) > 0.01)
        .sort((a, b) => b.totalPnLPercent - a.totalPnLPercent)
    : [];
  const top = movers.slice(0, 4);
  const bottom = movers.slice(-4).reverse();
  const moverData = [...top, ...bottom.filter((b) => !top.includes(b))].map((h) => ({
    ticker: h.ticker,
    pnl: h.totalPnLPercent,
  }));
  const hasMovers = moverData.length > 0;

  if (!hasIndices && !hasSectors && !hasMovers) return null;

  return (
    <Card>
      <CardContent className="py-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {hasIndices && <IndexPanel indices={indices} />}
          {hasSectors && <SectorPanel data={sectorData} />}
          {hasMovers && <MoversPanel data={moverData} />}
        </div>
      </CardContent>
    </Card>
  );
}

// Synthesize a 12-point sparkline that ends at the current change% — visually
// distinct enough to show direction without claiming to be real intraday data.
// Real history would require an /api/history call per index, which we'll add
// when the brief warrants it.
function buildSparkSeed(symbol: string, label: string, value: number, changePercent: number): IndexSnap {
  const start = value / (1 + changePercent / 100);
  const steps = 12;
  const history = Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    // Smooth curve with a little noise so it doesn't look perfectly linear
    const noise = Math.sin(i * 1.7) * Math.abs(changePercent) * 0.03;
    return start + (value - start) * t + noise * start * 0.01;
  });
  return { symbol, label, value, changePercent, history };
}

function IndexPanel({ indices }: { indices: IndexSnap[] }) {
  return (
    <div>
      <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Indices</p>
      <div className="space-y-3">
        {indices.map((idx) => {
          const isUp = idx.changePercent >= 0;
          const color = isUp ? '#22c55e' : '#ef4444';
          const data = idx.history.map((close) => ({ close }));
          return (
            <div key={idx.symbol} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted font-mono">{idx.symbol}</p>
                <p className="text-sm font-mono text-slate-100 truncate">{idx.label}</p>
              </div>
              <div className="h-8 w-16">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <Line type="monotone" dataKey="close" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="text-right shrink-0">
                <p className={cn('text-xs font-mono flex items-center justify-end gap-0.5', isUp ? 'text-profit' : 'text-loss')}>
                  {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatPercent(idx.changePercent)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectorPanel({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div>
      <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">Sector Mix</p>
      <div className="flex items-center gap-3">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" innerRadius={28} outerRadius={50} paddingAngle={2}>
                {data.map((_, i) => (
                  <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} stroke="none" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex-1 space-y-1 text-xs min-w-0">
          {data.slice(0, 5).map((s, i) => (
            <li key={s.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
              <span className="flex-1 truncate text-slate-300">{s.name}</span>
              <span className="font-mono text-muted">{s.value.toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MoversPanel({ data }: { data: { ticker: string; pnl: number }[] }) {
  return (
    <div>
      <p className="text-xs font-mono text-muted uppercase tracking-wider mb-3">P&L by Holding</p>
      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <Bar dataKey="pnl">
              {data.map((d, i) => (
                <Cell key={i} fill={d.pnl >= 0 ? '#22c55e' : '#ef4444'} />
              ))}
            </Bar>
            <Tooltip
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
              formatter={(value: number) => [`${value.toFixed(2)}%`, 'P&L']}
              labelFormatter={(label) => label}
              cursor={{ fill: 'rgba(148,163,184,0.06)' }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[10px] text-muted font-mono mt-1 px-1">
        {data.map((d) => <span key={d.ticker} className="truncate">{d.ticker}</span>)}
      </div>
    </div>
  );
}
