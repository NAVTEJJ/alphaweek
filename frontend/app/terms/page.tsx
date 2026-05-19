import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'AlphaWeek Terms of Service — the rules governing your use of the platform.',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-slate-300">
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl text-white">AlphaWeek</Link>
          <Link href="/dashboard" className="text-sm text-primary-light hover:underline">Dashboard →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <div>
          <h1 className="font-heading text-4xl text-white mb-2">Terms of Service</h1>
          <p className="text-muted text-sm">Last updated: May 2025</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-amber-200 leading-relaxed">
            <strong>Important:</strong> AlphaWeek is an informational platform. Nothing on this platform constitutes
            financial advice, investment recommendations, or solicitations to buy or sell any security. Please read
            our{' '}
            <Link href="/disclaimer" className="underline">Disclaimer</Link> before using AlphaWeek.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">1. Acceptance of Terms</h2>
          <p>
            By creating an account or using AlphaWeek ("the Service"), you agree to be bound by these Terms of
            Service ("Terms"). If you do not agree, do not use the Service. These Terms apply to all users,
            including free-tier and paid subscribers.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">2. Eligibility</h2>
          <p>
            You must be at least 18 years old to use AlphaWeek. By using the Service, you represent that you are
            18 or older and have the legal capacity to enter into these Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">3. Account Responsibilities</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-400">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must notify us immediately at <a href="mailto:support@alphaweek.io" className="text-primary-light hover:underline">support@alphaweek.io</a> if you suspect unauthorised access.</li>
            <li>You may not share your account with others or use another person's account.</li>
            <li>API keys (WhiteLabel plan) must not be shared publicly or embedded in client-side code.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">4. Subscriptions and Billing</h2>
          <p>
            Paid plans are billed monthly through Stripe. All plans include a 14-day free trial. You may cancel at
            any time via the billing portal in Settings; cancellation takes effect at the end of the current billing
            period. No refunds are issued for partial billing periods unless required by applicable law.
          </p>
          <p>
            We reserve the right to change pricing with 30 days' notice. Continued use after a price change
            constitutes acceptance.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">5. Acceptable Use</h2>
          <p>You agree <strong className="text-slate-200">not</strong> to:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-400">
            <li>Reverse engineer, decompile, or attempt to extract the source code of the Service.</li>
            <li>Use automated scripts or bots to scrape or abuse the Service.</li>
            <li>Resell or redistribute AlphaWeek content without a WhiteLabel plan agreement.</li>
            <li>Use the Service for any unlawful purpose or in violation of any applicable law or regulation.</li>
            <li>Attempt to circumvent rate limits, plan gates, or other access controls.</li>
            <li>Submit false or misleading information to the Service.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">6. Intellectual Property</h2>
          <p>
            AlphaWeek and its underlying technology, brand, and generated content are owned by AlphaWeek and
            protected by applicable intellectual property laws. Your personalised briefs are licensed to you for
            personal, non-commercial use only.
          </p>
          <p>
            Content you submit (portfolio data, watchlist) remains yours. You grant AlphaWeek a limited licence to
            process it solely for the purpose of providing the Service.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, AlphaWeek shall not be liable for any indirect, incidental,
            special, or consequential damages arising from your use of the Service, including but not limited to
            investment losses, loss of profits, or loss of data.
          </p>
          <p>
            Our total liability to you shall not exceed the amount you paid to AlphaWeek in the 12 months
            preceding the claim.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">8. Termination</h2>
          <p>
            We may suspend or terminate your account if you breach these Terms, engage in fraudulent activity, or
            if we discontinue the Service. Upon termination, your access to the Service ceases. You may request an
            export of your data within 30 days of termination.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Any dispute arising from these Terms shall be subject
            to the exclusive jurisdiction of the courts of [Your Jurisdiction].
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">10. Changes to Terms</h2>
          <p>
            We may update these Terms at any time. We will provide at least 14 days' notice of material changes via
            email or in-app notification. Continued use of the Service after the effective date constitutes
            acceptance of the updated Terms.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">11. Contact</h2>
          <p>
            For questions about these Terms, contact us at{' '}
            <a href="mailto:legal@alphaweek.io" className="text-primary-light hover:underline">
              legal@alphaweek.io
            </a>.
          </p>
        </section>

        <div className="border-t border-border pt-8 flex gap-6 text-sm text-muted">
          <Link href="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</Link>
          <Link href="/disclaimer" className="hover:text-slate-200 transition-colors">Disclaimer</Link>
          <Link href="/" className="hover:text-slate-200 transition-colors">Home</Link>
        </div>
      </main>
    </div>
  );
}
