'use client';

import { TrendingUp, TrendingDown, Minus, Activity, AlertTriangle } from 'lucide-react';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import type { LivePortfolioResult } from '@/lib/api';

function DeltaBadge({ value, className }: { value: number; className?: string }) {
  const flat = Math.abs(value) < 0.005;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-sm',
        flat ? 'text-muted' : value > 0 ? 'text-profit' : 'text-loss',
        className
      )}
    >
      {flat ? <Minus className="h-3 w-3" /> : value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {value > 0 && !flat ? '+' : ''}{formatPercent(value)}
    </span>
  );
}

function GradeBadge({ grade, score }: { grade: string; score: number }) {
  const color =
    grade === 'A' ? 'text-profit border-profit/30 bg-profit/10' :
    grade === 'B' ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' :
    grade === 'C' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
    grade === 'D' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10' :
                   'text-loss border-loss/30 bg-loss/10';
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-sm font-mono font-bold', color)}>
      {grade} <span className="font-normal text-xs opacity-70">({score}/100)</span>
    </span>
  );
}

interface Props {
  data: LivePortfolioResult;
}

export function PortfolioSummary({ data }: Props) {
  const { totalValue, totalPnL, totalPnLPercent, dayChangePercent, benchmarkDayChangePercent, health } = data;
  const vsSpyDelta = benchmarkDayChangePercent !== null ? dayChangePercent - benchmarkDayChangePercent : null;

  return (
    <div className="space-y-4">
      {/* Stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Value */}
        <div className="rounded-xl bg-surface border border-border p-4">
          <p className="text-xs font-mono text-muted uppercase tracking-wider mb-1">Portfolio Value</p>
          <p className="font-heading text-2xl text-white">{formatCurrency(totalValue)}</p>
          <p className="text-xs text-muted mt-1">Total market value</p>
        </div>

        {/* Total P&L */}
        <div className="rounded-xl bg-surface border border-border p-4">
          <p className="text-xs font-mono text-muted uppercase tracking-wider mb-1">Total P&L</p>
          <p className={cn('font-heading text-2xl', totalPnL >= 0 ? 'text-profit' : 'text-loss')}>
            {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
          </p>
          <DeltaBadge value={totalPnLPercent} className="mt-1" />
        </div>

        {/* Today's Change */}
        <div className="rounded-xl bg-surface border border-border p-4">
          <p className="text-xs font-mono text-muted uppercase tracking-wider mb-1">Today</p>
          <DeltaBadge value={dayChangePercent} className="text-xl font-heading" />
          {vsSpyDelta !== null && (
            <p className={cn('text-xs mt-1', vsSpyDelta >= 0 ? 'text-profit' : 'text-loss')}>
              {vsSpyDelta >= 0 ? '+' : ''}{vsSpyDelta.toFixed(2)}% vs SPY
            </p>
          )}
          {benchmarkDayChangePercent === null && (
            <p className="text-xs text-muted mt-1">SPY unavailable</p>
          )}
        </div>

        {/* Health Score */}
        <div className="rounded-xl bg-surface border border-border p-4">
          <p className="text-xs font-mono text-muted uppercase tracking-wider mb-1">Health Score</p>
          <GradeBadge grade={health.grade} score={health.score} />
          <p className="text-xs text-muted mt-1 line-clamp-1" title={health.topRisk}>
            {health.topRisk}
          </p>
        </div>
      </div>

      {/* Health breakdown */}
      <div className="rounded-xl bg-surface border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary-light" />
          <p className="text-sm font-medium text-slate-200">Health Breakdown</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(health.breakdown).map(([key, metric]) => {
            const pct = (metric.score / metric.max) * 100;
            const label = key === 'analystSentiment' ? 'Analyst' :
                          key.charAt(0).toUpperCase() + key.slice(1);
            return (
              <div key={key}>
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>{label}</span>
                  <span className="font-mono">{metric.score}/{metric.max}</span>
                </div>
                <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      pct >= 75 ? 'bg-profit' : pct >= 50 ? 'bg-yellow-400' : 'bg-loss'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-1 leading-tight">{metric.label}</p>
              </div>
            );
          })}
        </div>
        {health.topRisk && (
          <div className="mt-3 flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-400/5 rounded-lg px-3 py-2 border border-yellow-400/10">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{health.topRisk}</span>
          </div>
        )}
      </div>
    </div>
  );
}
