# AlphaWeek — Product Report

*Prepared for a US-based client. May 2026.*

---

## 1. Executive Summary

**AlphaWeek** is a personalized, AI-generated weekly investment intelligence platform for self-directed retail and prosumer investors. It synthesizes live market data, geopolitical events, retail sentiment, and the user's actual portfolio into a single Monday-morning brief — and surrounds that brief with a portfolio tracker, ticker research pages, an AI chat analyst, price alerts, and a stock screener.

Where Bloomberg Terminal exists for institutions and Yahoo Finance exists for free, AlphaWeek occupies the middle: **the analysis a Bloomberg subscriber gets, written for the time budget of someone with a day job.** Public beta is free; no tiers, no card.

---

## 2. The Problem We Solve

Retail investors in the US face four compounding problems:

1. **Information overload.** The Wall Street Journal, CNBC, Bloomberg.com, X/Twitter, Reddit, and a hundred newsletters push hundreds of headlines a day. Most are noise; the signal is buried.
2. **Time poverty.** A typical retail investor has 15 minutes a week, not five hours. They don't read 8-K filings; they read whatever lands in their inbox.
3. **Generic content.** The financial media writes for "the market" — not for the specific 12 stocks, 3 ETFs, and 2 cryptos a real investor holds. A piece on "tech sector rotation" doesn't tell you what to do about *your* NVDA position.
4. **Hallucination risk.** AI-generated financial content has flooded the internet — most of it invents numbers, mixes up time periods, and contradicts itself. The investor has no way to tell which numbers are real.

AlphaWeek attacks all four directly:

- One brief, once a week (8-minute read), with optional daily morning pulse (3-min).
- Built from your portfolio, not from the market in the abstract — every analysis references *your* tickers, *your* P&L, *your* sector exposure.
- Every numeric claim in the brief is cross-checked against the source data it was generated from. Unverified figures are flagged in our telemetry; we know which briefs to look at.
- Sources are disclosed at the top of every brief: Yahoo Finance, NewsAPI, Reddit (r/investing, r/stocks, r/wallstreetbets), CoinGecko, Alternative.me Fear & Greed.

---

## 3. What AlphaWeek Is

A web application (mobile-responsive, no native app required), built as:

- **Next.js 14** frontend deployed on Vercel
- **Express + TypeScript** API on Railway
- **Neon serverless Postgres** + **Prisma** for application data
- **Cloudflare R2** for PDF storage (signed URLs, 1-hour TTL — no public links)
- **BullMQ** on Redis for the brief generation queue
- **Clerk** for authentication
- **Groq** running Llama 3.3 70B for all AI generation (briefs, sentiment classification, geopolitical event analysis, chat)
- **Resend** for email delivery (RFC 8058 one-click unsubscribe compliant)
- **Yahoo Finance** (15-minute delayed quotes), **CoinGecko** (crypto), **Alternative.me** (Fear & Greed index), **NewsAPI** (geopolitical events), **Reddit OAuth** (retail sentiment)

Coverage: **US equities (NASDAQ, NYSE), Indian equities (NSE, BSE), Cryptocurrency.** US dollar is the reporting currency; INR holdings auto-convert via live USD/INR.

---

## 4. The Core Deliverable: The Brief

Every Monday at 8:00 AM UTC (4:00 AM ET, which lands before the US open) every user receives a brief structured into seven sections:

1. **The Week in Markets** — narrative paragraph synthesizing the dominant macro theme.
2. **Geopolitical Risk Radar** — events labeled CRITICAL / HIGH / MEDIUM / LOW, with a specific market implication for each (written by a separate LLM pass that pre-processes the news feed).
3. **5 Stocks Worth Watching** — picked from the week's actual movers, each with a catalyst and a "what would change the thesis" note.
4. **Your Portfolio This Week** — *your* tickers, *your* weekly P&L, *your* return vs the appropriate benchmark (S&P for USD holdings, NIFTY for INR holdings, blended for mixed portfolios).
5. **Rebalancing Signals** — sector concentration, single-name concentration, sector tilt, all referenced to your actual allocation.
6. **Sentiment vs Price** — retail-sentiment cross-check (the most analytical section). Sourced from Reddit and classified by an LLM with negation and sarcasm awareness; extreme readings flagged as contrarian signals.
7. **3 High-Conviction Research Ideas** — specific tickers with a thesis, a confirming catalyst, and a thesis-killing risk.

Mon-Fri at 7:30 AM UTC users also get a **daily morning pulse** — 3-minute read with overnight driver, today's pivotal level, and which of their holdings are in motion.

Briefs are delivered by **email (HTML + plain text, with proper unsubscribe headers), Telegram (Markdown formatting, if connected), and Web Push (if enabled).** PDF downloads available via signed URL.

---

## 5. Beyond the Brief — The Platform

| Feature | What it does |
|---|---|
| **Live portfolio tracker** | Real-time P&L (15-min delayed quotes), sector allocation from Yahoo's `assetProfile`, A–F health score with a "top risk" callout, currency-converted totals for mixed USD/INR books. |
| **Ticker detail pages** | Every ticker in the app is clickable — including inside the brief markdown. Detail page has 1W/1M/3M/1Y price chart, key stats (market cap, P/E, forward P/E, EPS, beta, dividend yield, 52-week range, volume), analyst consensus + 12-month target, next earnings date, your position if held, "Set Alert" / "Add to Watchlist" inline actions. |
| **AI chat analyst** | Portfolio + market context refreshed in the system prompt every turn. "Ask AI about this brief" deep-link from any brief detail page passes the full brief into the conversation. History stored server-side so it follows you across devices. |
| **Stock screener** | Yahoo preset screens (day gainers, day losers, most active, undervalued growth, etc.) with price/PE filters. Row click → ticker detail. |
| **Price alerts** | Above / below targets, checked **every 15 min during US market hours, every 15 min during NSE/BSE hours, every 5 min for crypto 24/7** — most apps only check during their home market's session. Email + Telegram fan-out per trigger. |
| **Earnings calendar** | Auto-built from your portfolio + watchlist. Urgency-badged ("In 3d", "In 7d"). |
| **Geopolitical radar** | Standalone in every brief, but also implicit in the sentiment + market analysis. |
| **CSV portfolio import** | Robust parser handles Robinhood, Fidelity, Schwab, Zerodha exports with column-name aliases. Preview-before-commit flow so you see what will be imported. |
| **Referrals** | Track friends who join via your code. Names masked for privacy. No payment integration — currency-neutral, ready for whatever rewards model gets layered in later. |

---

## 6. Competitive Landscape

The honest comparison, against products a US retail investor actually considers:

| Product | Approx. Price / yr | What they do well | Where AlphaWeek wins |
|---|---|---|---|
| **Bloomberg Terminal** | ~$24,000 | Real-time everything, derivative pricing, news, chat, the gold standard. | Bloomberg is built for traders at hedge funds. AlphaWeek is built for someone with a 401(k) and a Robinhood account — same intelligence, retail-scale. |
| **Seeking Alpha Premium** | ~$239 | Deep crowdsourced research articles, ratings, dividend trackers. | We synthesize, they aggregate. Their content is human-written but unmoderated for quality; ours is AI-written but fact-checked against source data. Their portfolio analysis is opt-in; ours is the default. |
| **Morningstar Investor** | ~$249 | Mutual fund / ETF deep dives, X-Ray portfolio analysis, fair-value estimates. | Morningstar is fundamentals-heavy and slow (quarterly cadence). AlphaWeek is weekly + daily, with macro/geo overlay, sentiment, and live portfolio P&L. |
| **Koyfin** | Free → $79/mo | Bloomberg-quality charts, screening, financial statements. | Koyfin is a data tool — you bring the synthesis. AlphaWeek delivers the synthesis itself. Complementary; not a head-on overlap. |
| **The Motley Fool (Stock Advisor)** | ~$199 first year | Two stock picks per month, strong track record on past picks. | Fool is generic — same picks for everyone. AlphaWeek's "stocks to watch" are anchored in *this week's* market data, and "rebalancing signals" reference *your* portfolio. |
| **Yahoo Finance** (free / $35 mo) | Free / $35 mo | Universal price coverage, news aggregation, basic screener. | Yahoo is a database; AlphaWeek is the analyst sitting on top of that database. Same source data, structured into actionable narrative. |
| **TradingView** | Free → ~$59/mo | Best-in-class charting, alerting, social ideas feed. | TradingView is for active traders. AlphaWeek is for buy-and-hold + occasional-rebalance investors who don't want to live in a chart. |
| **Stocktwits / Reddit** | Free | Real-time sentiment, community signal. | AlphaWeek *uses* Reddit as a source — but classifies it with an LLM that handles negation and sarcasm, surfaces extreme readings as contrarian indicators, and grounds them in the rest of the data. You get the signal without the noise. |
| **Finimize** | ~$99 | Daily 3-min market roundup newsletter, beginner-friendly. | Finimize is generic and editorial; AlphaWeek is personalized to your holdings. Finimize tells you "tech sold off"; AlphaWeek tells you "*your* NVDA position is down 4.2% — here's why and what would change." |
| **The Daily Upside, Sherwood, Bespoke** | Free → $$$ | Human-written editorial daily/weekly market commentary. | Editorial newsletters can't be personalized at scale. AlphaWeek can — every user gets a brief grounded in their actual portfolio. |
| **Robinhood / Webull / Fidelity (built-in)** | Free | Trading + basic data inside the brokerage UI. | Brokers have data; they don't have analysis. AlphaWeek is broker-agnostic — you import holdings via CSV and we layer the intelligence on top. |

---

## 7. Where AlphaWeek Genuinely Wins

Stripping the marketing layer, here are the **five things AlphaWeek does that no other product in the retail segment does together**:

1. **Synthesis + personalization in one product.** Yahoo gives you data. Seeking Alpha gives you opinions. Finimize gives you commentary. AlphaWeek gives you data → opinion → commentary, *grounded in your actual portfolio*, in one inbox-deliverable artifact.

2. **Fact-checked AI.** Every AI-generated brief runs through a numeric verification pass that compares emitted figures against the source data they came from. Unverified figures are flagged in production telemetry. This is uncommon in retail-tier AI products and most consumers don't realize they should expect it.

3. **US + India + crypto coverage in one product.** Almost every US-focused tool ignores India; almost every crypto-focused tool ignores equities. AlphaWeek treats them as one investable universe, including currency conversion for mixed-currency portfolios. (Important for Indian-American investors with cross-border holdings.)

4. **Real benchmark math, not eyeballed.** When AlphaWeek says "your portfolio outperformed the S&P by 1.4% this week," the S&P number is a real Yahoo-sourced weekly return on SPY, and your portfolio return is computed from actual close-to-close prices on each holding. Many competitors fudge this — using a 4-quarter trailing average, or just the index's day change, or worse, a hardcoded estimate.

5. **Source-disclosed, delay-disclosed, AI-disclosed.** We tell users at the top of every brief what sources fed it. The screener says "prices may be delayed up to 15 minutes" — not "real-time" (which would be a lie). The brief says "AI-generated, not financial advice" *before* you read it, not buried at the bottom. This kind of honesty is rare in retail-fintech UX and disproportionately builds trust.

---

## 8. Where AlphaWeek Is Honest About Limits

A Bloomberg PM would call these out, so we should call them out first:

- **Quote data is 15-minute delayed (Yahoo Finance).** Day traders should not use this product as their primary terminal. We're explicit about the delay in the UI. Real-time would require a paid feed (Polygon, Tiingo, Alpaca) — on the roadmap when revenue justifies it.
- **No options chains, no derivatives, no shorting.** Equity + crypto cash positions only.
- **No automated trading, no broker integration.** AlphaWeek is read-only intelligence. Users still execute trades at their broker.
- **Indian market screener coverage is limited.** Yahoo's preset screens are US-centric; for Indian movers we use a curated list of NIFTY large-caps. Will improve when an India-specific screener is wired up.
- **Llama 3.3 70B is our LLM today.** It's good but not Claude Opus or GPT-4. Brief writing quality has a measurable ceiling because of this; upgrading is a cost decision (~$100–500/mo at our scale).
- **Not a registered investment advisor.** AlphaWeek is informational only. Full disclaimer page covers SEC, SEBI, FINRA framing.

---

## 9. Cost Position

The current operating cost is **near zero per user** because every external service is on a free tier:

- Groq Llama 70B inference: free tier (rate-limited, sufficient for current scale)
- Yahoo Finance data: free
- NewsAPI: free (100 req/day, sufficient since news is fetched once per cycle and cached)
- Reddit OAuth: free
- CoinGecko: free
- Alternative.me Fear & Greed: free
- Neon Postgres: free tier (3 GB)
- Cloudflare R2: free egress, generous free storage
- Clerk: free tier (10K MAUs)
- Resend: 100 emails/day on free, ~$20/mo on Pro

**This means AlphaWeek can be offered free during beta without burning cash.** When the time comes to introduce pricing, the natural tier breaks are:

- **Free:** weekly brief, basic portfolio tracking
- **Plus (~$10/mo):** daily briefs, Telegram, larger portfolio, AI chat
- **Pro (~$30/mo):** real-time data (paid feed), priority LLM (Claude/GPT-4), priority queue

These tiers are intentionally not active today — the client asked us to ship a fully functional product first and layer pricing after they validate demand.

---

## 10. What's Next

Items the team has already scoped but not yet built:

- **Brief-over-brief diff** — "what did the AI say last week, and what changed." Highest-leverage upcoming feature; nothing in the retail space does this today.
- **Schedule healthcheck endpoint** — operational visibility into the cron pipeline.
- **Sentiment-per-ticker breakdown** — currently aggregate; per-ticker is more actionable.
- **Email deliverability hardening** — SPF/DKIM/DMARC docs, plain-text part, domain warming.
- **Real-time data tier** — pending revenue validation.
- **Better LLM tier (Claude / GPT-4)** — pending revenue validation.

---

## One-line Pitch

> *AlphaWeek is the analyst Wall Street takes for granted, written for the time budget of someone with a job — personalized to your actual portfolio, sourced from real data, and honest about what it can and can't see.*
