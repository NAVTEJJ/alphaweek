'use client';

import { useEffect } from 'react';
import { trackEvent, Events } from '@/lib/analytics';

export function PreviewTracker({ briefId, weekOf }: { briefId: string; weekOf: string }) {
  useEffect(() => {
    trackEvent(Events.BRIEF_PREVIEW_VIEWED, { briefId, weekOf });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
