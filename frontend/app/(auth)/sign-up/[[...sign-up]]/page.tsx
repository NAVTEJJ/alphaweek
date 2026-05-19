'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SignUp } from '@clerk/nextjs';
import { TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function SignUpPage() {
  const searchParams = useSearchParams();

  // Persist referral code before Clerk redirects away
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('pending_referral_code', ref.toUpperCase());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <TrendingUp className="h-6 w-6 text-primary-light" />
            <span className="font-heading text-2xl text-white">
              Alpha<span className="text-accent">Week</span>
            </span>
          </Link>
          <p className="text-muted text-sm">
            Start your free brief — no credit card required
          </p>
        </div>
        <SignUp
          forceRedirectUrl="/onboarding"
          appearance={{
            elements: {
              card: 'bg-surface border border-border shadow-2xl',
              headerTitle: 'text-slate-100',
              headerSubtitle: 'text-muted',
              formButtonPrimary: 'bg-primary hover:bg-primary-dark',
              formFieldInput: 'bg-surface-2 border-border text-slate-100',
              footerActionLink: 'text-primary-light',
            },
          }}
        />
      </div>
    </div>
  );
}
