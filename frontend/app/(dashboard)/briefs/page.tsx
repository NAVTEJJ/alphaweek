'use client';

import { useState } from 'react';
import { useBriefs, useTriggerBrief } from '@/lib/hooks';
import { BriefCard } from '@/components/briefs/BriefCard';
import { GeneratingBanner } from '@/components/briefs/GeneratingBanner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

type FilterType = 'all' | 'weekly' | 'daily';

export default function BriefsPage() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<FilterType>('all');
  const { data, isLoading } = useBriefs(page);
  const { mutate: triggerBrief, isPending: triggering } = useTriggerBrief();

  const allBriefs = data?.data ?? [];
  const briefs = filter === 'all'
    ? allBriefs
    : allBriefs.filter((b: { briefType?: string }) => (b.briefType ?? 'weekly') === filter);
  const meta = data?.meta ?? { total: 0, totalPages: 1 };
  const hasDaily = allBriefs.some((b: { briefType?: string }) => b.briefType === 'daily');
  // Find the most recently-created brief that's still in-flight. The banner
  // tracks just one (the user's own latest) — this avoids a per-brief poll storm
  // when multiple briefs are pending.
  const generatingBrief = allBriefs.find(
    (b: { status?: string }) => b.status === 'pending' || b.status === 'generating'
  ) as { id: string; status?: string } | undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl text-white">My Briefs</h1>
          <p className="text-muted text-sm mt-1">
            {meta.total} brief{meta.total !== 1 ? 's' : ''} generated
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          loading={triggering}
          onClick={() => triggerBrief()}
        >
          <RefreshCw className="h-4 w-4" />
          Generate Now
        </Button>
      </div>

      {/* Generating banner — shows live queue position + ETA */}
      {generatingBrief && <GeneratingBanner briefId={generatingBrief.id} />}

      {/* Filter tabs — only shown when user has daily briefs */}
      {hasDaily && (
        <div className="flex gap-1 p-1 bg-surface rounded-xl border border-border w-fit">
          {(['all', 'weekly', 'daily'] as FilterType[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => { setFilter(f); setPage(1); }}
              className={clsx(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize',
                filter === f
                  ? 'bg-primary text-white'
                  : 'text-muted hover:text-slate-300'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-surface animate-pulse" />
          ))}
        </div>
      ) : briefs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 text-muted mx-auto mb-4" />
            <p className="text-slate-300 font-medium mb-1">No briefs yet</p>
            <p className="text-sm text-muted mb-4">
              Daily briefs arrive before US market open, Monday–Friday. Weekly deep-dive every Monday.
            </p>
            <Button
              variant="accent"
              size="sm"
              onClick={() => triggerBrief()}
              loading={triggering}
            >
              Generate First Brief
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {briefs.map((brief: Parameters<typeof BriefCard>[0]['brief']) => (
              <BriefCard key={brief.id} brief={brief} />
            ))}
          </div>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted font-mono">
                {page} / {meta.totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page === meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
