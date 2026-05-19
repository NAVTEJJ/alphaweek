'use client';

import posthog from 'posthog-js';

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com';
  if (!key) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: false, // handled manually via usePathname
    capture_pageleave: true,
    autocapture: false, // only track explicit events for signal quality
    persistence: 'localStorage',
  });

  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.identify(userId, properties);
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function trackPageView(path: string) {
  if (!initialized) return;
  posthog.capture('$pageview', { $current_url: path });
}

// Named events used throughout the app
export const Events = {
  BRIEF_VIEWED: 'brief_viewed',
  BRIEF_GENERATED: 'brief_generated',
  PDF_DOWNLOADED: 'pdf_downloaded',
  UPGRADE_CLICKED: 'upgrade_clicked',
  CHECKOUT_STARTED: 'checkout_started',
  PORTFOLIO_UPDATED: 'portfolio_updated',
  WATCHLIST_UPDATED: 'watchlist_updated',
  TELEGRAM_CONNECTED: 'telegram_connected',
  PROFILE_SAVED: 'profile_saved',
  REFERRAL_CODE_COPIED: 'referral_code_copied',
  REFERRAL_CODE_APPLIED: 'referral_code_applied',
  BRIEF_PREVIEW_VIEWED: 'brief_preview_viewed',
  BRIEF_SHARED: 'brief_shared',
  PRICE_ALERT_CREATED: 'price_alert_created',
  PRICE_ALERT_TRIGGERED: 'price_alert_triggered',
  SIGN_UP: 'sign_up',
  SIGN_IN: 'sign_in',
  ONBOARDING_COMPLETED: 'onboarding_completed',
} as const;
