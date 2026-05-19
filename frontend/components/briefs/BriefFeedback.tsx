'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { fetchBriefFeedback, submitBriefFeedback } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Inline thumbs-up / thumbs-down panel for the brief detail page. Captures
// optional reason on down-votes so prompt-tuning has direction to work with.
export function BriefFeedback({ briefId }: { briefId: string }) {
  const qc = useQueryClient();
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [savedReason, setSavedReason] = useState(false);

  const { data } = useQuery({
    queryKey: ['brief', 'feedback', briefId],
    queryFn: () => fetchBriefFeedback(briefId),
    staleTime: 5 * 60_000,
  });

  const { mutate: vote, isPending } = useMutation({
    mutationFn: ({ vote, reason }: { vote: 'up' | 'down'; reason?: string }) =>
      submitBriefFeedback(briefId, vote, reason),
    onSuccess: (next) => {
      qc.setQueryData(['brief', 'feedback', briefId], next);
      if (next.myVote === 'down') setShowReason(true);
      else setShowReason(false);
    },
  });

  const myVote = data?.myVote ?? null;

  function handleSubmitReason() {
    if (!reason.trim()) return;
    vote({ vote: 'down', reason: reason.trim() });
    setSavedReason(true);
    setTimeout(() => { setShowReason(false); setSavedReason(false); }, 1200);
  }

  return (
    <div className="rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-slate-300">Was this brief useful?</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={myVote === 'up' ? 'primary' : 'outline'}
            disabled={isPending}
            onClick={() => vote({ vote: 'up' })}
            aria-label="Mark this brief as useful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            {data && data.up > 0 && <span className="font-mono">{data.up}</span>}
          </Button>
          <Button
            size="sm"
            variant={myVote === 'down' ? 'outline' : 'ghost'}
            className={cn(myVote === 'down' && 'border-loss/40 text-loss')}
            disabled={isPending}
            onClick={() => vote({ vote: 'down' })}
            aria-label="Mark this brief as not useful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            {data && data.down > 0 && <span className="font-mono">{data.down}</span>}
          </Button>
        </div>
      </div>

      {showReason && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          {savedReason ? (
            <p className="text-xs text-profit flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" /> Thanks — your feedback helps us tune future briefs.
            </p>
          ) : (
            <>
              <label htmlFor="brief-feedback-reason" className="text-xs text-muted">
                What didn&apos;t work? (optional)
              </label>
              <textarea
                id="brief-feedback-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Too long, missed a key story, generic advice…"
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowReason(false)}>Skip</Button>
                <Button size="sm" variant="primary" disabled={!reason.trim()} onClick={handleSubmitReason}>
                  Send
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
