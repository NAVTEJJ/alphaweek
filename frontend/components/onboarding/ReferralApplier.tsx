'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@clerk/nextjs';
import { applyReferralCode } from '@/lib/api';
import { trackEvent, Events } from '@/lib/analytics';

// Runs once per session after sign-in. If a referral code was stored during
// sign-up (from ?ref= param), silently applies it and clears storage.
export function ReferralApplier() {
  const { isSignedIn } = useAuth();
  const attempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || attempted.current) return;
    attempted.current = true;

    const pendingCode = localStorage.getItem('pending_referral_code');
    if (!pendingCode) return;

    // Fire-and-forget — don't block anything or surface errors to user
    applyReferralCode(pendingCode)
      .then(() => {
        trackEvent(Events.REFERRAL_CODE_APPLIED, { code: pendingCode, source: 'auto' });
      })
      .catch(() => {
        // Silently ignore — code may already be applied or invalid; user can apply manually in settings
      })
      .finally(() => {
        localStorage.removeItem('pending_referral_code');
      });
  }, [isSignedIn]);

  return null;
}
