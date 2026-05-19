import { prisma } from '../../config/db';
import { getMarketSnapshot } from './stockService';
import { getGeopoliticalEvents } from './newsService';
import { getRedditSentiment } from './sentimentService';
import { analyzePortfolio } from './portfolioService';
import { generateBrief, generateDailyBrief } from './aiService';
import { factCheckBrief, logFactCheck } from './factCheck';
import { parseBriefOutput } from '../utils/parseBriefOutput';
import { checkBrief, SANITY_FLAG_NOTE } from '../utils/briefSanityCheck';
import { loadPriorResearch, savePriorResearch, extractResearchIdeas } from '../utils/researchTracker';
import { randomBytes } from 'crypto';
import { getWeeklyPriceMoves } from './stockService';
import { notifyBriefFailure } from './deliveryService';
import { PriorResearchOutcome } from './aiService';
import { logger } from '../utils/logger';
import { BriefGenerationJob, PortfolioHolding } from '../types';

export interface BriefResult {
  briefId: string;
  content: string;
  pdfUrl: string | null;
  weekOf: string;
}

export async function orchestrateBriefGeneration(job: BriefGenerationJob): Promise<BriefResult> {
  const { userId, weekOf, plan, briefId, briefType = 'weekly' } = job;

  logger.info('Starting brief orchestration', { userId, weekOf, plan, briefType });

  await prisma.brief.update({
    where: { id: briefId },
    data: { status: 'generating' },
  }).catch(() => null);

  try {
    // Market data is non-optional — without it the brief would be hallucinated.
    // Geo events ARE optional (some weeks have nothing) and degrade gracefully.
    const [market, geoEventsResult, portfolioRecord] = await Promise.all([
      getMarketSnapshot(),
      getGeopoliticalEvents().catch((err) => {
        logger.warn('Geo events unavailable, proceeding without news', { error: String(err) });
        return [] as Awaited<ReturnType<typeof getGeopoliticalEvents>>;
      }),
      prisma.portfolio.findUnique({
        where: { userId },
        select: { holdings: true },
      }),
    ]);

    // Belt-and-braces check: even if getMarketSnapshot returned, verify the
    // S&P close is real. A zero means the upstream returned a skeleton; we
    // refuse to ship a brief built on phantom numbers.
    if (!market?.us?.sp500?.value || market.us.sp500.value <= 0) {
      throw new Error('Market data unavailable — refusing to generate brief with empty inputs');
    }
    const geoEvents = geoEventsResult;

    const holdings = (portfolioRecord?.holdings ?? []) as unknown as PortfolioHolding[];

    // Everyone gets sentiment + portfolio synthesis. Sentiment is best-effort —
    // a Reddit API outage shouldn't block the brief.
    const [portfolio, sentiment] = await Promise.all([
      analyzePortfolio(holdings),
      briefType === 'weekly'
        ? getRedditSentiment().catch((err) => {
            logger.warn('Reddit sentiment unavailable', { error: String(err) });
            return undefined;
          })
        : Promise.resolve(undefined),
    ]);

    // Load prior week's research ideas and score them against this week's prices.
    // Only for weekly briefs — daily briefs don't have research ideas sections.
    let priorResearch: PriorResearchOutcome[] | undefined;
    if (briefType === 'weekly') {
      const prior = await loadPriorResearch(userId).catch(() => null);
      if (prior && prior.ideas.length > 0) {
        const tickers = prior.ideas.map((i) => i.ticker);
        const moves = await getWeeklyPriceMoves(tickers).catch(() => ({} as Record<string, { weeklyChangePercent: number }>));
        priorResearch = prior.ideas.map((idea) => ({
          ticker: idea.ticker,
          thesis: idea.thesis,
          weeklyChangePercent: moves[idea.ticker]?.weeklyChangePercent ?? null,
        }));
      }
    }

    const briefResult = briefType === 'daily'
      ? await generateDailyBrief(market, geoEvents, portfolio, weekOf)
      : await generateBrief({ weekOf, market, geoEvents, portfolio, sentiment, priorResearch });

    // Build a transparent source-attribution footer so users know exactly what
    // fed this brief. Radical transparency is a competitive advantage here.
    const redditPostCount = sentiment
      ? sentiment.bullishCount + sentiment.bearishCount + sentiment.neutralCount
      : 0;
    const sourceFooter = [
      '\n\n---',
      `*Sources: Yahoo Finance (price data, 15-min delayed) · NewsAPI (${geoEvents.length} articles)${redditPostCount > 0 ? ` · Reddit (${redditPostCount} posts across r/investing, r/stocks, r/wallstreetbets)` : ''} · CoinGecko (crypto) · Alternative.me (Fear & Greed). AI-generated — not financial advice.*`,
    ].join('\n');

    // Parse structured metadata blocks (mood, summary, closing question) out
    // of the raw LLM output. cleanContent is the sanitised markdown without
    // any meta markers — this is what gets stored, rendered, and diffed.
    const parsed = parseBriefOutput(briefResult.content);

    // Sanity check — verify the brief has expected structure before storing.
    // Never block delivery; append a user-visible note when flagged so the
    // user knows something may be off. Silence is always the worst outcome.
    const sanity = checkBrief(parsed.cleanContent, briefType);
    const contentWithFlag = sanity.flagged
      ? parsed.cleanContent + SANITY_FLAG_NOTE
      : parsed.cleanContent;
    const finalContent = briefType === 'weekly'
      ? contentWithFlag + sourceFooter
      : contentWithFlag;

    // Cross-check every number the AI emitted against the source data it was
    // given. Anything we can't trace to a real input is logged so we can spot
    // hallucinations in production telemetry. We don't block delivery on a
    // failed check — the dashboard surfaces unverified figures separately so
    // the user can read with appropriate skepticism.
    const factCheck = factCheckBrief(finalContent, market, portfolio);
    logFactCheck(briefId, factCheck);

    let pdfUrl: string | null = null;
    try {
      const { generateBriefPdf } = await import('./pdfService');
      pdfUrl = await generateBriefPdf(briefId, finalContent, userId, weekOf);
    } catch (pdfError) {
      const err = pdfError instanceof Error ? pdfError : new Error(String(pdfError));
      logger.error('PDF generation failed (non-fatal)', { error: err.message, briefId });
    }

    await prisma.brief.update({
      where: { id: briefId },
      data: {
        content: finalContent,
        pdfUrl,
        planAtGeneration: plan as never,
        aiTokensUsed: briefResult.inputTokens + briefResult.outputTokens,
        status: 'completed',
        generatedAt: new Date(),
        mood: parsed.mood,
        moodReason: parsed.moodReason,
        briefSummary: parsed.briefSummary,
        closingQuestion: parsed.closingQuestion,
      },
    });

    // Save this week's research ideas so next Monday's brief can score them.
    if (briefType === 'weekly') {
      const ideas = extractResearchIdeas(finalContent);
      if (ideas.length > 0) {
        await savePriorResearch(userId, { briefId, weekOf, ideas }).catch(() => null);
      }
    }

    logger.info('Brief generation complete', { userId, briefId, weekOf, mood: parsed.mood, sanityPassed: sanity.passed });
    return { briefId, content: finalContent, pdfUrl, weekOf };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    await prisma.brief.update({
      where: { id: briefId },
      data: {
        status: 'failed',
        errorMessage: error.message,
        failedAt: new Date(),
      },
    }).catch(() => null);

    // Notify the user — silence on failure is unacceptable. Best-effort only.
    try {
      const userRecord = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (userRecord?.email) {
        await notifyBriefFailure(userId, userRecord.email, weekOf);
      }
    } catch (notifyErr) {
      logger.warn('Could not send failure notification', { userId, error: String(notifyErr) });
    }

    logger.error('Brief generation failed', { userId, briefId, error: error.message });
    throw error;
  }
}

function generatePublicSlug(): string {
  return randomBytes(5).toString('base64url').slice(0, 8);
}

export async function createBriefRecord(
  userId: string,
  weekOf: string,
  plan: string
): Promise<string> {
  const brief = await prisma.brief.create({
    data: {
      userId,
      weekOf: new Date(weekOf),
      planAtGeneration: plan as never,
      status: 'pending',
      publicSlug: generatePublicSlug(),
    },
    select: { id: true },
  });

  return brief.id;
}

export function getCurrentWeekOf(): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + daysToMonday);
  return monday.toISOString().split('T')[0];
}
