# AlphaWeek — Multi-Tenant Financial Signal Intelligence SaaS

> Pulls live market data across US, Indian, and crypto markets, runs it through a tiered LLM pipeline (Llama 3.3-70B), and sends personalized investment briefs every Monday via email, Telegram, and browser push.

**Stack:** Next.js 14 · TypeScript · Node.js · Express · Neon PostgreSQL · Prisma ORM · BullMQ · Upstash Redis · Groq API · Clerk · Resend · Cloudflare R2

---

## What it does

AlphaWeek is a multi-tenant SaaS with a 4-tier LLM pipeline (Free → Starter → Pro → Elite). Each tier adds depth — Elite includes Reddit sentiment from r/investing and r/wallstreetbets, sector rotation maps, contrarian signals, and geopolitical radar.

**Markets covered:** S&P 500, NASDAQ, Dow Jones · Nifty 50, Sensex, NSE/BSE · BTC, ETH, SOL, XRP and more

**Delivery:** Email (Resend) · Telegram bot · Browser Web Push (VAPID) · every Monday 08:00 UTC

---

## Architecture highlights

- **BullMQ job queue** with exponential backoff, retry logic, and Elite-priority queuing — brief generation is fully async and resilient
- **Upstash Redis distributed locking** prevents cache stampedes on market data expiry
- **`Promise.allSettled` throughout** — Yahoo Finance or NewsAPI going down never breaks brief generation
- **Idempotent scheduling** via node-cron — duplicate jobs are skipped, not double-fired
- **Neon PostgreSQL over WebSocket** (port 443) via `@prisma/adapter-neon` — bypasses firewall restrictions on port 5432
- **Multi-tenant data isolation** enforced at query level — every DB call is scoped to `userId`

## Features

- **Live portfolio enrichment** — P&L, P/E ratio, analyst ratings, 52-week range, sector — fetched in parallel from Yahoo Finance
- **Stock screener** — 8 Yahoo Finance preset screens with client-side filters (price, P/E, market cap)
- **Price alerts** — user-defined triggers checked every 15 min via BullMQ, delivered via email + Telegram
- **AI chat analyst** — portfolio-aware, 40-message context window, knows your holdings
- **CSV import** — supports Fidelity, Schwab, Robinhood, Zerodha export formats
- **Earnings calendar** — upcoming dates for all portfolio + watchlist tickers
- **PWA** — installable, offline support, Web Push notifications

---

## Project structure

```
alphaweek/
├── frontend/          # Next.js 14 App Router
│   ├── app/           # Pages (dashboard, briefs, portfolio, screener, chat, alerts)
│   ├── components/    # UI components, layout, market strip
│   └── lib/           # API client, hooks, utilities
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── routes/    # REST endpoints
│   │   ├── services/  # Brief orchestration, AI, portfolio, stock data
│   │   ├── jobs/      # BullMQ workers, weekly + daily schedulers
│   │   ├── prompts/   # Tiered LLM prompt builders
│   │   └── middleware/ # Auth, rate limiting, plan gating
│   ├── config/        # DB (Neon + Prisma), Redis
│   └── prisma/        # Schema + migrations
└── docker-compose.yml
```

---

## Running locally

**Backend**
```bash
cd backend
cp .env.example .env   # fill in your keys
npm install
npx prisma generate
npm run dev            # runs on :4000
```

**Frontend**
```bash
cd frontend
cp .env.local.example .env.local   # fill in your keys
npm install
npm run dev                        # runs on :3000
```

**Required services:** Neon (PostgreSQL) · Upstash (Redis) · Clerk (auth) · Groq (LLM) · Resend (email)

---

## Tests

```bash
cd backend && npm test   # 7 test suites
```
