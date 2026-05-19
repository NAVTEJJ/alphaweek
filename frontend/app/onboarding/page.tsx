'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useMutation } from '@tanstack/react-query';
import { updateProfile, api, markOnboarded, fetchOnboardedStatus } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TickerSearch } from '@/components/ui/ticker-search';
import { TrendingUp, BarChart2, Bell, Check, ChevronRight, ArrowRight, Globe, BrainCircuit, Smartphone } from 'lucide-react';
import { trackEvent, Events } from '@/lib/analytics';
import { ensurePushSubscribed } from '@/lib/push';

const STEPS = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'notifications', label: 'Notifications' },
] as const;

type StepId = typeof STEPS[number]['id'];

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const [step, setStep] = useState<StepId>('welcome');
  const [name, setName] = useState(user?.fullName ?? '');

  // Returning users on a new device shouldn't replay onboarding. Check the
  // server-side flag; if completed, skip straight to the dashboard.
  useEffect(() => {
    let cancelled = false;
    fetchOnboardedStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.completed) router.replace('/dashboard');
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [router]);

  const { mutate: saveName, isPending: savingName } = useMutation({
    mutationFn: () => updateProfile({ name: name.trim() || undefined }),
  });

  function finish() {
    // Keep the localStorage flag as an instant client-side guard, but the
    // authoritative state lives on the server now (Redis) so a new device or
    // a cleared cache still skips onboarding for returning users.
    localStorage.setItem('aw_onboarded', '1');
    markOnboarded().catch(() => undefined); // fire-and-forget — non-fatal
    trackEvent(Events.ONBOARDING_COMPLETED);
    router.push('/dashboard');
  }

  function handleWelcomeNext() {
    if (name.trim()) {
      saveName(undefined, { onSettled: () => setStep('portfolio') });
    } else {
      setStep('portfolio');
    }
  }

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-8">
          <TrendingUp className="h-6 w-6 text-primary-light" />
          <span className="font-heading text-2xl text-white">
            Alpha<span className="text-accent">Week</span>
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-2 rounded-full transition-all duration-300 ${
                i <= stepIndex ? 'bg-primary w-6' : 'bg-border w-2'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">
          {step === 'welcome' && (
            <WelcomeStep
              name={name}
              onNameChange={setName}
              onNext={handleWelcomeNext}
              loading={savingName}
            />
          )}
          {step === 'portfolio' && (
            <PortfolioStep
              onNext={() => setStep('watchlist')}
              onSkip={() => setStep('watchlist')}
            />
          )}
          {step === 'watchlist' && (
            <WatchlistStep
              onNext={() => setStep('notifications')}
              onSkip={() => setStep('notifications')}
            />
          )}
          {step === 'notifications' && (
            <NotificationsStep onFinish={finish} />
          )}
        </div>

        {/* Skip all */}
        <button
          type="button"
          onClick={finish}
          className="block mt-4 mx-auto text-xs text-muted hover:text-slate-400 transition-colors"
        >
          Skip setup — go to dashboard
        </button>
      </div>
    </div>
  );
}

function WelcomeStep({
  name,
  onNameChange,
  onNext,
  loading,
}: {
  name: string;
  onNameChange: (v: string) => void;
  onNext: () => void;
  loading: boolean;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl text-white mb-2">Welcome to AlphaWeek</h1>
        <p className="text-muted text-sm">
          Your AI-powered weekly investment brief — let&apos;s get you set up in 60 seconds.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 py-2">
        {[
          { Icon: Globe, text: 'US + India + Crypto markets', color: 'text-primary-light' },
          { Icon: BrainCircuit, text: 'AI-generated briefs every Monday', color: 'text-accent' },
          { Icon: Smartphone, text: 'Email, Telegram & push alerts', color: 'text-emerald-400' },
        ].map(({ Icon, text, color }) => (
          <div key={text} className="flex flex-col items-center text-center gap-1.5 p-3 rounded-xl bg-surface-2 border border-border">
            <Icon className={`h-5 w-5 ${color}`} />
            <span className="text-xs text-muted leading-tight">{text}</span>
          </div>
        ))}
      </div>

      <div>
        <Input
          label="Your name (optional)"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Navtej"
        />
      </div>

      <Button variant="primary" className="w-full" loading={loading} onClick={onNext}>
        Get started <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

type OnboardingExchange = 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO';
const ONBOARDING_EXCHANGES: OnboardingExchange[] = ['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO'];

const SAMPLE_PORTFOLIO = [
  { ticker: 'AAPL', exchange: 'NASDAQ' as OnboardingExchange, quantity: 10, avgBuyPrice: 178 },
  { ticker: 'NVDA', exchange: 'NASDAQ' as OnboardingExchange, quantity: 5,  avgBuyPrice: 495 },
  { ticker: 'MSFT', exchange: 'NASDAQ' as OnboardingExchange, quantity: 8,  avgBuyPrice: 385 },
];

function PortfolioStep({
  onNext,
  onSkip,
}: {
  onNext: () => void;
  onSkip: () => void;
}) {
  const [ticker, setTicker] = useState('');
  const [exchange, setExchange] = useState<OnboardingExchange>('NASDAQ');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [added, setAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sampleLoading, setSampleLoading] = useState(false);

  async function handleSamplePortfolio() {
    setSampleLoading(true);
    try {
      await Promise.all(
        SAMPLE_PORTFOLIO.map((h) =>
          api.post('/portfolio/holdings', {
            ticker: h.ticker,
            quantity: h.quantity,
            avgBuyPrice: h.avgBuyPrice,
            exchange: h.exchange,
          })
        )
      );
      setAdded(true);
      trackEvent('onboarding_sample_portfolio_used');
    } catch {
      // non-fatal
    } finally {
      setSampleLoading(false);
    }
  }

  async function handleAdd() {
    const t = ticker.trim().toUpperCase();
    if (!t || !qty || !price) return;
    setSaving(true);
    try {
      await api.post('/portfolio/holdings', {
        ticker: t,
        quantity: parseFloat(qty),
        avgBuyPrice: parseFloat(price),
        exchange,
      });
      setAdded(true);
      trackEvent('onboarding_holding_added', { ticker: t, exchange });
    } catch {
      // non-fatal — user can add more from portfolio page
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="h-5 w-5 text-primary-light" />
          <h2 className="font-heading text-xl text-white">Add your first holding</h2>
        </div>
        <p className="text-muted text-sm">
          AlphaWeek personalises your brief based on what you own. Add one holding to get started.
        </p>
      </div>

      {/* Quick-start: pre-fill a sample portfolio with one tap */}
      {!added && (
        <button
          type="button"
          onClick={handleSamplePortfolio}
          disabled={sampleLoading}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-surface-2 border border-border hover:border-primary/40 transition-colors group"
        >
          <div className="text-left">
            <p className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
              Try with a sample portfolio
            </p>
            <p className="text-xs text-muted mt-0.5">AAPL · NVDA · MSFT — you can edit later</p>
          </div>
          {sampleLoading
            ? <div className="h-4 w-4 rounded-full border-2 border-primary-light border-t-transparent animate-spin shrink-0" />
            : <ChevronRight className="h-4 w-4 text-muted group-hover:text-primary-light transition-colors shrink-0" />
          }
        </button>
      )}

      {added ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-profit/10 border border-profit/20">
          <Check className="h-5 w-5 text-profit shrink-0" />
          <div>
            <p className="text-sm font-medium text-profit">{ticker ? ticker.toUpperCase() : 'Sample portfolio'} added!</p>
            <p className="text-xs text-muted">You can add more from the Portfolio page.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ticker symbol</label>
            <TickerSearch
              value={ticker}
              onValueChange={(v) => setTicker(v.toUpperCase())}
              onPick={(r) => {
                setTicker(r.ticker);
                // If the picked result belongs to one of our supported exchanges,
                // auto-fill the dropdown so the user doesn't have to choose twice.
                if (ONBOARDING_EXCHANGES.includes(r.exchange as OnboardingExchange)) {
                  setExchange(r.exchange as OnboardingExchange);
                }
              }}
              placeholder="Search ticker or company…"
              ariaLabel="Search ticker"
            />
          </div>
          <div>
            <label htmlFor="onboarding-exchange" className="block text-xs font-medium text-muted mb-1">Exchange</label>
            <select
              id="onboarding-exchange"
              value={exchange}
              onChange={(e) => setExchange(e.target.value as OnboardingExchange)}
              className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-border text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {ONBOARDING_EXCHANGES.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity"
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="10"
            />
            <Input
              label={exchange === 'NSE' || exchange === 'BSE' ? 'Avg buy price (₹)' : 'Avg buy price ($)'}
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="150.00"
            />
          </div>
          <Button
            variant="primary"
            className="w-full"
            loading={saving}
            disabled={!ticker.trim() || !qty || !price}
            onClick={handleAdd}
          >
            Add holding
          </Button>
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onSkip}>
          Skip for now
        </Button>
        <Button variant={added ? 'primary' : 'outline'} className="flex-1" onClick={onNext}>
          Continue <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Watchlist step — much lower friction than the holdings step (no shares/cost),
// so it's a good place to lock the user in even if they don't have positions.
function WatchlistStep({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [tickers, setTickers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleNext() {
    if (tickers.length === 0) { onNext(); return; }
    setSaving(true);
    setError(null);
    try {
      await api.put('/portfolio/watchlist', { tickers });
      trackEvent('onboarding_watchlist_saved', { count: tickers.length });
      onNext();
    } catch {
      setError('Could not save watchlist. You can add tickers later from the Portfolio page.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="h-5 w-5 text-accent" />
          <h2 className="font-heading text-xl text-white">Build your watchlist</h2>
        </div>
        <p className="text-muted text-sm">
          Track stocks you don&apos;t own yet. Tickers on your watchlist get extra coverage in your weekly brief.
        </p>
      </div>

      <div>
        <TickerSearch
          onPick={(r) => {
            const next = r.ticker.trim().toUpperCase();
            if (!next || tickers.includes(next)) return;
            setTickers([...tickers, next]);
          }}
          placeholder="Search and pick a ticker…"
          ariaLabel="Add to watchlist"
        />
        {tickers.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tickers.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-2 border border-border text-xs font-mono text-slate-200"
              >
                {t}
                <button
                  type="button"
                  aria-label={`Remove ${t}`}
                  onClick={() => setTickers(tickers.filter((x) => x !== t))}
                  className="text-muted hover:text-loss transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {error && <p className="text-xs text-loss mt-2">{error}</p>}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" className="flex-1" onClick={onSkip}>
          Skip for now
        </Button>
        <Button
          variant={tickers.length > 0 ? 'primary' : 'outline'}
          className="flex-1"
          loading={saving}
          onClick={handleNext}
        >
          {tickers.length > 0 ? `Save ${tickers.length} ticker${tickers.length === 1 ? '' : 's'}` : 'Continue'}
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function NotificationsStep({ onFinish }: { onFinish: () => void }) {
  const [pushRequested, setPushRequested] = useState(false);

  async function requestPush() {
    if (!('Notification' in window)) return;
    try {
      const subscribed = await ensurePushSubscribed();
      if (subscribed) {
        setPushRequested(true);
        trackEvent('onboarding_push_granted');
      }
    } catch {
      // non-fatal
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-5 w-5 text-primary-light" />
          <h2 className="font-heading text-xl text-white">Stay informed</h2>
        </div>
        <p className="text-muted text-sm">
          Get your brief the moment it&apos;s ready — choose how you want to be notified.
        </p>
      </div>

      <div className="space-y-3">
        {/* Push notifications */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface-2 border border-border">
          <div>
            <p className="text-sm font-medium text-slate-200">Browser push notifications</p>
            <p className="text-xs text-muted mt-0.5">Instant alerts when your brief is ready</p>
          </div>
          {pushRequested ? (
            <span className="flex items-center gap-1.5 text-xs text-profit font-medium">
              <Check className="h-3.5 w-3.5" /> Enabled
            </span>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={requestPush}>
              Enable
            </Button>
          )}
        </div>

        {/* Telegram */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-surface-2 border border-border">
          <div>
            <p className="text-sm font-medium text-slate-200">Telegram delivery</p>
            <p className="text-xs text-muted mt-0.5">Receive daily and weekly briefs directly in Telegram</p>
          </div>
          <a href="/settings#telegram" onClick={onFinish}>
            <Button type="button" variant="outline" size="sm">
              Set up
            </Button>
          </a>
        </div>

        {/* Email note */}
        <p className="text-xs text-muted text-center">
          Email delivery is always on — briefs arrive at your registered address every Monday.
        </p>
      </div>

      <Button variant="primary" className="w-full" onClick={onFinish}>
        Go to dashboard <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
