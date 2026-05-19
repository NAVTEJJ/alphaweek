'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    q: 'How is AlphaWeek different from a financial newsletter?',
    a: 'Traditional newsletters are written by humans with fixed opinions. AlphaWeek synthesizes live market data — S&P 500, Nifty 50, crypto prices, geopolitical events — every week using a state-of-the-art AI language model. Your brief reflects what actually happened in markets that week, not a pre-written take.',
  },
  {
    q: 'Do I need to be a finance professional to use AlphaWeek?',
    a: 'No. AlphaWeek is designed for intelligent retail investors — people who are smart but not trained traders. The AI deliberately avoids jargon, explains the "why" behind every market move, and gives you actionable takeaways in plain English.',
  },
  {
    q: 'When do I receive my brief?',
    a: 'Every weekday (Mon–Fri) at 07:30 UTC for a daily morning pulse, plus a full weekly deep-dive every Monday at 08:00 UTC. You can also trigger a brief on demand any time from the Briefs page.',
  },
  {
    q: 'Does the free plan actually give me useful information?',
    a: 'Yes. Every account gets a complete brief — US markets (S&P 500, NASDAQ, Dow Jones), India markets (Nifty 50, Sensex), crypto, geopolitical risk scoring, and portfolio-aware analysis. It\'s a real brief, not a teaser.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Absolutely. Cancel with one click from your settings page. No contracts, no cancellation fees. You keep access until the end of your billing period. Paid plans include a 14-day free trial — no charge until the trial ends.',
  },
  {
    q: 'What markets does AlphaWeek cover?',
    a: 'US markets (S&P 500, NASDAQ, Dow Jones, top movers), Indian markets (Nifty 50, Sensex, NSE/BSE stocks), and Crypto (Bitcoin, Ethereum, top altcoins + Fear & Greed Index). Global indicators (USD/INR, Brent Crude, Gold, DXY) are included in all plans.',
  },
  {
    q: 'How does portfolio tracking work?',
    a: 'You enter your holdings (ticker, exchange, quantity, avg buy price) — or import them via CSV from any broker. AlphaWeek fetches live prices and includes your portfolio\'s real-time P&L, daily performance vs SPY, analyst ratings, and AI-generated rebalancing notes in every brief. No holding limits.',
  },
  {
    q: 'What is the White Label plan?',
    a: 'The White Label plan lets wealth managers, advisors, and fintech platforms deliver AI-powered briefs under their own brand. You get full customization (logo, color scheme, domain), API access, and the ability to generate briefs for multiple client segments. Contact us to discuss.',
  },
];

export function LandingFAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {FAQS.map((faq, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-surface overflow-hidden transition-colors hover:border-border-light"
        >
          <button
            className="w-full flex items-center justify-between px-6 py-5 text-left gap-4"
            onClick={() => setOpen(open === i ? null : i)}
          >
            <span className="text-sm font-semibold text-slate-200">{faq.q}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted shrink-0 transition-transform duration-200',
                open === i && 'rotate-180'
              )}
            />
          </button>
          {open === i && (
            <div className="px-6 pb-5">
              <p className="text-sm text-muted leading-relaxed">{faq.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
