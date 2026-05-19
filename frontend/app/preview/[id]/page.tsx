import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Lock, TrendingUp, Zap, ArrowRight, Calendar, BarChart2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { PreviewTracker } from '@/components/analytics/PreviewTracker';
import { BriefMarkdownPreview } from '@/components/preview/BriefMarkdownPreview';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface BriefPreview {
  id: string;
  weekOf: string;
  planAtGeneration: string;
  generatedAt?: string | null;
  preview: string;
  isTruncated: boolean;
}

async function getBriefPreview(id: string): Promise<BriefPreview | null> {
  try {
    const res = await fetch(`${API_URL}/briefs/preview/${id}`, {
      next: { revalidate: 3600 }, // cache 1 hour
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as BriefPreview;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const brief = await getBriefPreview(params.id);
  if (!brief) {
    return { title: 'Brief Not Found | AlphaWeek' };
  }

  const weekStr = formatDate(brief.weekOf);
  const description = brief.preview.slice(0, 155).replace(/#+\s/g, '');

  return {
    title: `Investment Brief — Week of ${weekStr} | AlphaWeek`,
    description,
    openGraph: {
      title: `AlphaWeek Investment Brief — Week of ${weekStr}`,
      description,
      type: 'article',
      siteName: 'AlphaWeek',
    },
    twitter: {
      card: 'summary_large_image',
      title: `AlphaWeek Investment Brief — Week of ${weekStr}`,
      description,
    },
  };
}

export default async function BriefPreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const brief = await getBriefPreview(params.id);
  if (!brief) notFound();

  const weekStr = formatDate(brief.weekOf);

  return (
    <div className="min-h-screen bg-[#0A0F1C]">
      <PreviewTracker briefId={brief.id} weekOf={brief.weekOf} />

      {/* Top nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[#1E40AF]" />
          <span className="font-bold text-white text-lg">AlphaWeek</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm bg-[#1E40AF] hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Get Full Access
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Brief meta */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-blue-900/40 text-blue-300 border border-blue-700/40 px-3 py-1 rounded-full">
              <Calendar className="h-3 w-3" />
              Week of {weekStr}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-900/30 text-amber-300 border border-amber-700/30 px-3 py-1 rounded-full">
              <BarChart2 className="h-3 w-3" />
              Weekly Brief
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Investment Intelligence Brief
          </h1>
          <p className="text-slate-400 text-sm">
            AI-powered weekly market analysis covering US equities, Indian markets, and crypto.
            {brief.generatedAt && (
              <> Generated {new Date(brief.generatedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}.</>
            )}
          </p>
        </div>

        {/* Preview content */}
        <div className="bg-[#111827] border border-white/10 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-5 border-b border-white/10 flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-medium text-slate-300">Brief Preview</span>
          </div>

          <div className="px-6 py-6">
            <BriefMarkdownPreview preview={brief.preview} isTruncated={brief.isTruncated} />
          </div>

          {/* Fade-out + lock overlay */}
          {brief.isTruncated && (
            <div className="relative">
              {/* Gradient fade */}
              <div className="h-24 bg-gradient-to-t from-[#111827] to-transparent -mt-12 relative z-10" />
              {/* Lock section */}
              <div className="bg-[#111827] px-6 pb-8 pt-2 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-full bg-blue-900/50 border border-blue-700/50 flex items-center justify-center mb-3">
                  <Lock className="h-4 w-4 text-blue-400" />
                </div>
                <p className="text-slate-300 font-medium text-sm mb-1">
                  The full brief continues…
                </p>
                <p className="text-slate-500 text-xs mb-5 max-w-xs">
                  Geo-political risk signals, portfolio health analysis, watchlist movers, and week-ahead event calendar.
                </p>
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 bg-[#1E40AF] hover:bg-blue-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                  <Zap className="h-4 w-4" />
                  Unlock Full Brief — Free to Start
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Value props */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {[
            { icon: '🇺🇸', title: 'US Markets', desc: 'S&P 500, NASDAQ, sector rotation, macro signals' },
            { icon: '🇮🇳', title: 'India Markets', desc: 'Nifty 50, FII flows, RBI stance, midcap movers' },
            { icon: '₿', title: 'Crypto', desc: 'BTC/ETH, ETF flows, on-chain metrics' },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-[#111827] border border-white/10 rounded-xl p-4 text-center"
            >
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-sm font-semibold text-white mb-1">{title}</p>
              <p className="text-xs text-slate-400">{desc}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-900/30 to-indigo-900/20 border border-blue-700/30 rounded-2xl px-8 py-10 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Get your full brief every Monday
          </h2>
          <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
            AlphaWeek combines your portfolio, watchlist, and live market data to generate a personalised investment intelligence brief — every Monday morning.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center gap-2 bg-[#1E40AF] hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              <Zap className="h-4 w-4" />
              Start Free — No Card Required
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-slate-300 hover:text-white font-medium px-6 py-3 rounded-xl transition-colors text-sm"
            >
              View Plans
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Free plan delivers a brief every Monday. Upgrade for portfolio-personalised analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
