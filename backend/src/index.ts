import 'dotenv/config';
import { validateEnv } from './utils/envValidation';
validateEnv(); // Exits with clear error if any required env var is missing
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'crypto';
import * as Sentry from '@sentry/node';
import { logger } from './utils/logger';
import { verifyDatabaseConnection } from '../config/db';
import { verifyRedisConnection } from '../config/redis';
import { publicRateLimit } from './middleware/rateLimit';
import { getYahooHealth } from './utils/yahooHealth';

// Route imports — auth is handled by Clerk (frontend SDK + JWT middleware)
import userRoutes from './routes/user';
import briefRoutes from './routes/briefs';
import portfolioRoutes from './routes/portfolio';
import webhookRoutes from './routes/webhooks';
import adminRoutes from './routes/admin';
import marketRoutes from './routes/market';
import alertRoutes from './routes/alerts';
import chatRoutes from './routes/chat';
import screenerRoutes from './routes/screener';
import unsubscribeRoutes from './routes/unsubscribe';

const app = express();
const PORT = parseInt(process.env.PORT ?? '4000', 10);

// Trust the Railway/Nginx reverse proxy so req.ip reflects the real client IP.
// Without this, rate limiting keys on the proxy IP, defeating per-IP limits.
app.set('trust proxy', 1);

// ─── Sentry (must be first) ───────────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
}

// ─── Gzip compression ─────────────────────────────────────────────────────────
app.use(compression());

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.APP_URL ?? 'http://localhost:3000',
  ...(process.env.NODE_ENV === 'production'
    ? ['https://alphaweek.io', 'https://www.alphaweek.io']
    : []),
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Request ID + logging middleware ─────────────────────────────────────────
app.use((req, res, next) => {
  const requestId = randomUUID();
  res.setHeader('X-Request-Id', requestId);
  (req as typeof req & { requestId: string }).requestId = requestId;

  const start = Date.now();
  res.on('finish', () => {
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - start,
      requestId,
    });
  });

  next();
});

// ─── Global rate limit ────────────────────────────────────────────────────────
app.use(publicRateLimit);

// ─── Health check (no auth, no rate limit) ───────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'alphaweek-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Yahoo Finance reliability — surfaces success rate over a 10-minute sliding
// window so ops can see when our upstream is degraded. Public on purpose so
// status pages can poll it without auth.
app.get('/health/yahoo', async (_req, res) => {
  try {
    const health = await getYahooHealth();
    const httpStatus =
      health.status === 'unhealthy' ? 503 :
      health.status === 'degraded' ? 200 : 200;
    res.status(httpStatus).json(health);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read Yahoo health', detail: String(err) });
  }
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/user', userRoutes);
app.use('/briefs', briefRoutes);
app.use('/portfolio', portfolioRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/admin', adminRoutes);
app.use('/market', marketRoutes);
app.use('/alerts', alertRoutes);
app.use('/chat', chatRoutes);
app.use('/screener', screenerRoutes);
app.use('/unsubscribe', unsubscribeRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
  });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((
  err: Error,
  req: express.Request,
  res: express.Response,
  _next: express.NextFunction
) => {
  const requestId = (req as typeof req & { requestId?: string }).requestId;
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId,
    path: req.path,
    method: req.method,
  });

  if (process.env.NODE_ENV !== 'production') {
    Sentry.captureException(err);
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    requestId,
  });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  try {
    logger.info('Verifying database connection...');
    await verifyDatabaseConnection();
    logger.info('Database connection verified');

    logger.info('Verifying Redis connection...');
    await verifyRedisConnection();
    logger.info('Redis connection verified');

    // Start job scheduler (weekly brief cron + price alert checker)
    if (process.env.NODE_ENV !== 'test') {
      const { startWeeklyScheduler } = await import('./jobs/weeklyScheduler');
      await startWeeklyScheduler();
      logger.info('Weekly scheduler started');

      const { startPriceAlertChecker } = await import('./jobs/priceAlertChecker');
      startPriceAlertChecker();
      logger.info('Price alert checker started');
    }

    const server = app.listen(PORT, () => {
      logger.info(`AlphaWeek API running on port ${PORT}`, {
        environment: process.env.NODE_ENV,
        port: PORT,
      });
    });

    // Graceful shutdown — Railway/Docker sends SIGTERM before killing
    const shutdown = (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(async () => {
        logger.info('HTTP server closed');
        // Close the shared puppeteer browser so we don't leave a Chromium
        // zombie process behind on container exit.
        try {
          const { shutdownPdfBrowser } = await import('./services/pdfService');
          await shutdownPdfBrowser();
        } catch { /* non-fatal */ }
        process.exit(0);
      });
      // Force exit after 10s if connections don't drain
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
}

start();

export default app;
