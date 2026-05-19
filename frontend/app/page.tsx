import Link from 'next/link';
import {
  TrendingUp,
  Globe,
  BrainCircuit,
  Send,
  BarChart3,
  Shield,
  FileText,
  ChevronRight,
  Check,
  Star,
  Zap,
  ArrowRight,
  Bell,
  Calendar,
  Target,
  Lock,
} from 'lucide-react';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingNav } from '@/components/landing/LandingNav';

const FEATURES = [
  {
    icon: Globe,
    title: 'US + India + Crypto',
    desc: 'Full coverage of S&P 500, NASDAQ, Nifty 50, Sensex, Bitcoin, and 200+ assets — every week.',
    color: 'text-primary-light',
    bg: 'bg-primary/10',
  },
  {
    icon: BrainCircuit,
    title: 'LLM Powered',
    desc: "State-of-the-art language models synthesize global data into a coherent, actionable narrative.",
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: BarChart3,
    title: 'Portfolio Analysis',
    desc: 'Track your holdings. Get weekly P&L, rebalancing suggestions, and benchmark comparisons.',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Shield,
    title: 'Geo-Risk Radar',
    desc: 'CRITICAL/HIGH/MEDIUM geo-political event scoring — conflict, trade policy, energy, regulation.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Bell,
    title: 'Price Alerts',
    desc: 'Set target prices on any ticker. Get instant email + Telegram notification when levels are hit.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: Calendar,
    title: 'Earnings Calendar',
    desc: "Never miss a key earnings date for stocks in your portfolio or watchlist. Synced every week.",
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    icon: Send,
    title: 'Email + Telegram',
    desc: 'Delivered wherever you want it. Beautifully formatted email or instant Telegram message.',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
  },
  {
    icon: FileText,
    title: 'PDF Downloads',
    desc: 'Every brief is a beautifully designed PDF — archive, share, or read offline anytime.',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
  },
  {
    icon: Target,
    title: 'Watchlist Mentions',
    desc: 'Every ticker in your watchlist gets a dedicated paragraph in your brief if it moves.',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
  },
];

const STEPS = [
  {
    num: '01',
    title: 'Connect your portfolio',
    desc: 'Add your holdings and watchlist. AlphaWeek supports NASDAQ, NYSE, NSE, BSE, and Crypto.',
    icon: BarChart3,
  },
  {
    num: '02',
    title: 'AI analyzes global markets',
    desc: 'Every Monday, our AI ingests live market data, geopolitical events, and your portfolio — and writes your brief.',
    icon: BrainCircuit,
  },
  {
    num: '03',
    title: 'Delivered to your inbox',
    desc: 'You receive a beautifully formatted brief via email and/or Telegram. Download as PDF. Done in 8 minutes.',
    icon: Send,
  },
];

const EARLY_FEEDBACK = [
  {
    quote: 'The geo-risk section is the most useful thing I\'ve read all week. Makes every Monday morning actually actionable.',
    initial: 'A',
  },
  {
    quote: "I'm not a finance professional but I invest actively. AlphaWeek explains macro trends in plain English and tells me what to watch in my portfolio.",
    initial: 'S',
  },
  {
    quote: 'Saves me two hours of Monday morning research. The data is solid and the AI synthesis is far better than I expected.',
    initial: 'D',
  },
  {
    quote: 'BTC/ETH weekly breakdown with macro context is exactly what was missing from my research stack.',
    initial: 'K',
  },
  {
    quote: "It gives me a ready-made, data-backed narrative of the week's market moves — without stitching together a dozen sources.",
    initial: 'L',
  },
];

const STATS = [
  { value: '3', label: 'Global markets covered' },
  { value: '9', label: 'AI intelligence modules' },
  { value: '52×', label: 'Briefs per year' },
  { value: '<3min', label: 'Read time per brief' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface-2 text-slate-100">
      <LandingNav />

      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative pt-28 pb-20 px-6 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="absolute top-24 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-accent/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-6">
                <Zap className="h-3.5 w-3.5 text-primary-light" />
                <span className="text-xs text-slate-300 font-medium">Powered by AI · US + India + Crypto · Every Monday</span>
              </div>

              <h1 className="font-heading text-5xl md:text-6xl text-white leading-[1.1] mb-5">
                Your Personal{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-sky-400 to-accent">
                  AI Investment
                </span>{' '}
                Analyst. Every Week.
              </h1>

              <p className="text-lg text-muted leading-relaxed mb-8 max-w-lg">
                AlphaWeek delivers institutional-grade investment intelligence — market analysis, portfolio
                health, geo-political risk, and price alerts — straight to your inbox every Monday morning.
              </p>

              <div className="flex flex-col sm:flex-row items-start gap-3 mb-8">
                <Link
                  href="/sign-up"
                  className="group flex items-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:scale-[1.02]"
                >
                  Get Started — Free in Beta
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="#features"
                  className="flex items-center gap-2 px-7 py-3.5 border border-border hover:border-border-light text-slate-300 hover:text-white font-semibold rounded-xl text-sm transition-all"
                >
                  See What&apos;s Inside <ChevronRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-profit" /> Free during public beta</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-profit" /> Every feature, every user</span>
                <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-profit" /> No card required</span>
              </div>
            </div>

            {/* Right: floating brief mockup */}
            <div className="relative hidden lg:block">
              <div className="absolute -top-4 -right-4 w-72 h-72 bg-accent/5 rounded-full blur-3xl" />
              <div className="relative rounded-2xl border border-border bg-surface-2 shadow-2xl shadow-black/40 overflow-hidden">
                {/* Brief header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary-light" />
                    <span className="font-heading text-base text-white">Alpha<span className="text-accent">Week</span></span>
                  </div>
                  <span className="font-mono text-xs text-muted bg-surface-2 px-2 py-1 rounded">Week of Jan 13, 2025</span>
                </div>

                <div className="p-6 space-y-4 text-xs">
                  {/* Market summary */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-8 bg-primary rounded" />
                      <span className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Weekly Summary</span>
                    </div>
                    <p className="text-muted leading-relaxed">
                      US equities posted modest gains as the Fed signaled patience.
                      S&P 500 added <span className="text-profit font-mono">+0.8%</span>,
                      while Nifty 50 faced FII outflows, losing <span className="text-loss font-mono">-1.2%</span>.
                      BTC broke above <span className="text-profit font-mono">$97,400</span>...
                    </p>
                  </div>

                  {/* Geo-risk */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-1 w-8 bg-red-500 rounded" />
                      <span className="font-semibold text-slate-200 text-xs uppercase tracking-wider">Geo-Risk Signals</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { level: 'CRITICAL', text: 'Red Sea disruptions push crude +3.4%', c: 'bg-loss/20 text-red-400' },
                        { level: 'HIGH', text: 'India–China border talks stall', c: 'bg-accent/15 text-amber-400' },
                        { level: 'MEDIUM', text: 'EU AI Act timeline confirmed', c: 'bg-primary/15 text-primary-light' },
                      ].map(({ level, text, c }) => (
                        <div key={level} className="flex items-center gap-2">
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${c}`}>{level}</span>
                          <span className="text-muted">{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Portfolio */}
                  <div className="rounded-lg bg-surface border border-border px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-muted text-[10px] uppercase tracking-wider">Your Portfolio</span>
                      <span className="font-mono text-profit text-xs font-semibold">+$1,284 this week</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {['AAPL +2.1%', 'RELIANCE +0.8%', 'BTC +4.3%'].map((t) => (
                        <span key={t} className="font-mono text-[10px] text-profit bg-profit/10 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="text-[10px] text-muted italic border-t border-border pt-3">
                    Sample brief excerpt. Delivered every Monday 08:00 UTC.
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -left-8 top-1/3 bg-surface border border-border rounded-xl px-4 py-2.5 shadow-lg">
                <p className="text-xs text-muted">Weekly P&L</p>
                <p className="font-mono font-bold text-profit text-base">+$1,284</p>
              </div>
              <div className="absolute -right-6 bottom-1/4 bg-surface border border-border rounded-xl px-4 py-2.5 shadow-lg">
                <p className="text-xs text-muted">Read time</p>
                <p className="font-mono font-bold text-primary-light text-sm">8 minutes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats bar ────────────────────────────────────────────────── */}
      <div className="border-y border-border bg-surface/50">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p className="font-heading text-3xl text-white">{value}</p>
                <p className="text-xs text-muted mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Market Ticker Strip ───────────────────────────────────────── */}
      <div className="border-b border-border bg-surface overflow-hidden py-3">
        <div className="flex gap-8 animate-ticker whitespace-nowrap">
          {['S&P 500 +0.34%', 'NASDAQ +0.62%', 'Nifty 50 -0.18%', 'Sensex -0.22%', 'BTC +1.84%', 'ETH +2.14%', 'Gold +0.45%', 'DXY -0.09%', 'Crude $78.20', 'USD/INR 83.45', 'S&P 500 +0.34%', 'NASDAQ +0.62%', 'Nifty 50 -0.18%', 'Sensex -0.22%', 'BTC +1.84%', 'ETH +2.14%', 'Gold +0.45%', 'DXY -0.09%'].map((item, i) => {
            const isUp = item.includes('+') && !item.includes('USD/INR') && !item.includes('Crude');
            const isDown = item.includes('-');
            return (
              <span key={i} className="text-xs font-mono text-slate-500 flex items-center gap-1">
                <span className="text-slate-400">{item.split(' ')[0]}</span>
                {' '}
                <span className={isUp ? 'text-profit' : isDown ? 'text-loss' : 'text-slate-400'}>
                  {item.split(' ').slice(1).join(' ')}
                </span>
                <span className="ml-6 text-border">·</span>
              </span>
            );
          })}
        </div>
      </div>

      {/* ─── How it Works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-primary-light uppercase tracking-widest">The Process</span>
            <h2 className="font-heading text-3xl md:text-4xl text-white mt-3 mb-4">
              From market data to your inbox in minutes
            </h2>
            <p className="text-muted max-w-lg mx-auto">
              Three steps. Fully automated. Every Monday, without fail.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line */}
            <div className="absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-primary/20 via-accent/30 to-primary/20 hidden md:block" />

            {STEPS.map(({ num, title, desc, icon: Icon }) => (
              <div key={num} className="relative text-center">
                <div className="relative inline-flex items-center justify-center mb-5">
                  <div className="h-16 w-16 rounded-2xl bg-surface border border-border flex items-center justify-center relative z-10">
                    <Icon className="h-7 w-7 text-primary-light" />
                  </div>
                  <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-accent text-white text-xs font-bold font-mono flex items-center justify-center z-20">
                    {num.slice(1)}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-100 mb-2">{title}</h3>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-surface border-y border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <span className="text-xs font-mono text-primary-light uppercase tracking-widest">Intelligence Modules</span>
            <h2 className="font-heading text-3xl md:text-4xl text-white mt-3 mb-4">
              Every signal you need. One brief.
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Nine intelligence modules synthesized by AI into a single weekly brief. No noise. Just signal.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="group p-6 rounded-2xl bg-surface-2 border border-border hover:border-border-light transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
              >
                <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <h3 className="text-sm font-semibold text-slate-100 mb-2">{title}</h3>
                <p className="text-xs text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Sample Brief Preview ─────────────────────────────────────── */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-mono text-primary-light uppercase tracking-widest">Live Sample</span>
            <h2 className="font-heading text-3xl text-white mt-3 mb-3">What a brief looks like</h2>
            <p className="text-muted">Institutional quality. Human readable. AI generated.</p>
          </div>

          <div className="rounded-2xl border border-border bg-surface-2 overflow-hidden shadow-2xl shadow-black/40">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-border bg-surface">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary-light" />
                <span className="font-heading text-lg text-white">Alpha<span className="text-accent">Week</span></span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-muted bg-surface-2 px-3 py-1 rounded">Week of Jan 06, 2025</span>
              </div>
            </div>

            <div className="p-8 space-y-6 text-sm">
              {/* Market overview */}
              <div>
                <h3 className="font-heading text-base text-white border-b border-border pb-2 mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-6 bg-primary rounded inline-block" />
                  Weekly Market Summary
                </h3>
                <p className="text-slate-300 leading-relaxed">
                  US equities closed the week with measured gains as the Fed maintained its dovish tone,
                  signaling two rate cuts in 2025. The S&P 500 added{' '}
                  <span className="text-profit font-mono font-semibold">+0.8%</span>, led by Technology (+1.4%) and Healthcare (+0.9%).
                  Indian markets faced headwinds as FII outflows totaled ₹4,200 Cr, with Nifty 50 losing{' '}
                  <span className="text-loss font-mono font-semibold">-1.2%</span> amid a stronger dollar narrative.
                  Bitcoin broke through <span className="text-profit font-mono font-semibold">$97,400</span> on ETF inflow data...
                </p>
              </div>

              {/* Geo-risk */}
              <div>
                <h3 className="font-heading text-base text-white border-b border-border pb-2 mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-6 bg-red-500 rounded inline-block" />
                  Geopolitical Risk Signals
                </h3>
                <div className="space-y-2.5">
                  {[
                    { level: 'CRITICAL', text: 'Red Sea shipping disruptions pushing energy futures +3.4%', cls: 'bg-loss/20 text-red-400' },
                    { level: 'HIGH', text: 'India–China border talks stall; defense stocks in focus', cls: 'bg-accent/20 text-amber-400' },
                    { level: 'MEDIUM', text: 'EU AI Act implementation timeline confirmed for Q2 2025', cls: 'bg-primary/20 text-primary-light' },
                  ].map(({ level, text, cls }) => (
                    <div key={level} className="flex items-start gap-3 p-3 rounded-lg bg-surface/50">
                      <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 ${cls}`}>{level}</span>
                      <p className="text-slate-300">{text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stocks to watch */}
              <div>
                <h3 className="font-heading text-base text-white border-b border-border pb-2 mb-3 flex items-center gap-2">
                  <span className="h-1.5 w-6 bg-accent rounded inline-block" />
                  Top 5 Stocks to Watch
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {['NVDA +8.2%', 'RELIANCE +2.1%', 'INFY -3.4%', 'BTC +4.3%', 'AAPL +1.7%'].map((s) => {
                    const isPos = s.includes('+');
                    return (
                      <div key={s} className="rounded-lg border border-border bg-surface px-3 py-2 text-center">
                        <p className="font-mono font-semibold text-slate-100 text-xs">{s.split(' ')[0]}</p>
                        <p className={`font-mono text-xs mt-0.5 ${isPos ? 'text-profit' : 'text-loss'}`}>{s.split(' ')[1]}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-xs text-muted italic border-t border-border pt-4">
                Excerpt from an AlphaWeek brief. Full briefs include portfolio analysis, sentiment signals, and actionable trade ideas. 8-minute read.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Early Feedback ───────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-primary-light uppercase tracking-widest">Early Feedback</span>
            <h2 className="font-heading text-3xl text-white mt-3 mb-3">What early users are saying</h2>
            <p className="text-muted text-sm">From beta users across the US, India, and Europe</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EARLY_FEEDBACK.map(({ quote, initial }, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-surface border border-border hover:border-border-light transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-0.5 text-accent">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-current" />
                    ))}
                  </div>
                  <span className="text-xs font-mono bg-primary/10 text-primary-light border border-primary/20 px-2 py-0.5 rounded">
                    Beta user
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-4 italic">&ldquo;{quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-surface-2 border border-border flex items-center justify-center text-xs font-bold text-primary-light">
                    {initial}
                  </div>
                  <p className="text-xs text-muted">Early access user · Name withheld</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs font-mono text-primary-light uppercase tracking-widest">Questions</span>
            <h2 className="font-heading text-3xl text-white mt-3 mb-3">Frequently asked questions</h2>
            <p className="text-muted">Everything you need to know before getting started.</p>
          </div>
          <LandingFAQ />
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-surface border-y border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <div className="relative max-w-3xl mx-auto text-center">
          <h2 className="font-heading text-4xl md:text-5xl text-white mb-4">
            Start your first brief today
          </h2>
          <p className="text-lg text-muted mb-3">
            Free during our public beta. Every feature. Every user.
          </p>
          <p className="text-sm text-muted mb-10">
            No card. No tiers. Pricing arrives only when the product earns it — and beta users get to keep what they have.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-up"
              className="group flex items-center justify-center gap-2 px-8 py-4 bg-accent hover:bg-accent-dark text-white font-semibold rounded-xl text-base transition-all shadow-lg shadow-accent/20 hover:scale-[1.02]"
            >
              Get Started
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="flex items-center justify-center gap-2 px-8 py-4 border border-border hover:border-border-light text-slate-300 hover:text-white font-semibold rounded-xl text-base transition-colors"
            >
              Compare Plans <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <p className="text-xs text-muted mt-8">
            <Lock className="h-3 w-3 inline mr-1" />
            Your data is encrypted in transit and at rest. Never sold. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-border bg-surface-2 px-6 pt-14 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary-light" />
                <span className="font-heading text-lg text-white">Alpha<span className="text-accent">Week</span></span>
              </div>
              <p className="text-xs text-muted leading-relaxed mb-4">
                AI-powered weekly investment intelligence for retail investors. US, India, and Crypto markets.
              </p>
              <a href="mailto:support@alphaweek.io" className="text-xs text-primary-light hover:underline">
                support@alphaweek.io
              </a>
            </div>

            {/* Product */}
            <div>
              <p className="text-xs font-mono text-muted uppercase tracking-wider mb-4">Product</p>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="#features" className="text-muted hover:text-slate-200 transition-colors">Features</Link></li>
                <li><Link href="/pricing" className="text-muted hover:text-slate-200 transition-colors">Pricing</Link></li>
                <li><Link href="#how-it-works" className="text-muted hover:text-slate-200 transition-colors">How it works</Link></li>
                <li><Link href="#faq" className="text-muted hover:text-slate-200 transition-colors">FAQ</Link></li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <p className="text-xs font-mono text-muted uppercase tracking-wider mb-4">Account</p>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/sign-in" className="text-muted hover:text-slate-200 transition-colors">Sign in</Link></li>
                <li><Link href="/sign-up" className="text-muted hover:text-slate-200 transition-colors">Get started</Link></li>
                <li><Link href="/dashboard" className="text-muted hover:text-slate-200 transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-mono text-muted uppercase tracking-wider mb-4">Legal</p>
              <ul className="space-y-2.5 text-sm">
                <li><Link href="/privacy" className="text-muted hover:text-slate-200 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-muted hover:text-slate-200 transition-colors">Terms of Service</Link></li>
                <li><Link href="/disclaimer" className="text-muted hover:text-slate-200 transition-colors">Disclaimer</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted">© 2025 AlphaWeek. All rights reserved.</p>
            <p className="text-xs text-muted text-center md:text-right max-w-lg">
              AlphaWeek is for informational purposes only and does not constitute financial advice.
              Past performance is not indicative of future results. Always conduct your own research.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
