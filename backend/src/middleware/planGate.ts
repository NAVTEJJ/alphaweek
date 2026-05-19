import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

type Plan = 'free' | 'starter' | 'pro' | 'elite' | 'whitelabel';

// Middleware factory — plan gates disabled for demo/review period
export function requirePlan(_minimumPlan: Plan) {
  return (_req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    next();
  };
}

// Feature flags per plan — central source of truth
export const PLAN_FEATURES: Record<Plan, {
  maxPortfolioHoldings: number;
  maxWatchlistTickers: number;
  briefsPerWeek: number;
  telegramDelivery: boolean;
  geopoliticalAlerts: boolean;
  sentimentAnalysis: boolean;
  sectorRotation: boolean;
  briefArchiveWeeks: number;
  rebalancingSuggestions: boolean;
  dailyMicroBriefs: boolean;
  priorityAI: boolean;
  whiteLabel: boolean;
}> = {
  free: {
    maxPortfolioHoldings: -1,
    maxWatchlistTickers: -1,
    briefsPerWeek: 5,
    telegramDelivery: true,
    geopoliticalAlerts: true,
    sentimentAnalysis: true,
    sectorRotation: true,
    briefArchiveWeeks: -1,
    rebalancingSuggestions: true,
    dailyMicroBriefs: true,
    priorityAI: true,
    whiteLabel: false,
  },
  starter: {
    maxPortfolioHoldings: -1,
    maxWatchlistTickers: -1,
    briefsPerWeek: 5,
    telegramDelivery: true,
    geopoliticalAlerts: true,
    sentimentAnalysis: true,
    sectorRotation: true,
    briefArchiveWeeks: -1,
    rebalancingSuggestions: true,
    dailyMicroBriefs: true,
    priorityAI: true,
    whiteLabel: false,
  },
  pro: {
    maxPortfolioHoldings: -1,
    maxWatchlistTickers: -1,
    briefsPerWeek: 5,
    telegramDelivery: true,
    geopoliticalAlerts: true,
    sentimentAnalysis: true,
    sectorRotation: true,
    briefArchiveWeeks: -1,
    rebalancingSuggestions: true,
    dailyMicroBriefs: true,
    priorityAI: true,
    whiteLabel: false,
  },
  elite: {
    maxPortfolioHoldings: -1, // unlimited
    maxWatchlistTickers: -1,
    briefsPerWeek: 5, // Mon–Fri micro-briefs
    telegramDelivery: true,
    geopoliticalAlerts: true,
    sentimentAnalysis: true,
    sectorRotation: true,
    briefArchiveWeeks: 52,
    rebalancingSuggestions: true,
    dailyMicroBriefs: true,
    priorityAI: true,
    whiteLabel: false,
  },
  whitelabel: {
    maxPortfolioHoldings: -1,
    maxWatchlistTickers: -1,
    briefsPerWeek: 7,
    telegramDelivery: true,
    geopoliticalAlerts: true,
    sentimentAnalysis: true,
    sectorRotation: true,
    briefArchiveWeeks: -1, // unlimited
    rebalancingSuggestions: true,
    dailyMicroBriefs: true,
    priorityAI: true,
    whiteLabel: true,
  },
};
