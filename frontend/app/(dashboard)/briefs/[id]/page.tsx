'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBrief, useLivePortfolio, useWatchlist } from '@/lib/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, Loader2, AlertCircle, Clock, MessageSquare, Link2, Check } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { trackEvent, Events } from '@/lib/analytics';
import { fetchSignedBriefPdfUrl } from '@/lib/api';
import { BriefVisuals } from '@/components/briefs/BriefVisuals';
import { BriefFeedback } from '@/components/briefs/BriefFeedback';
import { BriefDiff } from '@/components/briefs/BriefDiff';
import { MarketMood } from '@/components/briefs/MarketMood';
import { BriefSummary } from '@/components/briefs/BriefSummary';
import { buildTickerLookup, linkifyTickers } from '@/components/briefs/linkTickers';
import type { ReactNode } from 'react';

const IMPACT_STYLES: Record<string, string> = {
  CRITICAL: 'bg-red-500/15 text-red-300 border border-red-500/30',
  HIGH:     'bg-amber-500/15 text-amber-300 border border-amber-500/30',
  MEDIUM:   'bg-blue-500/15 text-blue-300 border border-blue-500/30',
  LOW:      'bg-slate-500/15 text-slate-400 border border-slate-600/40',
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function nodeToText(node: ReactNode): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(nodeToText).join('');
  if (node && typeof node === 'object' && 'props' in node) {
    return nodeToText((node as { props: { children: ReactNode } }).props.children);
  }
  return '';
}

function readingMinutes(content: string) {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).length / 200));
}

function extractSections(content: string) {
  return Array.from(content.matchAll(/^## (.+)$/gm)).map((m) => ({
    id: slugify(m[1]),
    title: m[1],
  }));
}

export default function BriefDetailPage({ params }: { params: { id: string } }) {
  const { data: brief, isLoading, isError } = useBrief(params.id);
  const { data: live } = useLivePortfolio();
  const { data: watchlist } = useWatchlist();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    if (!brief?.publicSlug) return;
    const url = `${window.location.origin}/brief/${brief.publicSlug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Build the ticker→exchange map once per render. Cheap: O(brief length).
  const tickerLookup = useMemo(
    () => buildTickerLookup({
      holdings: live?.holdings,
      watchlist: watchlist?.tickers,
      briefContent: brief?.content ?? undefined,
    }),
    [live?.holdings, watchlist?.tickers, brief?.content]
  );

  useEffect(() => {
    if (brief) {
      trackEvent(Events.BRIEF_VIEWED, {
        briefId: brief.id,
        weekOf: brief.weekOf,
        plan: brief.planAtGeneration,
      });
    }
  }, [brief?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePdfDownload() {
    if (!brief || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { url } = await fetchSignedBriefPdfUrl(brief.id);
      trackEvent(Events.PDF_DOWNLOADED, { briefId: brief.id, weekOf: brief.weekOf });
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setPdfLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 text-primary-light animate-spin" />
      </div>
    );
  }

  if (isError || !brief) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-loss" />
        <p className="text-slate-300">Brief not found</p>
        <Link href="/briefs">
          <Button variant="outline" size="sm">Back to Briefs</Button>
        </Link>
      </div>
    );
  }

  const sections = brief.content ? extractSections(brief.content) : [];
  const readMins = brief.content ? readingMinutes(brief.content) : 0;

  return (
    <div className="max-w-3xl space-y-5">
      {/* Back + actions */}
      <div className="flex items-center justify-between">
        <Link href="/briefs">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          {brief.publicSlug && (
            <Button variant="ghost" size="sm" onClick={handleCopyLink}>
              {copied ? <Check className="h-4 w-4 text-profit" /> : <Link2 className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Share'}
            </Button>
          )}
          <Link href={`/chat?briefId=${encodeURIComponent(brief.id)}`}>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4" /> Ask AI
            </Button>
          </Link>
          {brief.pdfUrl && (
            <Button variant="accent" size="sm" onClick={handlePdfDownload} loading={pdfLoading}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          )}
        </div>
      </div>

      {/* Brief header */}
      <div>
        <h1 className="font-heading text-3xl text-white tracking-tight">AlphaWeek Brief</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
          <p className="text-muted text-sm font-mono">
            {brief.briefType === 'daily' ? formatDate(brief.weekOf) : `Week of ${formatDate(brief.weekOf)}`}
          </p>
          {readMins > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Clock className="h-3 w-3" />
              {readMins} min read
            </div>
          )}
          {brief.generatedAt && (
            <p className="text-xs text-muted/60 font-mono hidden sm:block">
              Generated {new Date(brief.generatedAt).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
              })}
            </p>
          )}
        </div>
        {/* Source attribution — what this brief was built from */}
        <p className="text-[11px] text-muted/60 mt-2">
          Sourced from <span className="text-muted">Yahoo Finance</span> · <span className="text-muted">NewsAPI</span> · <span className="text-muted">Reddit</span> · <span className="text-muted">CoinGecko</span> · <span className="text-muted">Alternative.me</span>
        </p>
      </div>

      {/* 30-second summary — highest-signal content, first thing they read */}
      {brief.briefSummary && <BriefSummary briefSummary={brief.briefSummary} />}

      {/* Market Mood indicator */}
      {brief.mood && <MarketMood mood={brief.mood} moodReason={brief.moodReason ?? null} />}

      {/* Data viz — index sparklines, sector mix, holding P&L */}
      <BriefVisuals />

      {/* Week-over-week diff — only shows when a prior brief exists */}
      {brief.status === 'completed' && <BriefDiff briefId={brief.id} />}

      {/* Inline disclaimer — set expectations before the user reads */}
      <div className="flex items-start gap-2.5 px-4 py-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400/70" />
        <p className="leading-relaxed">
          AI-generated analysis from live market data. Not financial advice — always verify before acting.
          <Link href="/disclaimer" className="ml-1 underline hover:text-amber-200">Full disclaimer</Link>.
        </p>
      </div>

      {/* Section jump navigation */}
      {sections.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {sections.map((sec) => (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              className="shrink-0 px-3 py-1.5 text-xs text-muted hover:text-slate-200 bg-surface hover:bg-surface-2 border border-border rounded-lg transition-all whitespace-nowrap"
            >
              {sec.title}
            </a>
          ))}
        </div>
      )}

      {/* Content */}
      <Card>
        <CardContent className="py-8 px-6 sm:px-8">
          {brief.content ? (
            <div className="prose-dark max-w-none">
              <ReactMarkdown
                components={{
                  text: ({ children }) =>
                    typeof children === 'string' ? <>{linkifyTickers(children, tickerLookup)}</> : <>{children}</>,
                  h2: ({ children }) => {
                    const text = nodeToText(children);
                    return (
                      <h2
                        id={slugify(text)}
                        className="font-heading text-xl text-white mt-8 mb-4 pb-2 border-b border-border first:mt-0 scroll-mt-4"
                      >
                        {children}
                      </h2>
                    );
                  },
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-slate-200 mt-6 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-slate-300 leading-relaxed mb-4 text-[15px]">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-2 mb-4 ml-2">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="space-y-3 mb-4 ml-4 list-none">{children}</ol>
                  ),
                  // ReactMarkdown always wraps li inside ul/ol — linter false positive
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
                      const rest = match[2];
                      return (
                        <span>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest mr-2 ${IMPACT_STYLES[level]}`}
                          >
                            {level}
                          </span>
                          {rest && <span className="text-slate-100 font-semibold">{rest}</span>}
                        </span>
                      );
                    }
                    return <strong className="text-slate-100 font-semibold">{children}</strong>;
                  },
                  em: ({ children }) => (
                    <em className="text-slate-400 not-italic font-medium">{children}</em>
                  ),
                  hr: () => <hr className="border-border my-8" />,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-accent/50 pl-4 my-4 text-muted italic">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children }) => (
                    <code className="font-mono text-[13px] bg-surface-2 border border-border px-1.5 py-0.5 rounded text-accent-light">
                      {children}
                    </code>
                  ),
                }}
              >
                {brief.content}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted text-sm">Content not available for this brief.</p>
          )}

          {/* Closing question — appears after the last section, inside the card */}
          {brief.closingQuestion && (
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-2">
                This week, ask yourself:
              </p>
              <p className="text-[15px] text-slate-400 italic leading-relaxed">
                {brief.closingQuestion}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback */}
      {brief.status === 'completed' && brief.content && <BriefFeedback briefId={brief.id} />}

      {/* Footer disclaimer — legal anchor at the end of the document */}
      <p className="text-[11px] text-muted/70 leading-relaxed text-center pt-2">
        Past performance is not indicative of future results. AlphaWeek is not a registered investment
        advisor. <Link href="/disclaimer" className="underline hover:text-slate-300">Read the full disclaimer</Link>.
      </p>
    </div>
  );
}
