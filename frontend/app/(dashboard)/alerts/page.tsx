'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePriceAlerts } from '@/lib/hooks';
import { createPriceAlert, deletePriceAlert, PriceAlert } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TickerSearch } from '@/components/ui/ticker-search';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { trackEvent, Events } from '@/lib/analytics';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, CheckCircle2, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type Exchange = 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO';

const EXCHANGE_OPTIONS: Exchange[] = ['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO'];

export default function AlertsPage() {
  const { data: alerts = [], isLoading } = usePriceAlerts();
  const qc = useQueryClient();
  const toast = useToast();

  const [form, setForm] = useState({
    ticker: '',
    exchange: 'NASDAQ' as Exchange,
    targetPrice: '',
    direction: 'above' as 'above' | 'below',
  });

  const { mutate: addAlert, isPending: adding } = useMutation({
    mutationFn: () =>
      createPriceAlert({
        ticker: form.ticker.toUpperCase(),
        exchange: form.exchange,
        targetPrice: parseFloat(form.targetPrice),
        direction: form.direction,
      }),
    onSuccess: (alert) => {
      qc.invalidateQueries({ queryKey: ['price-alerts'] });
      trackEvent(Events.PRICE_ALERT_CREATED, { ticker: alert.ticker, direction: alert.direction });
      toast.success(`Alert set: ${alert.ticker} ${alert.direction} $${alert.targetPrice}`);
      setForm({ ticker: '', exchange: 'NASDAQ', targetPrice: '', direction: 'above' });
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? 'Failed to create alert');
    },
  });

  const { mutate: removeAlert } = useMutation({
    mutationFn: deletePriceAlert,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['price-alerts'] });
      toast.success('Alert deleted');
    },
  });

  function handleAdd() {
    if (!form.ticker || !form.targetPrice || parseFloat(form.targetPrice) <= 0) {
      toast.error('Enter a valid ticker and target price');
      return;
    }
    addAlert();
  }

  const active = alerts.filter((a) => !a.triggered);
  const triggered = alerts.filter((a) => a.triggered);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-white">Price Alerts</h1>
          <p className="text-muted text-sm mt-1">
            Get notified via email + Telegram when a ticker hits your target price
          </p>
        </div>
      </div>

      <>
          {/* Add Alert */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary-light" />
                <CardTitle>New Price Alert</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <TickerSearch
                  value={form.ticker}
                  onValueChange={(v) => setForm((f) => ({ ...f, ticker: v.toUpperCase() }))}
                  onPick={(r) => setForm((f) => ({
                    ...f,
                    ticker: r.ticker,
                    exchange: r.exchange as Exchange,
                  }))}
                  placeholder="Search ticker…"
                  ariaLabel="Search ticker"
                />
                <select
                  aria-label="Exchange"
                  value={form.exchange}
                  onChange={(e) => setForm((f) => ({ ...f, exchange: e.target.value as Exchange }))}
                  className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {EXCHANGE_OPTIONS.map((ex) => <option key={ex}>{ex}</option>)}
                </select>
                <Input
                  type="number"
                  placeholder="Target Price"
                  min={0.001}
                  step="any"
                  value={form.targetPrice}
                  onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))}
                />
                <select
                  aria-label="Alert direction"
                  value={form.direction}
                  onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as 'above' | 'below' }))}
                  className="px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="above">Crosses Above ↑</option>
                  <option value="below">Drops Below ↓</option>
                </select>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAdd}
                  loading={adding}
                  className="col-span-2 md:col-span-1"
                >
                  <Bell className="h-4 w-4" /> Set Alert
                </Button>
              </div>
              <p className="text-xs text-muted mt-3">
                US alerts checked every 15 min during US market hours · Indian alerts every 15 min during NSE/BSE hours · Crypto alerts every 5 min, 24/7.
              </p>
            </CardContent>
          </Card>

          {/* Active Alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-accent" />
                <CardTitle>Active Alerts</CardTitle>
                <Badge variant="muted">{active.length}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface animate-pulse rounded-lg" />)}
                </div>
              ) : active.length === 0 ? (
                <div className="text-center py-10">
                  <Clock className="h-10 w-10 text-muted mx-auto mb-3" />
                  <p className="text-sm text-muted">No active alerts. Add your first target price above.</p>
                </div>
              ) : (
                <AlertTable alerts={active} onDelete={(id) => removeAlert(id)} />
              )}
            </CardContent>
          </Card>

          {/* Triggered Alerts */}
          {triggered.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-profit" />
                  <CardTitle>Triggered Alerts</CardTitle>
                  <Badge variant="muted">{triggered.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <AlertTable alerts={triggered} />
              </CardContent>
            </Card>
          )}
      </>
    </div>
  );
}

function AlertTable({ alerts, onDelete }: { alerts: PriceAlert[]; onDelete?: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/50">
            <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Ticker</th>
            <th className="text-left px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden sm:table-cell">Exchange</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Target</th>
            <th className="text-center px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider">Direction</th>
            <th className="text-right px-4 py-3 text-xs font-mono text-muted uppercase tracking-wider hidden md:table-cell">Created</th>
            {onDelete && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {alerts.map((alert) => (
            <tr key={alert.id} className="hover:bg-surface-3/20 transition-colors">
              <td className="px-4 py-3">
                <Link
                  href={`/ticker/${encodeURIComponent(alert.ticker)}?exchange=${encodeURIComponent(alert.exchange)}`}
                  className="font-mono font-semibold text-slate-100 hover:text-primary-light transition-colors"
                >
                  {alert.ticker}
                </Link>
                {alert.triggered && (
                  <span className="ml-2 text-[10px] bg-profit/20 text-profit px-1.5 py-0.5 rounded font-mono">HIT</span>
                )}
              </td>
              <td className="px-4 py-3 text-muted hidden sm:table-cell">
                <span className="font-mono text-xs">{alert.exchange}</span>
              </td>
              <td className="px-4 py-3 text-right font-mono text-slate-100">
                ${alert.targetPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-center">
                {alert.direction === 'above' ? (
                  <span className="inline-flex items-center gap-1 text-profit text-xs font-mono">
                    <TrendingUp className="h-3 w-3" /> Above
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-loss text-xs font-mono">
                    <TrendingDown className="h-3 w-3" /> Below
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right text-muted text-xs hidden md:table-cell">
                {alert.triggeredAt
                  ? `Triggered ${formatDate(alert.triggeredAt)}`
                  : formatDate(alert.createdAt)}
              </td>
              {onDelete && (
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(alert.id)}
                    className="text-muted hover:text-loss transition-colors p-1 rounded"
                    title="Delete alert"
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
