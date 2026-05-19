import Link from 'next/link';
import { TrendingUp, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-surface-2 flex flex-col items-center justify-center px-6 text-center">
      <TrendingUp className="h-12 w-12 text-primary-light mb-6 opacity-50" />
      <p className="font-mono text-6xl font-bold text-slate-700 mb-2">404</p>
      <h1 className="font-heading text-2xl text-white mb-3">Page not found</h1>
      <p className="text-muted text-sm mb-8 max-w-xs">
        This page doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-semibold rounded-lg transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>
    </div>
  );
}
