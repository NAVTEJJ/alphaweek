'use client';

import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { LandingNav } from '@/components/landing/LandingNav';

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-2 text-slate-100">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
          <TrendingUp className="h-3.5 w-3.5 text-primary-light" />
          <span className="text-xs text-slate-300 font-medium">Free during public beta</span>
        </div>

        <h1 className="font-heading text-4xl md:text-5xl text-white leading-tight mb-5">
          Every feature.{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-accent">
            Open to everyone.
          </span>
        </h1>

        <p className="text-lg text-muted leading-relaxed mb-8 max-w-xl mx-auto">
          AlphaWeek is in public beta. Daily AI briefs, portfolio analysis, geopolitical risk
          radar, price alerts and the AI chat are all open — no plans, no card, no limits worth
          mentioning. We&apos;ll introduce pricing once the product earns it.
        </p>

        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-accent/20"
        >
          Get started — it&apos;s free
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="text-xs text-muted mt-6">
          Curious what&apos;s coming? <Link href="/" className="text-primary-light hover:underline">See the feature tour</Link>.
        </p>
      </main>
    </div>
  );
}
