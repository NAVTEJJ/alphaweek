'use client';

import Link from 'next/link';
import { useEarningsCalendar } from '@/lib/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { EarningsEvent } from '@/lib/api';

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  if (isNaN(target.getTime())) return 999;
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatEarningsDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function UrgencyBadge({ days }: { days: number }) {
  if (days <= 0 || days >= 999) return null;
  if (days <= 3) {
    return <span className="text-[10px] font-mono bg-loss/20 text-red-400 px-1.5 py-0.5 rounded">In {days}d</span>;
  }
  if (days <= 7) {
    return <span className="text-[10px] font-mono bg-accent/20 text-amber-400 px-1.5 py-0.5 rounded">In {days}d</span>;
  }
  return <span className="text-[10px] font-mono bg-surface-2 text-muted px-1.5 py-0.5 rounded">{days}d</span>;
}

export function EarningsCalendar() {
  const { data: earnings = [], isLoading, isError } = useEarningsCalendar();

  // Silently hide on error — dashboard must keep working if this widget fails
  if (isError) return null;

  const upcoming = earnings.slice(0, 8);

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary-light" />
          <CardTitle className="text-sm">Earnings Calendar</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="py-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 bg-surface animate-pulse rounded" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-xs text-muted">
              No upcoming earnings found.
              <br />
              Add stocks to your portfolio or watchlist.
            </p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {upcoming.map((e: EarningsEvent) => {
              const days = daysUntil(e.earningsDate);
              return (
                <li key={e.ticker} className="flex items-center justify-between py-1">
                  <Link
                    href={`/ticker/${encodeURIComponent(e.ticker)}?exchange=NASDAQ`}
                    className="flex items-center gap-2 min-w-0 group"
                  >
                    <span className="font-mono font-semibold text-xs text-slate-100 group-hover:text-primary-light transition-colors w-16 shrink-0">{e.ticker}</span>
                    <span className="text-xs text-muted truncate hidden sm:block">{e.name}</span>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted font-mono">{formatEarningsDate(e.earningsDate)}</span>
                    <UrgencyBadge days={days} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
