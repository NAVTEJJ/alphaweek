import { Router, Response } from 'express';
import { body, query } from 'express-validator';
import { prisma } from '../../config/db';
import { redis } from '../../config/redis';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import { validate } from '../utils/validator';
import { enqueueBriefJob, getBriefQueueStatus } from '../jobs/briefQueue';
import { createBriefRecord, getCurrentWeekOf } from '../services/briefService';
import { getMarketSnapshot } from '../services/stockService';
import { getGeopoliticalEvents } from '../services/newsService';
import { analyzePortfolio } from '../services/portfolioService';
import { generatePreviewBrief } from '../services/aiService';
import { PortfolioHolding } from '../types';
import { cacheGet, cacheSet } from '../../config/redis';
import { getSignedPdfUrl } from '../services/pdfService';
import { diffBriefs } from '../services/briefDiff';
import { getBriefVoteSummary, setBriefVote } from '../utils/briefFeedback';
import { logger } from '../utils/logger';
import { getSampleBrief } from '../services/sampleBriefService';

const router = Router();

// ─── Public routes (no auth) ──────────────────────────────────────────────────

// GET /briefs/sample — public demo brief, real market data, demo portfolio.
// Cached 7 days. First call after cache expiry triggers generation (~30s).
router.get('/sample', async (_req, res: Response): Promise<void> => {
  try {
    const sample = await getSampleBrief();
    if (!sample) {
      res.status(503).json({
        error: 'Sample brief is being generated. Try again in 60 seconds.',
        code: 'SAMPLE_GENERATING',
      });
      return;
    }
    res.json({ data: sample });
  } catch (err) {
    logger.error('Sample brief endpoint failed', { error: String(err) });
    res.status(503).json({ error: 'Sample brief temporarily unavailable', code: 'SAMPLE_UNAVAILABLE' });
  }
});

// GET /briefs/preview/:id — public teaser (first 600 chars, no user data)
router.get('/preview/:id', async (req, res: Response): Promise<void> => {
  const brief = await prisma.brief.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      weekOf: true,
      status: true,
      planAtGeneration: true,
      content: true,
      generatedAt: true,
    },
  });

  if (!brief || brief.status !== 'completed' || !brief.content) {
    res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
    return;
  }

  // Return a teaser — enough to demonstrate value without giving it away
  const PREVIEW_CHARS = 800;
  res.json({
    data: {
      id: brief.id,
      weekOf: brief.weekOf,
      planAtGeneration: brief.planAtGeneration,
      generatedAt: brief.generatedAt,
      preview: brief.content.slice(0, PREVIEW_CHARS),
      isTruncated: brief.content.length > PREVIEW_CHARS,
    },
  });
});

// ─── Authenticated routes ─────────────────────────────────────────────────────
router.use(requireAuth as never);
router.use(apiRateLimit);

// GET /briefs — list user's briefs (paginated, newest first)
router.get(
  '/',
  validate([
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const page = (req.query.page as unknown as number) || 1;
    const limit = (req.query.limit as unknown as number) || 10;
    const skip = (page - 1) * limit;

    const [briefs, total] = await Promise.all([
      prisma.brief.findMany({
        where: { userId: req.user.id },
        orderBy: { weekOf: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          briefType: true,
          weekOf: true,
          status: true,
          planAtGeneration: true,
          pdfUrl: true,
          generatedAt: true,
          createdAt: true,
          content: true, // pulled only to derive wordCount, stripped below
        },
      }),
      prisma.brief.count({ where: { userId: req.user.id } }),
    ]);

    // Add wordCount + estimated readMinutes so the list cards can show "8 min
    // read" without each one paginating in the full body.
    const enriched = briefs.map(({ content, ...rest }) => {
      const wordCount = content ? content.trim().split(/\s+/).filter(Boolean).length : 0;
      return { ...rest, wordCount, readMinutes: wordCount > 0 ? Math.max(1, Math.ceil(wordCount / 200)) : 0 };
    });

    res.json({
      data: enriched,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

// GET /briefs/latest — most recent completed brief
router.get('/latest', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const brief = await prisma.brief.findFirst({
    where: { userId: req.user.id, status: 'completed' },
    orderBy: { weekOf: 'desc' },
    select: {
      id: true,
      briefType: true,
      content: true,
      weekOf: true,
      pdfUrl: true,
      planAtGeneration: true,
      generatedAt: true,
      mood: true,
      moodReason: true,
      briefSummary: true,
      closingQuestion: true,
    },
  });

  if (!brief) {
    res.status(404).json({ error: 'No completed brief found', code: 'NO_BRIEF' });
    return;
  }

  res.json({ data: brief });
});

// GET /briefs/:id — get single brief with content
router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const brief = await prisma.brief.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: {
      id: true,
      briefType: true,
      content: true,
      weekOf: true,
      status: true,
      pdfUrl: true,
      planAtGeneration: true,
      aiTokensUsed: true,
      errorMessage: true,
      generatedAt: true,
      createdAt: true,
      mood: true,
      moodReason: true,
      briefSummary: true,
      closingQuestion: true,
      publicSlug: true,
    },
  });

  if (!brief) {
    res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
    return;
  }

  res.json({ data: brief });
});

// GET /briefs/share/:slug — public view of a shared brief (no auth).
// Shows mood + summary + first section. Rest is blurred — sign up to read.
router.get('/share/:slug', async (req, res: Response): Promise<void> => {
  const brief = await prisma.brief.findFirst({
    where: { publicSlug: req.params.slug, status: 'completed' },
    select: {
      id: true, weekOf: true, content: true, mood: true,
      moodReason: true, briefSummary: true, planAtGeneration: true, generatedAt: true,
    },
  });

  if (!brief || !brief.content) {
    res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
    return;
  }

  // Return first ~800 words only — the rest is paywalled on the frontend.
  const words = brief.content.trim().split(/\s+/);
  const preview = words.slice(0, 800).join(' ');
  const isTruncated = words.length > 800;

  res.json({
    data: {
      id: brief.id,
      weekOf: brief.weekOf,
      generatedAt: brief.generatedAt,
      mood: brief.mood,
      moodReason: brief.moodReason,
      briefSummary: brief.briefSummary,
      preview,
      isTruncated,
    },
  });
});

// GET /briefs/:id/queue-status — approximate queue position + ETA.
// Frontend polls this while a brief is pending/generating to show progress.
router.get('/:id/queue-status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const brief = await prisma.brief.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true, status: true },
  });
  if (!brief) {
    res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
    return;
  }

  // If the DB already shows the brief as completed, BullMQ may have GCed the
  // job — short-circuit so we don't return "unknown".
  if (brief.status === 'completed') {
    res.json({ data: { state: 'completed', positionInQueue: null, ahead: 0, estimatedSecondsUntilStart: 0, estimatedSecondsUntilComplete: 0 } });
    return;
  }

  const status = await getBriefQueueStatus(brief.id);
  res.json({ data: status });
});

// GET /briefs/:id/feedback — vote aggregate + this user's own vote
router.get('/:id/feedback', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  // Quick existence/ownership check so we don't expose votes on briefs the
  // user can't see anyway. preview/* is the place for cross-user reads.
  const brief = await prisma.brief.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { id: true },
  });
  if (!brief) {
    res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
    return;
  }
  const summary = await getBriefVoteSummary(req.params.id, req.user.id);
  res.json({ data: summary });
});

// POST /briefs/:id/feedback — { vote: 'up' | 'down', reason?: string }
router.post(
  '/:id/feedback',
  validate([
    body('vote').isIn(['up', 'down']).withMessage('vote must be "up" or "down"'),
    body('reason').optional().isString().isLength({ max: 500 }),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const brief = await prisma.brief.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true },
    });
    if (!brief) {
      res.status(404).json({ error: 'Brief not found', code: 'BRIEF_NOT_FOUND' });
      return;
    }
    const { vote, reason } = req.body as { vote: 'up' | 'down'; reason?: string };
    const summary = await setBriefVote(req.params.id, req.user.id, vote, reason);
    logger.info('Brief feedback recorded', { briefId: req.params.id, userId: req.user.id, vote, hasReason: !!reason });
    res.json({ data: summary });
  }
);

// GET /briefs/:id/pdf — returns a short-lived signed R2 URL for the brief's
// owner. Keeping PDFs behind this gate prevents URL-leakage from exposing
// a user's full portfolio analysis. The frontend fetches the JSON then
// opens the signed URL in a new tab.
router.get('/:id/pdf', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const brief = await prisma.brief.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    select: { pdfUrl: true },
  });
  if (!brief?.pdfUrl) {
    res.status(404).json({ error: 'PDF not available for this brief', code: 'PDF_NOT_FOUND' });
    return;
  }
  // pdfUrl now holds the R2 object key, not a public URL.
  try {
    const signedUrl = await getSignedPdfUrl(brief.pdfUrl);
    res.json({ data: { url: signedUrl, expiresInSeconds: 3600 } });
  } catch (err) {
    logger.error('Failed to sign PDF URL', { briefId: req.params.id, error: String(err) });
    res.status(500).json({ error: 'Failed to access PDF', code: 'PDF_SIGN_ERROR' });
  }
});

// GET /briefs/:id/diff — semantic diff vs the prior week's brief
// Returns cached for 1 hour (briefs are immutable post-generation).
router.get('/:id/diff', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const current = await prisma.brief.findFirst({
    where: { id: req.params.id, userId: req.user.id, status: 'completed' },
    select: { id: true, briefType: true, weekOf: true, content: true },
  });
  if (!current || !current.content) {
    res.status(404).json({ error: 'Brief not found or not completed', code: 'BRIEF_NOT_FOUND' });
    return;
  }

  const prior = await prisma.brief.findFirst({
    where: {
      userId: req.user.id,
      briefType: current.briefType,
      status: 'completed',
      weekOf: { lt: current.weekOf },
    },
    orderBy: { weekOf: 'desc' },
    select: { id: true, content: true, weekOf: true },
  });

  if (!prior || !prior.content) {
    res.json({ data: { empty: true, summary: 'No prior brief to compare.', topChanges: [], newTickersHighlighted: [], removedTickersHighlighted: [], sentimentShift: '' } });
    return;
  }

  const diff = await diffBriefs(current.id, current.content, prior.content);
  res.json({ data: diff });
});

// GET /briefs/instant-preview — lightweight 3-section brief, generated on demand.
// Shown immediately after onboarding when the user has no completed brief yet.
// Cached per user for 24 hours so repeated dashboard visits don't re-generate.
router.get('/instant-preview', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const cacheKey = `preview:brief:${req.user.id}`;

  const cached = await cacheGet<{ content: string; generatedAt: string }>(cacheKey);
  if (cached) {
    res.json({ data: { ...cached, isPreview: true } });
    return;
  }

  try {
    const portfolioRecord = await prisma.portfolio.findUnique({
      where: { userId: req.user.id },
      select: { holdings: true },
    });
    const holdings = (portfolioRecord?.holdings ?? []) as unknown as PortfolioHolding[];

    const [market, geoEvents, portfolio] = await Promise.all([
      getMarketSnapshot(),
      getGeopoliticalEvents().catch(() => []),
      analyzePortfolio(holdings),
    ]);

    const date = new Date().toISOString().split('T')[0];
    const result = await generatePreviewBrief(market, geoEvents, portfolio, date);

    const payload = { content: result.content, generatedAt: new Date().toISOString() };
    await cacheSet(cacheKey, payload, 24 * 3600);

    res.json({ data: { ...payload, isPreview: true } });
  } catch (err) {
    logger.error('Instant preview generation failed', { userId: req.user.id, error: String(err) });
    res.status(503).json({ error: 'Preview unavailable right now', code: 'PREVIEW_FAILED' });
  }
});

// POST /briefs/generate — manual trigger, once per week per user
// Uses a per-user Redis lock to prevent TOCTOU races from concurrent requests.
router.post(
  '/generate',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const weekOf = getCurrentWeekOf();
    const lockKey = `lock:brief:generate:${req.user.id}`;

    const lockAcquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');
    if (!lockAcquired) {
      res.status(409).json({
        error: 'Brief generation already in progress',
        code: 'BRIEF_IN_PROGRESS',
      });
      return;
    }

    try {
      const existing = await prisma.brief.findFirst({
        where: {
          userId: req.user.id,
          weekOf: new Date(weekOf),
          status: { in: ['pending', 'generating', 'completed'] },
        },
        select: { id: true, status: true },
      });

      if (existing) {
        res.status(409).json({
          error: 'A brief for this week already exists',
          code: 'BRIEF_ALREADY_EXISTS',
          data: { briefId: existing.id, status: existing.status },
        });
        return;
      }

      const briefId = await createBriefRecord(req.user.id, weekOf, req.user.plan);
      await enqueueBriefJob({
        userId: req.user.id,
        weekOf,
        plan: req.user.plan,
        briefId,
      });

      logger.info('Manual brief generation triggered', { userId: req.user.id, briefId, weekOf });
      res.status(202).json({
        data: { briefId, weekOf, status: 'pending' },
        message: 'Brief generation queued. Check back in a few minutes.',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Failed to queue brief', { userId: req.user.id, error: error.message });
      res.status(500).json({ error: 'Failed to queue brief generation', code: 'QUEUE_ERROR' });
    } finally {
      await redis.del(lockKey);
    }
  }
);

export default router;
