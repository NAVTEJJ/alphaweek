'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Menu, X } from 'lucide-react';

export function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-surface-2/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary-light" />
          <span className="font-heading text-xl text-white">
            Alpha<span className="text-accent">Week</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="#how-it-works" className="text-sm text-muted hover:text-slate-200 transition-colors">How it works</Link>
          <Link href="#features" className="text-sm text-muted hover:text-slate-200 transition-colors">Features</Link>
          <Link href="/pricing" className="text-sm text-muted hover:text-slate-200 transition-colors">Pricing</Link>
          <Link href="#faq" className="text-sm text-muted hover:text-slate-200 transition-colors">FAQ</Link>
          <Link href="/methodology" className="text-sm text-muted hover:text-slate-200 transition-colors">Methodology</Link>
          <Link href="/sign-in" className="text-sm text-muted hover:text-slate-200 transition-colors">Sign in</Link>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/sample"
            className="px-4 py-2 text-sm text-muted hover:text-slate-200 border border-border hover:border-primary/40 rounded-lg transition-colors"
          >
            Read a sample brief
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Start Free
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          className="md:hidden p-2 text-muted hover:text-white transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface-2 px-6 py-4 space-y-3">
          <Link href="#how-it-works" className="block text-sm text-muted hover:text-white transition-colors py-2" onClick={() => setMobileOpen(false)}>How it works</Link>
          <Link href="#features" className="block text-sm text-muted hover:text-white transition-colors py-2" onClick={() => setMobileOpen(false)}>Features</Link>
          <Link href="/pricing" className="block text-sm text-muted hover:text-white transition-colors py-2" onClick={() => setMobileOpen(false)}>Pricing</Link>
          <Link href="#faq" className="block text-sm text-muted hover:text-white transition-colors py-2" onClick={() => setMobileOpen(false)}>FAQ</Link>
          <Link href="/sign-in" className="block text-sm text-muted hover:text-white transition-colors py-2" onClick={() => setMobileOpen(false)}>Sign in</Link>
          <Link
            href="/sign-up"
            className="block w-full text-center px-4 py-3 bg-accent hover:bg-accent-dark text-white text-sm font-semibold rounded-lg transition-colors mt-2"
            onClick={() => setMobileOpen(false)}
          >
            Start Free — No Card Needed
          </Link>
        </div>
      )}
    </nav>
  );
}
