'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Link from 'next/link';
import { Menu, TrendingUp } from 'lucide-react';
import { useApiAuth, useAlerts } from '@/lib/hooks';
import { Sidebar } from './Sidebar';
import { MarketStrip } from '@/components/market/MarketStrip';
import { ToastProvider } from '@/components/ui/toast';
import { ReferralApplier } from '@/components/onboarding/ReferralApplier';

function ShellInner({ children }: { children: React.ReactNode }) {
  useApiAuth();
  const { data: alerts } = useAlerts();
  const unreadAlerts = Array.isArray(alerts) ? alerts.length : 0;
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-2 flex">
      <ReferralApplier />
      <Sidebar
        unreadAlerts={unreadAlerts}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      {/* Sidebar reserves 240px on md+; on mobile it overlays so no margin */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen">
        {/* Mobile-only top bar with hamburger */}
        <div className="md:hidden flex items-center justify-between h-14 px-4 bg-surface border-b border-border shrink-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="p-2 -ml-2 text-slate-200 hover:bg-surface-2 rounded-lg transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-light" />
            <span className="font-heading text-base text-white">
              Alpha<span className="text-accent">Week</span>
            </span>
          </Link>
          {/* Spacer to keep the logo centered */}
          <div className="w-9" />
        </div>

        <MarketStrip />
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60_000,
          retry: 1,
          refetchOnWindowFocus: false,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ShellInner>{children}</ShellInner>
      </ToastProvider>
    </QueryClientProvider>
  );
}
