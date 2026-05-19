import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding development database...');

  // Create two dev test users
  const users = [
    {
      id: 'user_dev_free',
      email: 'free@dev.alphaweek.io',
      name: 'Dev User (Free)',
      plan: 'free' as const,
      referralCode: 'DEVFREE01',
    },
    {
      id: 'user_dev_pro',
      email: 'pro@dev.alphaweek.io',
      name: 'Dev User (Pro)',
      plan: 'pro' as const,
      referralCode: 'DEVPRO001',
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        ...user,
        portfolio: { create: { holdings: [] } },
        watchlist: { create: { tickers: [] } },
      },
      update: { plan: user.plan, name: user.name },
    });
    console.log(`  ✓ User: ${user.email} (${user.plan})`);
  }

  // Seed a completed brief for the pro user
  const weekOf = getMondayDate();
  await prisma.brief.upsert({
    where: {
      // Use findFirst workaround since no unique on userId+weekOf
      id: 'brief_dev_sample',
    },
    create: {
      id: 'brief_dev_sample',
      userId: 'user_dev_pro',
      weekOf: new Date(weekOf),
      planAtGeneration: 'pro',
      status: 'completed',
      content: getSampleBriefContent(weekOf),
      generatedAt: new Date(),
      aiTokensUsed: 1842,
    },
    update: { status: 'completed' },
  });
  console.log(`  ✓ Sample brief for week of ${weekOf}`);

  // Seed portfolio holdings for pro user
  await prisma.portfolio.update({
    where: { userId: 'user_dev_pro' },
    data: {
      holdings: [
        { ticker: 'AAPL', exchange: 'NASDAQ', quantity: 50, avgBuyPrice: 178.5 },
        { ticker: 'MSFT', exchange: 'NASDAQ', quantity: 30, avgBuyPrice: 420.0 },
        { ticker: 'RELIANCE.NS', exchange: 'NSE', quantity: 100, avgBuyPrice: 2850.0 },
        { ticker: 'TCS.NS', exchange: 'NSE', quantity: 40, avgBuyPrice: 3920.0 },
        { ticker: 'BTC-USD', exchange: 'CRYPTO', quantity: 0.25, avgBuyPrice: 62000.0 },
      ],
    },
  });
  console.log('  ✓ Portfolio holdings seeded');

  // Seed watchlist
  await prisma.watchlist.update({
    where: { userId: 'user_dev_pro' },
    data: { tickers: ['NVDA', 'TSLA', 'AMZN', 'INFY', 'ETH-USD'] },
  });
  console.log('  ✓ Watchlist seeded');

  console.log('\nSeed complete ✓');
}

function getMondayDate(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

function getSampleBriefContent(weekOf: string): string {
  return `## Market Overview — Week of ${weekOf}

US equities posted modest gains this week, led by the Technology sector (+1.4%) and supported by better-than-expected retail sales data. The S&P 500 added **+0.8%** while the NASDAQ outperformed at **+1.2%**, driven by continued AI infrastructure spending narratives.

Indian markets faced headwinds as foreign institutional investors (FIIs) continued net selling for the fourth consecutive week. Nifty 50 declined **-1.1%** while the broader midcap index held relative strength at **-0.4%**. The RBI's commentary on maintaining "withdrawal of accommodation" stance weighed on rate-sensitive sectors.

## Geopolitical Risk Signals

**HIGH — Red Sea shipping corridor:** Ongoing disruptions are pushing Brent crude +$2.40/barrel this week. Watch energy sector exposure.

**MEDIUM — India-China LAC talks:** Diplomatic channels remain open. Defence sector stocks (HAL, BEL) may see news-driven volatility.

**MEDIUM — US Election positioning:** Markets pricing in 60% probability of rate cuts beginning June. Dollar Index DXY showing weakness at 104.1.

## Portfolio Health

Your portfolio outperformed the Nifty 50 benchmark this week (+0.3% vs -1.1%). Key highlights:

- **AAPL** — Strong after iPhone supply chain normalization reports. HOLD.
- **RELIANCE.NS** — Jio Financial Services IPO lock-up expiry approaching. Monitor for volatility.
- **BTC-USD** — ETF inflows remain strong. Holding support at $62k level.

## Watchlist Movers

**NVDA** — AI infrastructure demand commentary from hyperscalers suggests continued upside. High conviction.
**ETH-USD** — Spot ETF approval speculation driving speculative premium.

## Week Ahead

Key events to watch: FOMC minutes (Wednesday), India CPI data (Thursday), US PPI (Friday). Expect elevated volatility around FOMC release.`;
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
