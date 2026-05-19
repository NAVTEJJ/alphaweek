'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { fetchSharedBrief, SharedBriefData } from '@/lib/api';
import { MarketMood } from '@/components/briefs/MarketMood';
import { BriefSummary } from '@/components/briefs/BriefSummary';
import { LandingNav } from '@/components/landing/LandingNav';
import { TrendingUp, Clock, ArrowRight, Loader2, AlertCircle, Lock } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function SharedBriefPage() {
  const { slug } = useParams<{ slug: string }>();
  const [brief, setBrief] = useState<SharedBriefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetchSharedBrief(slug)
      .then(setBrief)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const readMins = brief?.preview
    ? Math.max(1, Math.ceil(brief.preview.trim().split(/\s+/).length / 200))
    : 0;

  return (
    <div className="min-h-screen bg-surface-2">
      <LandingNav />

      <div className="pt-14">
        <div className="bg-surface-2/80 border-b border-border py-2.5 px-4 text-center">
          <p className="text-xs text-muted">
            Shared via AlphaWeek — AI-generated investment brief.{' '}
            <Link href="/sign-up" className="text-primary-light font-semibold hover:underline">
              Get your own →
            </Link>
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 text-primary-light animate-spin" />
          </div>
        )}

        {notFound && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-loss" />
            <p className="text-slate-300 font-medium">Brief not found</p>
            <p className="text-muted text-sm">This link may have expired or been removed.</p>
            <Link href="/sign-up" className="px-4 py-2 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent-dark transition-colors">
              Get your own brief
            </Link>
          </div>
        )}

        {brief && (
          <>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary-light" />
                <span className="font-heading text-3xl text-white tracking-tight">AlphaWeek Brief</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <p className="text-muted text-sm font-mono">Week of {formatDate(brief.weekOf)}</p>
                {readMins > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="h-3 w-3" /> {readMins}+ min read
                  </div>
                )}
              </div>
            </div>

            {brief.briefSummary && <BriefSummary briefSummary={brief.briefSummary} />}
            {brief.mood && <MarketMood mood={brief.mood} moodReason={brief.moodReason ?? null} />}

            <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400/70" />
              <p>AI-generated analysis. Not financial advice. <Link href="/disclaimer" className="underline hover:text-amber-200">Disclaimer</Link>.</p>
            </div>

            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="py-8 px-6 sm:px-8">
                <div className="prose-dark max-w-none">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => (
                        <h2 className="font-heading text-xl text-white mt-8 mb-4 pb-2 border-b border-border first:mt-0">{children}</h2>
                      ),
                      p: ({ children }) => (
                        <p className="text-slate-300 leading-relaxed mb-4 text-[15px]">{children}</p>
                      ),
                      ul: ({ children }) => <ul className="space-y-2 mb-4 ml-2">{children}</ul>,
                      // eslint-disable-next-line jsx-a11y/no-list-item-without-parent
                      li: ({ children }) => (
                        <li className="text-slate-300 text-[15px] flex items-start gap-2">
                          <span className="text-accent mt-1.5 shrink-0">›</span>
                          <span>{children}</span>
                        </li>
                      ),
                      strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
                      hr: () => <hr className="border-border my-8" />,
                    }}
                  >
                    {brief.preview}
                  </ReactMarkdown>
                </div>

                {brief.isTruncated && (
                  <div className="relative mt-4">
                    <div className="pointer-events-none select-none opacity-15 blur-sm text-sm text-slate-400 leading-relaxed">
                      The remaining sections include portfolio analysis, rebalancing signals, sector rotation map, sentiment vs price, and 3 high-conviction research ideas — all personalised to the portfolio owner's actual holdings and weekly performance data.
                    </div>
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-surface/85 to-surface">
                      <div className="text-center max-w-sm px-4">
                        <Lock className="h-8 w-8 text-primary-light mx-auto mb-4" />
                        <h3 className="font-heading text-xl text-white mb-2">Get your own personalized brief</h3>
                        <p className="text-muted text-sm mb-6 leading-relaxed">
                          This brief is personalised to someone else&apos;s portfolio. Yours will be built from your actual holdings, your real P&amp;L, and what specifically moved your money this week.
                        </p>
                        <Link
                          href="/sign-up"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl transition-colors text-sm"
                        >
                          Start free — no card needed <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-muted/70 text-center leading-relaxed pb-4">
              Not financial advice.{' '}
              <Link href="/disclaimer" className="underline hover:text-slate-300">Full disclaimer</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
