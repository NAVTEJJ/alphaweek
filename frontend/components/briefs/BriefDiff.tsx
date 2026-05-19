'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchBriefDiff } from '@/lib/api';
import { TrendingUp, TrendingDown, Minus, ArrowRightLeft, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  briefId: string;
}

export function BriefDiff({ briefId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['brief-diff', briefId],
    queryFn: () => fetchBriefDiff(briefId),
    staleTime: 3600_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface border border-border text-xs text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        Comparing with last week's brief…
      </div>
    );
  }

  if (isError || !data) return null;
  if (data.empty) return null;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-surface-2">
        <ArrowRightLeft className="h-4 w-4 text-primary-light shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-200">Week-over-week shift</p>
          {data.sentimentShift && (
            <p className="text-xs text-muted font-mono mt-0.5">{data.sentimentShift}</p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary */}
        <p className="text-sm text-slate-300 leading-relaxed">{data.summary}</p>

        {/* Top changes */}
        {data.topChanges.length > 0 && (
          <div className="space-y-1.5">
            {data.topChanges.map((change, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <span className="text-accent mt-1 shrink-0">›</span>
                <span className="leading-relaxed">{change}</span>
              </div>
            ))}
          </div>
        )}

        {/* Ticker changes */}
        {(data.newTickersHighlighted.length > 0 || data.removedTickersHighlighted.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            {data.newTickersHighlighted.length > 0 && (
              <div className="rounded-lg bg-profit/5 border border-profit/15 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="h-3 w-3 text-profit" />
                  <span className="text-[11px] font-semibold text-profit uppercase tracking-wider">New this week</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.newTickersHighlighted.map((t) => (
                    <span key={t} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-profit/10 text-profit border border-profit/20">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {data.removedTickersHighlighted.length > 0 && (
              <div className="rounded-lg bg-loss/5 border border-loss/15 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="h-3 w-3 text-loss" />
                  <span className="text-[11px] font-semibold text-loss uppercase tracking-wider">Dropped</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.removedTickersHighlighted.map((t) => (
                    <span key={t} className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-loss/10 text-loss border border-loss/20">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
