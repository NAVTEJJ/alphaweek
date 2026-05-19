'use client';

import { X, Zap, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 29,
    features: ['Portfolio tracking (10 holdings)', 'Weekly AI brief', 'Email + Telegram delivery', '4-week archive'],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 79,
    features: ['50 holdings + watchlist', 'Portfolio analysis & rebalancing', 'Geo-political risk alerts', 'Sector rotation map', '12-week archive'],
    highlight: true,
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 199,
    features: ['Unlimited holdings', 'Reddit sentiment analysis', 'Daily micro-briefs', 'Priority Llama AI', '52-week archive'],
    highlight: false,
  },
];

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  currentPlan?: string;
}

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/20 flex items-center justify-center">
              <Zap className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Upgrade your plan</h2>
              <p className="text-xs text-muted">Paid plans launching soon</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-slate-300 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-xl border p-4 flex flex-col ${
                plan.highlight ? 'border-accent/50 bg-accent/5' : 'border-border bg-surface-2'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-0.5 bg-accent text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-slate-100">{plan.name}</h3>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white font-mono">${plan.price}</span>
                  <span className="text-sm text-muted">/mo</span>
                </div>
              </div>
              <ul className="flex-1 space-y-2 mb-4">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                    <Check className="h-3.5 w-3.5 text-profit mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button variant={plan.highlight ? 'accent' : 'outline'} size="sm" className="w-full" disabled>
                Coming Soon
              </Button>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20 text-sm">
            <Mail className="h-4 w-4 text-primary-light shrink-0" />
            <span className="text-slate-300">
              Interested in a paid plan? Email{' '}
              <a href="mailto:support@alphaweek.io" className="text-primary-light hover:underline">
                support@alphaweek.io
              </a>{' '}
              and we'll get you set up manually.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
