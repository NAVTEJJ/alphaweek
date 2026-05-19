'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[GlobalError]', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-surface-2 flex flex-col items-center justify-center px-6 text-center">
      <AlertCircle className="h-12 w-12 text-loss mb-6 opacity-70" />
      <h1 className="font-heading text-2xl text-white mb-3">Something went wrong</h1>
      <p className="text-muted text-sm mb-2 max-w-sm">
        An unexpected error occurred. Our team has been notified.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted mb-6">Error ID: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Try Again
      </button>
    </div>
  );
}
