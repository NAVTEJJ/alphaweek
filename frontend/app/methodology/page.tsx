import Link from 'next/link';
import { LandingNav } from '@/components/landing/LandingNav';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How AlphaWeek Works — Methodology',
  description: 'Exactly how AlphaWeek generates your weekly investment brief: data sources, AI pipeline, fact-checking, and what the product cannot do.',
};

const SECTIONS = [
  {
    title: 'Data sources',
    content: [
      'Price data comes from Yahoo Finance via their public API. Quotes are delayed up to 15 minutes. We never use real-time data because we do not pay for a real-time feed — we tell you this upfront on every page that shows prices.',
      'Crypto prices come from CoinGecko. We pull the top coins by market cap and their 7-day performance.',
      'Macro sentiment comes from the Alternative.me Fear & Greed Index — a composite of seven market indicators.',
      'Geopolitical news comes from NewsAPI. We pull articles from the past 7 days, filtered by relevance to financial markets.',
      'Retail sentiment comes from Reddit via the official Reddit OAuth API. We read public posts from r/investing, r/stocks, and r/wallstreetbets.',
      'Your portfolio data comes from you. We never connect to your brokerage. You enter your holdings manually or import via CSV. We store your ticker symbols, quantities, and average buy prices — nothing else.',
    ],
  },
  {
    title: 'How the brief is generated',
    content: [
      'Every Monday at 12:00 UTC (7:00 AM ET), a job enqueues a brief generation task for each user. The task fetches live market data, pulls your current portfolio from our database, runs the Reddit sentiment classifier, and assembles a structured data payload.',
      'That payload is sent to a large language model (currently Llama 3.3 70B via Groq) with a detailed prompt that specifies every section of the brief, the required format, and explicit rules about what the model is and is not allowed to say.',
      'The model is instructed to cite specific numbers from the data it is given. It is explicitly told: if the data does not support a claim, do not make the claim.',
      'The sentiment classification step is separate. Reddit posts are classified as bullish, bearish, or neutral using a second LLM call optimised for that task. Negation and sarcasm detection are built into the classifier prompt.',
      'Geopolitical events are labelled for market impact (CRITICAL / HIGH / MEDIUM / LOW) by a third LLM call, separate from the main brief generation.',
    ],
  },
  {
    title: 'Fact-checking',
    content: [
      'After every brief is generated, a verification pass extracts every percentage figure and named number from the content and checks whether a matching figure exists in the source data we fed the model.',
      'Figures that cannot be traced to a source are flagged in our production telemetry. We review these weekly. We do not remove flagged briefs from delivery — we flag them internally and use them to improve the prompt.',
      'The source attribution line at the bottom of every brief (e.g. "NewsAPI: 12 articles · Reddit: 203 posts") shows the actual counts from that week\'s data pull, not a fixed estimate.',
    ],
  },
  {
    title: 'What AlphaWeek cannot do',
    content: [
      'We cannot give you real-time prices. Yahoo Finance\'s free API is delayed up to 15 minutes. If you need real-time data, you need a paid data feed.',
      'We cannot tell you what to buy or sell. AlphaWeek is informational analysis, not investment advice. We are not a registered investment advisor.',
      'We cannot connect to your brokerage. You manage your own trades. We have no access to your brokerage account, your cash balance, or your order history.',
      'We cannot guarantee the AI is correct. The model can make mistakes. Every brief says this explicitly. The fact-checking pass catches many errors but not all.',
      'We cannot cover every asset class. We cover US equities (NASDAQ, NYSE), Indian equities (NSE, BSE), and cryptocurrency. No options, no futures, no fixed income, no commodities trading.',
      'We cannot cover illiquid or unlisted stocks. If Yahoo Finance does not have a quote for your ticker, we cannot include it in your portfolio analysis.',
    ],
  },
  {
    title: 'Privacy and data',
    content: [
      'We store your email address (from Clerk authentication), your portfolio holdings, your alert preferences, and your brief history.',
      'We do not store your broker credentials. We have no access to your brokerage.',
      'We do not sell your data to third parties.',
      'Your portfolio data is used solely to generate your brief and power the portfolio tracker. We aggregate portfolio data anonymously across users for one purpose only: the "most widely held stocks this week" signal in the brief. This aggregation contains no personally identifiable information.',
      'You can delete your account and all associated data at any time from the Settings page.',
    ],
  },
];

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-surface-2">
      <LandingNav />

      <div className="max-w-2xl mx-auto px-4 pt-28 pb-16 space-y-12">
        <div>
          <h1 className="font-heading text-4xl text-white tracking-tight mb-3">How AlphaWeek works</h1>
          <p className="text-muted leading-relaxed">
            We think you deserve to know exactly how your brief is made — what data feeds it, how the AI generates it, what we check before sending it, and where it can go wrong. This page covers all of that in plain language.
          </p>
        </div>

        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-heading text-xl text-white mb-4 pb-2 border-b border-border">
              {section.title}
            </h2>
            <ul className="space-y-3">
              {section.content.map((para, i) => (
                <li key={i} className="flex items-start gap-3 text-slate-300 text-[15px] leading-relaxed">
                  <span className="text-accent mt-1.5 shrink-0">›</span>
                  <span>{para}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="pt-4 border-t border-border flex flex-wrap gap-4 text-xs text-muted">
          <Link href="/disclaimer" className="hover:text-slate-300 transition-colors">Full disclaimer</Link>
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">Privacy policy</Link>
          <Link href="/terms" className="hover:text-slate-300 transition-colors">Terms of service</Link>
        </div>
      </div>
    </div>
  );
}
