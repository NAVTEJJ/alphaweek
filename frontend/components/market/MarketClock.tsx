'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAllSessions, MarketSession } from '@/lib/marketSession';

// Pulsing dot uses these per state:
const STATE_COLOR: Record<MarketSession['state'], string> = {
  open: 'bg-profit',
  closed: 'bg-loss',
  pre: 'bg-amber-400',
  after: 'bg-amber-400',
  'always-open': 'bg-profit',
};

export function MarketClock({ className }: { className?: string }) {
  // Re-render once per minute so countdowns stay live without spamming
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sessions = getAllSessions(now);

  return (
    <div className={cn('hidden md:flex items-center gap-2', className)}>
      {sessions.map((s) => (
        <div
          key={s.market}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-surface-2/60 text-[11px]"
          title={`${s.label}: ${s.message}`}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', STATE_COLOR[s.state], s.state === 'open' && 'animate-pulse')} />
          <span className="font-mono text-muted">{s.market === 'INDIA' ? 'NSE' : s.market}</span>
          <span className="text-slate-300">{s.message}</span>
        </div>
      ))}
    </div>
  );
}

export function MarketClockCompact({ className }: { className?: string }) {
  // Compact one-liner for the mobile top bar — shows the "most relevant"
  // session (the one with the smallest msUntilNext, breaking ties US > INDIA).
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sessions = getAllSessions(now)
    .filter((s) => s.state !== 'always-open' && s.msUntilNext !== null)
    .sort((a, b) => (a.msUntilNext ?? Infinity) - (b.msUntilNext ?? Infinity));

  const headline = sessions[0];
  if (!headline) return null;

  return (
    <div className={cn('flex items-center gap-1.5 text-[11px] text-muted', className)}>
      <Clock className="h-3 w-3" />
      <span className="font-mono">{headline.market === 'INDIA' ? 'NSE' : headline.market}</span>
      <span>{headline.message}</span>
    </div>
  );
}
