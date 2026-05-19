import { Request, Response, NextFunction } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import { generateReferralCode } from '../utils/referral';

let _clerkClient: ReturnType<typeof createClerkClient> | null = null;
function getClerkClient() {
  if (!_clerkClient) {
    _clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  }
  return _clerkClient;
}
import { prisma } from '../../config/db';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    plan: 'free' | 'starter' | 'pro' | 'elite' | 'whitelabel';
  };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing or invalid Authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.slice(7);
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!clerkSecretKey) {
    res.status(500).json({ error: 'Auth not configured', code: 'AUTH_CONFIG_ERROR' });
    return;
  }

  try {
    // Verify Clerk JWT — throws if invalid or expired
    const payload = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    const clerkUserId = payload.sub;

    // Fetch user from our DB (includes plan)
    const user = await prisma.user.findUnique({
      where: { id: clerkUserId },
      select: { id: true, email: true, plan: true },
    });

    if (!user) {
      // User exists in Clerk but not yet synced to our DB
      // Fetch from Clerk and auto-provision
      const clerkUser = await getClerkClient().users.getUser(clerkUserId);
      const email = clerkUser.emailAddresses[0]?.emailAddress ?? '';

      const newUser = await prisma.user.upsert({
        where: { id: clerkUserId },
        create: {
          id: clerkUserId,
          email,
          name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
          plan: 'free',
          referralCode: generateReferralCode(),
          portfolio: { create: { holdings: [] } },
          watchlist: { create: { tickers: [] } },
        },
        update: { email },
        select: { id: true, email: true, plan: true },
      });

      (req as AuthenticatedRequest).user = {
        id: newUser.id,
        email: newUser.email,
        plan: newUser.plan,
      };
    } else {
      (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        plan: user.plan,
      };
    }

    next();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (error.message.includes('expired') || error.message.includes('invalid')) {
      res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
      return;
    }

    logger.error('Auth middleware error', { error: error.message });
    res.status(500).json({ error: 'Authentication error', code: 'AUTH_ERROR' });
  }
}

