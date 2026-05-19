'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <AlertCircle className="h-10 w-10 text-loss mb-4 opacity-70" />
      <h2 className="text-lg font-semibold text-white mb-2">Failed to load</h2>
      <p className="text-sm text-muted mb-6 max-w-xs">
        {error.message ?? 'An error occurred loading this page.'}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Retry
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2 border border-border text-slate-300 hover:text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
