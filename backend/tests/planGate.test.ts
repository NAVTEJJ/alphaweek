import { createRequest, createResponse } from 'node-mocks-http';
import { requirePlan, PLAN_FEATURES } from '../src/middleware/planGate';
import { AuthenticatedRequest } from '../src/middleware/auth';

function mockReq(plan: string): AuthenticatedRequest {
  return createRequest({
    user: { id: 'usr_1', email: 'test@test.com', plan },
  }) as unknown as AuthenticatedRequest;
}

// Plan gates are disabled during the beta — all users are equal.
// requirePlan always calls next() regardless of plan.
describe('requirePlan middleware', () => {
  it('allows free users through any gate', () => {
    const req = mockReq('free');
    const res = createResponse();
    const next = jest.fn();
    requirePlan('starter')(req, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows starter users through pro gate', () => {
    const req = mockReq('starter');
    const res = createResponse();
    const next = jest.fn();
    requirePlan('pro')(req, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows exact plan match', () => {
    const req = mockReq('elite');
    const res = createResponse();
    const next = jest.fn();
    requirePlan('elite')(req, res as never, next);
    expect(next).toHaveBeenCalled();
  });

  it('whitelabel passes all plan gates', () => {
    for (const plan of ['free', 'starter', 'pro', 'elite', 'whitelabel'] as const) {
      const req = mockReq('whitelabel');
      const res = createResponse();
      const next = jest.fn();
      requirePlan(plan)(req, res as never, next);
      expect(next).toHaveBeenCalled();
    }
  });
});

// All plans have equal feature access during beta.
describe('PLAN_FEATURES', () => {
  it('all plans have unlimited portfolio holdings', () => {
    for (const plan of ['free', 'starter', 'pro', 'elite', 'whitelabel'] as const) {
      expect(PLAN_FEATURES[plan].maxPortfolioHoldings).toBe(-1);
    }
  });

  it('all plans have Telegram delivery enabled', () => {
    for (const plan of ['free', 'starter', 'pro', 'elite', 'whitelabel'] as const) {
      expect(PLAN_FEATURES[plan].telegramDelivery).toBe(true);
    }
  });

  it('all plans have sentiment analysis enabled', () => {
    for (const plan of ['free', 'starter', 'pro', 'elite', 'whitelabel'] as const) {
      expect(PLAN_FEATURES[plan].sentimentAnalysis).toBe(true);
    }
  });

  it('all plans have geopolitical alerts enabled', () => {
    for (const plan of ['free', 'starter', 'pro', 'elite', 'whitelabel'] as const) {
      expect(PLAN_FEATURES[plan].geopoliticalAlerts).toBe(true);
    }
  });

  it('whitelabel has whiteLabel flag set', () => {
    expect(PLAN_FEATURES.whitelabel.whiteLabel).toBe(true);
  });

  it('non-whitelabel plans have whiteLabel flag unset', () => {
    for (const plan of ['free', 'starter', 'pro', 'elite'] as const) {
      expect(PLAN_FEATURES[plan].whiteLabel).toBe(false);
    }
  });
});
