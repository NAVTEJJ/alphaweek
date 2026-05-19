'use client';

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn, formatPercent } from '@/lib/utils';
import { api } from '@/lib/api';

interface MarketItem {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  unit?: string; // '$', '₹', 'pts', etc.
}

// Backend returns a nested shape: { us: { sp500, nasdaq, dowJones, ... },
// india: { nifty50, sensex, ... }, crypto: { bitcoin, ethereum, ... },
// global: { gold, brentCrude, usdInr, eurUsd } }. Flatten it into a single
// ticker list for the strip.
interface MarketSnapshot {
  us?: {
    sp500?: { value: number; changePercent: number };
    nasdaq?: { value: number; changePercent: number };
    dowJones?: { value: number; changePercent: number };
  };
  india?: {
    nifty50?: { value: number; changePercent: number };
    sensex?: { value: number; changePercent: number };
  };
  crypto?: {
    bitcoin?: { price: number; change7dPercent: number };
    ethereum?: { price: number; change7dPercent: number };
  };
  global?: {
    gold?: number;
    brentCrude?: number;
    usdInr?: number;
    eurUsd?: number;
  };
}

async function fetchMarketSnapshot(): Promise<MarketItem[]> {
  const { data } = await api.get('/market/snapshot');
  const snap = data.data as MarketSnapshot;
  const items: MarketItem[] = [];

  if (snap?.us?.sp500) {
    items.push({ symbol: 'SPX', name: 'S&P 500', price: snap.us.sp500.value, changePercent: snap.us.sp500.changePercent, unit: 'pts' });
  }
  if (snap?.us?.nasdaq) {
    items.push({ symbol: 'NDX', name: 'NASDAQ', price: snap.us.nasdaq.value, changePercent: snap.us.nasdaq.changePercent, unit: 'pts' });
  }
  if (snap?.us?.dowJones) {
    items.push({ symbol: 'DJI', name: 'Dow Jones', price: snap.us.dowJones.value, changePercent: snap.us.dowJones.changePercent, unit: 'pts' });
  }
  if (snap?.india?.nifty50) {
    items.push({ symbol: 'NIFTY', name: 'NIFTY 50', price: snap.india.nifty50.value, changePercent: snap.india.nifty50.changePercent, unit: 'pts' });
  }
  if (snap?.india?.sensex) {
    items.push({ symbol: 'SENSEX', name: 'BSE Sensex', price: snap.india.sensex.value, changePercent: snap.india.sensex.changePercent, unit: 'pts' });
  }
  if (snap?.crypto?.bitcoin) {
    items.push({ symbol: 'BTC', name: 'Bitcoin', price: snap.crypto.bitcoin.price, changePercent: snap.crypto.bitcoin.change7dPercent, unit: '$' });
  }
  if (snap?.crypto?.ethereum) {
    items.push({ symbol: 'ETH', name: 'Ethereum', price: snap.crypto.ethereum.price, changePercent: snap.crypto.ethereum.change7dPercent, unit: '$' });
  }
  if (snap?.global?.gold) {
    items.push({ symbol: 'GOLD', name: 'Gold', price: snap.global.gold, changePercent: 0, unit: '$' });
  }
  if (snap?.global?.brentCrude) {
    items.push({ symbol: 'BRENT', name: 'Brent Crude', price: snap.global.brentCrude, changePercent: 0, unit: '$' });
  }
  if (snap?.global?.usdInr) {
    items.push({ symbol: 'USDINR', name: 'USD/INR', price: snap.global.usdInr, changePercent: 0 });
  }

  return items;
}

function formatPrice(price: number, unit?: string): string {
  if (unit === 'pts') return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === '$') {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function TickerItem({ item }: { item: MarketItem }) {
  const flat = Math.abs(item.changePercent) < 0.01;
  const isUp = item.changePercent > 0;

  return (
    <div className="flex items-center gap-2 px-5 shrink-0">
      <span className="text-xs font-mono font-semibold text-slate-300">{item.symbol}</span>
      <span className="text-xs font-mono text-slate-100">{formatPrice(item.price, item.unit)}</span>
      {item.changePercent !== 0 && (
        <span className={cn('flex items-center gap-0.5 text-xs font-mono', flat ? 'text-muted' : isUp ? 'text-profit' : 'text-loss')}>
          {flat ? <Minus className="h-3 w-3" /> : isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatPercent(item.changePercent)}
        </span>
      )}
    </div>
  );
}

export function MarketStrip() {
  const { data: items } = useQuery({
    queryKey: ['market-strip'],
    queryFn: fetchMarketSnapshot,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    refetchIntervalInBackground: false,
    retry: 1,
  });

  if (!items || items.length === 0) {
    // Render the bar but empty — better than zeros pretending to be data.
    return <div className="w-full h-10 bg-surface border-b border-border shrink-0" />;
  }

  // Duplicate the items so the marquee can loop seamlessly.
  const doubled = [...items, ...items];

  return (
    <div className="w-full overflow-hidden bg-surface border-b border-border h-10 flex items-center shrink-0">
      <div className="flex animate-ticker">
        {doubled.map((item, i) => (
          <TickerItem key={`${item.symbol}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}
