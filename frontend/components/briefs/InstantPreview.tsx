'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInstantPreview } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import { Loader2, Zap, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

// Shown on the dashboard when the user has no completed brief yet.
// Gives them immediate value so the 5-day wait doesn't feel empty.
export function InstantPreview() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['instant-preview'],
    queryFn: fetchInstantPreview,
    staleTime: 24 * 60 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 text-primary-light animate-spin" />
          <div>
            <p className="text-slate-300 font-medium">Analysing your portfolio…</p>
            <p className="text-muted text-sm mt-1">This takes about 20 seconds. Worth the wait.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) return null;

  const nextMonday = (() => {
    const d = new Date();
    const day = d.getUTCDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    d.setUTCDate(d.getUTCDate() + daysUntilMonday);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  })();

  return (
    <div className="space-y-3">
      {/* Preview label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-accent" />
          <span className="text-sm font-semibold text-slate-200">Your instant preview</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-accent/15 text-accent border border-accent/25">
            Preview
          </span>
        </div>
      </div>

      <Card>
        <CardContent className="py-6 px-6">
          <div className="prose-dark max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="font-heading text-lg text-white mt-6 mb-3 pb-2 border-b border-border first:mt-0">
                    {children}
                  </h2>
                ),
                p: ({ children }) => (
                  <p className="text-slate-300 leading-relaxed mb-3 text-[14px]">{children}</p>
                ),
                ul: ({ children }) => <ul className="space-y-1.5 mb-3">{children}</ul>,
                // eslint-disable-next-line jsx-a11y/no-list-item-without-parent
                li: ({ children }) => (
                  <li className="text-slate-300 text-[14px] flex items-start gap-2">
                    <span className="text-accent mt-1 shrink-0">›</span>
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="text-slate-100 font-semibold">{children}</strong>
                ),
              }}
            >
              {data.content}
            </ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Full brief CTA */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-sm">
        <Calendar className="h-4 w-4 text-primary-light shrink-0" />
        <p className="text-slate-300">
          Your full 7-section brief — with complete portfolio analysis, market thesis, and research ideas — arrives{' '}
          <span className="text-white font-medium">{nextMonday} at 7:00 AM ET</span>.
        </p>
      </div>
    </div>
  );
}
