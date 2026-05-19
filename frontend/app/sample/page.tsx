'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { fetchSampleBrief, SampleBrief } from '@/lib/api';
import { MarketMood } from '@/components/briefs/MarketMood';
import { BriefSummary } from '@/components/briefs/BriefSummary';
import { LandingNav } from '@/components/landing/LandingNav';
import { TrendingUp, Clock, ArrowRight, Loader2, AlertCircle, Lock } from 'lucide-react';
import { formatDate } from '@/lib/utils';

const IMPACT_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-300 border border-red-500/30',
  HIGH:     'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  MEDIUM:   'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  LOW:      'bg-slate-500/15 text-slate-400 border border-slate-600/40',
};

function nodeToText(node: React.ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return nodeToText((node as { props: { children: React.ReactNode } }).props.children);
  }
  return '';
}

// Show the first ~900 words of the brief, then blur the rest.
const PREVIEW_WORD_LIMIT = 900;

function splitContent(content: string): { visible: string; hidden: string } {
  const words = content.trim().split(/\s+/);
  if (words.length <= PREVIEW_WORD_LIMIT) return { visible: content, hidden: '' };
  return {
    visible: words.slice(0, PREVIEW_WORD_LIMIT).join(' '),
    hidden: words.slice(PREVIEW_WORD_LIMIT).join(' '),
  };
}

export default function SampleBriefPage() {
  const [brief, setBrief] = useState<SampleBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(isRetry = false) {
    if (isRetry) setRetrying(true);
    try {
      const data = await fetchSampleBrief();
      setBrief(data);
      setError(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (msg === 'SAMPLE_GENERATING') {
        setError('generating');
      } else {
        setError('unavailable');
      }
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Auto-retry when sample is being generated
  useEffect(() => {
    if (error !== 'generating') return;
    const timer = setTimeout(() => load(true), 15_000);
    return () => clearTimeout(timer);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  const readMins = brief?.content
    ? Math.max(1, Math.ceil(brief.content.trim().split(/\s+/).length / 200))
    : 0;

  const { visible, hidden } = brief ? splitContent(brief.content) : { visible: '', hidden: '' };
  const isBlurred = hidden.length > 0;

  return (
    <div className="min-h-screen bg-surface-2">
      <LandingNav />

      {/* Demo banner */}
      <div className="pt-14">
        <div className="bg-primary/10 border-b border-primary/20 py-2.5 px-4 text-center">
          <p className="text-xs text-primary-light">
            This is a sample brief for a demo portfolio — AAPL · NVDA · MSFT · GOOGL · BTC · RELIANCE.{' '}
            <Link href="/sign-up" className="font-semibold underline hover:text-white transition-colors">
              Sign up free to get yours →
            </Link>
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 className="h-10 w-10 text-primary-light animate-spin" />
            <p className="text-muted text-sm">Loading sample brief…</p>
          </div>
        )}

        {!loading && error === 'generating' && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <Loader2 className={`h-10 w-10 text-primary-light ${retrying ? 'animate-spin' : ''}`} />
            <div>
              <p className="text-slate-300 font-medium">Generating this week&apos;s sample brief…</p>
              <p className="text-muted text-sm mt-1">Takes about 30–60 seconds. Refreshing automatically.</p>
            </div>
          </div>
        )}

        {!loading && error === 'unavailable' && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <AlertCircle className="h-10 w-10 text-loss" />
            <div>
              <p className="text-slate-300 font-medium">Sample brief temporarily unavailable</p>
              <p className="text-muted text-sm mt-1">Check back in a few minutes.</p>
            </div>
            <button
              type="button"
              onClick={() => load(true)}
              className="px-4 py-2 text-sm bg-surface border border-border rounded-lg text-slate-300 hover:text-white transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {brief && !error && (
          <>
            {/* Header */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-primary-light" />
                <span className="font-heading text-3xl text-white tracking-tight">AlphaWeek Brief</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                <p className="text-muted text-sm font-mono">Week of {formatDate(brief.weekOf)}</p>
                {readMins > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted">
                    <Clock className="h-3 w-3" /> {readMins} min read
                  </div>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-accent/15 text-accent border border-accent/25 uppercase tracking-widest">
                  Demo portfolio
                </span>
              </div>
              <p className="text-[11px] text-muted/60 mt-2">
                Sourced from <span className="text-muted">Yahoo Finance</span> · <span className="text-muted">NewsAPI</span> · <span className="text-muted">Reddit</span> · <span className="text-muted">CoinGecko</span> · <span className="text-muted">Alternative.me</span>
              </p>
            </div>

            {/* 30-second summary */}
            {brief.briefSummary && <BriefSummary briefSummary={brief.briefSummary} />}

            {/* Market Mood */}
            {brief.mood && <MarketMood mood={brief.mood} moodReason={brief.moodReason ?? null} />}

            {/* Disclaimer */}
            <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400/70" />
              <p className="leading-relaxed">
                AI-generated analysis from live market data. Not financial advice.{' '}
                <Link href="/disclaimer" className="underline hover:text-amber-200">Full disclaimer</Link>.
              </p>
            </div>

            {/* Brief content */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="py-8 px-6 sm:px-8">
                <div className="prose-dark max-w-none">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => (
                        <h2 className="font-heading text-xl text-white mt-8 mb-4 pb-2 border-b border-border first:mt-0 scroll-mt-4">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-base font-semibold text-slate-200 mt-6 mb-2">{children}</h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-slate-300 leading-relaxed mb-4 text-[15px]">{children}</p>
                      ),
                      ul: ({ children }) => <ul className="space-y-2 mb-4 ml-2">{children}</ul>,
                      ol: ({ children }) => <ol className="space-y-3 mb-4 ml-4 list-none">{children}</ol>,
                      // eslint-disable-next-line jsx-a11y/no-list-item-without-parent
                      li: ({ children }) => (
                        <li className="text-slate-300 text-[15px] flex items-start gap-2">
                          <span className="text-accent mt-1.5 shrink-0">›</span>
                          <span>{children}</span>
                        </li>
                      ),
                      strong: ({ children }) => {
                        const text = nodeToText(children);
                        const match = text.match(/^\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*([\s\S]*)/);
                        if (match) {
                          const level = match[1] as keyof typeof IMPACT_STYLES;
                          return (
                            <span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest mr-2 ${IMPACT_STYLES[level]}`}>
                                {level}
                              </span>
                              {match[2] && <span className="text-slate-100 font-semibold">{match[2]}</span>}
                            </span>
                          );
                        }
                        return <strong className="text-slate-100 font-semibold">{children}</strong>;
                      },
                      hr: () => <hr className="border-border my-8" />,
                      em: ({ children }) => <em className="text-slate-400 not-italic font-medium">{children}</em>,
                      code: ({ children }) => (
                        <code className="font-mono text-[13px] bg-surface-2 border border-border px-1.5 py-0.5 rounded text-accent-light">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {visible}
                  </ReactMarkdown>
                </div>

                {/* Blur overlay after preview limit */}
                {isBlurred && (
                  <div className="relative mt-4">
                    <div className="pointer-events-none select-none opacity-20 blur-sm">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="text-slate-300 leading-relaxed mb-4 text-[15px]">{children}</p>,
                          h2: ({ children }) => <h2 className="font-heading text-xl text-white mt-8 mb-4">{children}</h2>,
                          strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
                          // eslint-disable-next-line jsx-a11y/no-list-item-without-parent
                          li: ({ children }) => <li className="text-slate-300 flex items-start gap-2"><span>›</span><span>{children}</span></li>,
                        }}
                      >
                        {hidden.slice(0, 800)}
                      </ReactMarkdown>
                    </div>

                    {/* Paywall CTA */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-transparent via-surface/80 to-surface">
                      <div className="text-center max-w-sm px-4">
                        <Lock className="h-8 w-8 text-primary-light mx-auto mb-4" />
                        <h3 className="font-heading text-xl text-white mb-2">Get this for your portfolio</h3>
                        <p className="text-muted text-sm mb-6 leading-relaxed">
                          Sign up free and get a brief personalized to your actual holdings — every Monday, before the market opens.
                        </p>
                        <Link
                          href="/sign-up"
                          className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl transition-colors"
                        >
                          Get my free brief <ArrowRight className="h-4 w-4" />
                        </Link>
                        <p className="text-xs text-muted mt-3">No card needed. Cancels in one click.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Closing question (only shown if full content visible) */}
                {!isBlurred && brief.closingQuestion && (
                  <div className="mt-8 pt-6 border-t border-border">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">
                      This week, ask yourself:
                    </p>
                    <p className="text-[15px] text-slate-400 italic leading-relaxed">
                      {brief.closingQuestion}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
              <h2 className="font-heading text-2xl text-white mb-2">Get this for your portfolio</h2>
              <p className="text-muted text-sm mb-6 max-w-md mx-auto leading-relaxed">
                This was generated for a demo portfolio. Your brief will analyse your actual holdings, your real P&amp;L, and what specifically moved your money this week.
              </p>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Start free — no card needed <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <p className="text-[11px] text-muted/70 text-center leading-relaxed pb-4">
              Past performance is not indicative of future results. Not financial advice.{' '}
              <Link href="/disclaimer" className="underline hover:text-slate-300">Full disclaimer</Link>.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
