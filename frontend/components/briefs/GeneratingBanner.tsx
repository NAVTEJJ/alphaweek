'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { fetchBriefQueueStatus } from '@/lib/api';

interface Props {
  briefId: string;
}

function formatEta(seconds: number): string {
  if (seconds <= 5) return 'almost ready';
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return mins === 1 ? '~1 min' : `~${mins} min`;
}

// Banner shown while a brief is in the queue. Polls every 5 seconds for queue
// position + ETA and refines its copy as the state changes:
//
//   waiting:  "You're #3 in queue · ~90s"
//   active:   "Brief generating · ~30s remaining"
//   completed: banner self-removes via the briefs query refetch
export function GeneratingBanner({ briefId }: Props) {
  const { data } = useQuery({
    queryKey: ['brief', 'queue-status', briefId],
    queryFn: () => fetchBriefQueueStatus(briefId),
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  let copy: string;
  if (!data) {
    copy = 'Brief generating — this page will update automatically.';
  } else if (data.state === 'waiting' && data.positionInQueue) {
    const eta = data.estimatedSecondsUntilStart;
    const etaPhrase = eta && eta > 0 ? ` · starts in ${formatEta(eta)}` : '';
    copy = data.positionInQueue === 1
      ? `You're next in queue${etaPhrase}.`
      : `You're #${data.positionInQueue} in queue${etaPhrase}.`;
  } else if (data.state === 'active') {
    const eta = data.estimatedSecondsUntilComplete;
    copy = eta && eta > 0 ? `Brief generating · ${formatEta(eta)} remaining.` : 'Brief generating now…';
  } else if (data.state === 'failed') {
    copy = 'Brief generation hit an error — please try again.';
  } else {
    copy = 'Brief generating — this page will update automatically.';
  }

  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-sm text-primary-light"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
      <span>{copy}</span>
    </div>
  );
}
