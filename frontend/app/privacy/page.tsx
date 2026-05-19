import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How AlphaWeek collects, uses, and protects your personal information.',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-slate-300">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-heading text-xl text-white">AlphaWeek</Link>
          <Link href="/dashboard" className="text-sm text-primary-light hover:underline">Dashboard →</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 space-y-10">
        <div>
          <h1 className="font-heading text-4xl text-white mb-2">Privacy Policy</h1>
          <p className="text-muted text-sm">Last updated: May 2025</p>
        </div>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">1. Information We Collect</h2>
          <p>When you create an AlphaWeek account, we collect:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-400">
            <li><strong className="text-slate-200">Account data</strong> — your email address and display name, provided via Clerk authentication.</li>
            <li><strong className="text-slate-200">Portfolio data</strong> — ticker symbols, quantities, and purchase prices you enter voluntarily.</li>
            <li><strong className="text-slate-200">Watchlist data</strong> — ticker symbols you add to your watchlist.</li>
            <li><strong className="text-slate-200">Telegram chat ID</strong> — only if you choose to connect Telegram for brief delivery.</li>
            <li><strong className="text-slate-200">Billing data</strong> — processed entirely by Stripe. We never store your card number.</li>
            <li><strong className="text-slate-200">Usage analytics</strong> — aggregated, anonymized events via PostHog (e.g., features used, pages visited).</li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-400">
            <li>To generate your personalised weekly investment brief.</li>
            <li>To send brief and alert notifications via email and/or Telegram.</li>
            <li>To process and manage your subscription via Stripe.</li>
            <li>To improve AlphaWeek features based on anonymised usage patterns.</li>
            <li>To respond to support requests.</li>
          </ul>
          <p>We do <strong className="text-slate-200">not</strong> sell your personal data to third parties.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">3. Third-Party Services</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
              <thead className="bg-surface-2">
                <tr>
                  <th className="px-4 py-3 text-left text-slate-200">Service</th>
                  <th className="px-4 py-3 text-left text-slate-200">Purpose</th>
                  <th className="px-4 py-3 text-left text-slate-200">Data Shared</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['Clerk', 'Authentication', 'Email, name'],
                  ['Stripe', 'Payments & billing', 'Email, payment method'],
                  ['AI Language Model', 'Brief generation', 'Portfolio tickers, anonymised'],
                  ['Resend', 'Transactional email', 'Email address'],
                  ['Telegram', 'Brief delivery (optional)', 'Chat ID (user-initiated)'],
                  ['Neon PostgreSQL', 'Database', 'All stored data (encrypted at rest)'],
                  ['Cloudflare R2', 'PDF storage', 'Generated PDF briefs'],
                  ['PostHog', 'Analytics', 'Anonymised usage events'],
                ].map(([service, purpose, data]) => (
                  <tr key={service} className="bg-surface">
                    <td className="px-4 py-3 text-slate-200 font-medium">{service}</td>
                    <td className="px-4 py-3 text-slate-400">{purpose}</td>
                    <td className="px-4 py-3 text-slate-400">{data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">4. Data Retention</h2>
          <p>
            Your account data is retained for as long as your account is active. If you delete your account, we
            delete all personal data within 30 days. Generated brief PDFs stored in Cloudflare R2 are also removed.
            Anonymised analytics data may be retained for up to 2 years.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">5. Security</h2>
          <p>
            All data is encrypted in transit using TLS 1.3. Database data is encrypted at rest via Neon PostgreSQL.
            API keys are stored as SHA-256 hashes — the plaintext key is shown only once at creation and never stored.
            Access to production systems is restricted to authorised team members only.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">6. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-400">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your account and associated data.</li>
            <li>Object to or restrict certain processing.</li>
            <li>Data portability (export your brief history and portfolio data).</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href="mailto:privacy@alphaweek.io" className="text-primary-light hover:underline">
              privacy@alphaweek.io
            </a>.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">7. Cookies</h2>
          <p>
            AlphaWeek uses strictly necessary session cookies managed by Clerk for authentication. We do not use
            advertising cookies. PostHog analytics may use a first-party cookie for session continuity; it can be
            disabled via your browser settings.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">8. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy occasionally. We will notify you of material changes via email and/or
            an in-app notice at least 14 days before the changes take effect.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-white">9. Contact</h2>
          <p>
            Questions about this policy? Contact us at{' '}
            <a href="mailto:privacy@alphaweek.io" className="text-primary-light hover:underline">
              privacy@alphaweek.io
            </a>{' '}
            or write to: AlphaWeek, Data Privacy Team, [Your Address].
          </p>
        </section>

        <div className="border-t border-border pt-8 flex gap-6 text-sm text-muted">
          <Link href="/terms" className="hover:text-slate-200 transition-colors">Terms of Service</Link>
          <Link href="/disclaimer" className="hover:text-slate-200 transition-colors">Disclaimer</Link>
          <Link href="/" className="hover:text-slate-200 transition-colors">Home</Link>
        </div>
      </main>
    </div>
  );
}
