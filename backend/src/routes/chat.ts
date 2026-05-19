import { Router, Response } from 'express';
import { body } from 'express-validator';
import Groq from 'groq-sdk';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { validate } from '../utils/validator';
import { apiRateLimit } from '../middleware/rateLimit';
import { getMarketSnapshot } from '../services/stockService';
import { prisma } from '../../config/db';
import { PortfolioHolding } from '../types';
import { cacheGet, cacheSet } from '../../config/redis';
import { appendChatHistory, clearChatHistory, loadChatHistory } from '../utils/chatHistory';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth as never);
router.use(apiRateLimit);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CHAT_SYSTEM = `You are AlphaWeek's AI investment analyst. You have access to the user's live portfolio and today's market data.

Rules:
- Answer investment questions accurately and concisely
- Always add risk context — never recommend without caveats
- Be specific: name tickers, sectors, levels when relevant
- If you don't know something, say so — never fabricate data
- You are NOT a licensed financial advisor; remind users when appropriate
- Keep responses under 300 words unless the user asks for detailed analysis`;

const CHAT_PER_USER_LIMIT = 20; // max messages per hour per user
const CHAT_LIMIT_TTL = 3600;

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = `chat:rate:${userId}`;
  const count = await cacheGet<number>(key);
  if ((count ?? 0) >= CHAT_PER_USER_LIMIT) return false;
  await cacheSet(key, (count ?? 0) + 1, CHAT_LIMIT_TTL);
  return true;
}

// POST /chat — AI market analyst chat (portfolio-aware)
router.post(
  '/',
  validate([
    body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('Message must be 1–1000 characters'),
    body('history').optional().isArray({ max: 20 }).withMessage('History must be an array of up to 20 messages'),
    body('history.*.role').optional().isIn(['user', 'assistant']),
    body('history.*.content').optional().isString().isLength({ max: 2000 }),
    body('briefId').optional().isString().isLength({ min: 1, max: 64 }),
  ]),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const allowed = await checkRateLimit(req.user.id);
    if (!allowed) {
      res.status(429).json({
        error: `Chat limit reached (${CHAT_PER_USER_LIMIT} messages/hour). Please try again later.`,
        code: 'CHAT_RATE_LIMIT',
      });
      return;
    }

    const { message, history = [], briefId } = req.body as {
      message: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      briefId?: string;
    };

    // Optionally load a brief the user wants to discuss. Owner-only — never
    // leak another user's brief via this endpoint.
    let briefContent: string | null = null;
    if (briefId) {
      const brief = await prisma.brief.findFirst({
        where: { id: briefId, userId: req.user.id },
        select: { content: true, weekOf: true, briefType: true },
      });
      if (brief?.content) {
        const label = brief.briefType === 'daily' ? 'daily brief' : 'weekly brief';
        briefContent = `Reference: the user is currently reading their ${label} from ${brief.weekOf.toISOString().split('T')[0]}. Brief text below:\n\n${brief.content}`;
      }
    }

    try {
      // Build context from live portfolio + market — re-injected on every
      // turn via the system prompt so the model never goes blind mid-conversation.
      const [market, portfolioRecord, watchlist] = await Promise.all([
        getMarketSnapshot().catch(() => null),
        prisma.portfolio.findUnique({
          where: { userId: req.user.id },
          select: { holdings: true },
        }),
        prisma.watchlist.findUnique({
          where: { userId: req.user.id },
          select: { tickers: true },
        }),
      ]);

      const holdings = (portfolioRecord?.holdings ?? []) as unknown as PortfolioHolding[];
      const tickers = watchlist?.tickers ?? [];
      const fmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

      const contextLines: string[] = [];
      if (market) {
        contextLines.push('CURRENT MARKETS:');
        contextLines.push(
          `- S&P 500: ${market.us.sp500.value.toFixed(0)} (${fmt(market.us.sp500.changePercent)})`,
          `- NASDAQ: ${market.us.nasdaq.value.toFixed(0)} (${fmt(market.us.nasdaq.changePercent)})`,
          `- Dow Jones: ${market.us.dowJones.value.toFixed(0)} (${fmt(market.us.dowJones.changePercent)})`,
        );
        if (market.india?.nifty50) {
          contextLines.push(
            `- NIFTY 50: ${market.india.nifty50.value.toFixed(0)} (${fmt(market.india.nifty50.changePercent)})`,
            `- Sensex: ${market.india.sensex.value.toFixed(0)} (${fmt(market.india.sensex.changePercent)})`,
          );
        }
        if (market.crypto?.bitcoin) {
          contextLines.push(
            `- BTC: $${market.crypto.bitcoin.price.toFixed(0)} (${fmt(market.crypto.bitcoin.change7dPercent)} 7d)`,
            `- ETH: $${market.crypto.ethereum.price.toFixed(0)} (${fmt(market.crypto.ethereum.change7dPercent)} 7d)`,
          );
        }
        contextLines.push(
          `- Gold $${market.global.gold.toFixed(0)} / Brent $${market.global.brentCrude.toFixed(1)} / USD-INR ${market.global.usdInr.toFixed(2)}`
        );
      }

      if (holdings.length > 0) {
        contextLines.push(
          '',
          `USER PORTFOLIO (${holdings.length} holdings):`,
          ...holdings.map((h) =>
            `- ${h.ticker} (${h.exchange}): ${h.quantity} shares @ avg ${h.avgBuyPrice}`
          ),
        );
      } else {
        contextLines.push('', 'USER PORTFOLIO: empty — encourage adding holdings for personalised answers.');
      }

      if (tickers.length > 0) {
        contextLines.push('', `USER WATCHLIST: ${tickers.join(', ')}`);
      }

      // Compose the system message with always-fresh context. The OpenAI/Groq
      // conversational convention is: system message first, then alternating
      // user/assistant. Putting context in the system slot means it's there on
      // every turn without bloating the visible chat history.
      const briefBlock = briefContent
        ? `\n\n--- BRIEF UNDER DISCUSSION ---\n${briefContent}\n--- END BRIEF ---`
        : '';
      const systemWithContext = `${CHAT_SYSTEM}\n\n--- LIVE CONTEXT (refreshed each turn) ---\n${contextLines.join('\n')}\n--- END CONTEXT ---${briefBlock}`;

      const trimmedHistory = history.slice(-10);
      const messages: { role: 'user' | 'assistant'; content: string }[] = [
        ...trimmedHistory,
        { role: 'user', content: message },
      ];

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1024,
        temperature: 0.35,
        messages: [
          { role: 'system', content: systemWithContext },
          ...messages,
        ],
      });

      const reply = response.choices[0]?.message?.content;
      if (!reply) throw new Error('Empty response from Groq API');

      // Persist the user/assistant turn server-side so it survives device
      // changes and a localStorage wipe. Best-effort — don't block the reply.
      void appendChatHistory(req.user.id, [
        { role: 'user', content: message },
        { role: 'assistant', content: reply },
      ]).catch((err) => logger.warn('chat history append failed', { error: String(err) }));

      res.json({ data: { reply } });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Chat generation failed', { userId: req.user.id, error: error.message });
      res.status(500).json({ error: 'Failed to generate response', code: 'CHAT_ERROR' });
    }
  }
);

// GET /chat/history — hydrate a returning user's conversation from the server.
router.get('/history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const history = await loadChatHistory(req.user.id);
  res.json({ data: history });
});

// DELETE /chat/history — clear all stored turns. Used by the "Clear" button.
router.delete('/history', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await clearChatHistory(req.user.id);
  res.json({ data: { cleared: true } });
});

export default router;
