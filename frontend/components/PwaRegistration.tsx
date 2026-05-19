'use client';

import { useEffect } from 'react';
import { ensurePushSubscribed } from '@/lib/push';

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => {
        // Re-subscribe silently if the user already granted permission
        // (handles subscription expiry on returning users)
        if (Notification.permission === 'granted') {
          ensurePushSubscribed().catch(() => null);
        }
      })
      .catch(() => null);
  }, []);

  return null;
}
