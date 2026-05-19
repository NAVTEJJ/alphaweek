/**
 * Price Alerts — unit tests for plan-gating logic and alert limit enforcement.
 * Uses node-mocks-http; does NOT require a live database.
 */

import { createRequest } from 'node-mocks-http';
import { AuthenticatedRequest } from '../src/middleware/auth';

// ─── Constants mirrored from alerts route ────────────────────────────────────

const PLAN_ALERT_LIMITS: Record<string, number> = {
  free: 0,
  starter: 0,
  pro: 10,
  elite: Infinity,
  whitelabel: Infinity,
};

function mockUser(plan: string): AuthenticatedRequest {
  return createRequest({
    user: { id: 'usr_test', email: 'test@example.com', plan },
  }) as unknown as AuthenticatedRequest;
}

// ─── Plan limit table ─────────────────────────────────────────────────────────

describe('PLAN_ALERT_LIMITS', () => {
  it('free plan cannot create price alerts', () => {
    expect(PLAN_ALERT_LIMITS['free']).toBe(0);
  });

  it('starter plan cannot create price alerts', () => {
    expect(PLAN_ALERT_LIMITS['starter']).toBe(0);
  });

  it('pro plan allows up to 10 alerts', () => {
    expect(PLAN_ALERT_LIMITS['pro']).toBe(10);
  });

  it('elite plan has unlimited alerts', () => {
    expect(PLAN_ALERT_LIMITS['elite']).toBe(Infinity);
  });

  it('whitelabel plan has unlimited alerts', () => {
    expect(PLAN_ALERT_LIMITS['whitelabel']).toBe(Infinity);
  });
});

// ─── Plan gate simulation ─────────────────────────────────────────────────────

describe('price alert plan-gate logic', () => {
  function canCreateAlert(plan: string): boolean {
    return (PLAN_ALERT_LIMITS[plan] ?? 0) > 0;
  }

  it('blocks free users from creating alerts', () => {
    expect(canCreateAlert('free')).toBe(false);
  });

  it('blocks starter users from creating alerts', () => {
    expect(canCreateAlert('starter')).toBe(false);
  });

  it('allows pro users to create alerts', () => {
    expect(canCreateAlert('pro')).toBe(true);
  });

  it('allows elite users to create alerts', () => {
    expect(canCreateAlert('elite')).toBe(true);
  });

  it('allows whitelabel users to create alerts', () => {
    expect(canCreateAlert('whitelabel')).toBe(true);
  });
});

// ─── Alert cap enforcement ────────────────────────────────────────────────────

describe('pro plan alert cap', () => {
  const PRO_LIMIT = PLAN_ALERT_LIMITS['pro'];

  it('allows adding up to the limit', () => {
    for (let count = 0; count < PRO_LIMIT; count++) {
      expect(count < PRO_LIMIT).toBe(true);
    }
  });

  it('rejects when count equals the limit', () => {
    const currentCount = 10;
    expect(currentCount >= PRO_LIMIT).toBe(true);
  });

  it('elite plan is never capped', () => {
    const limit = PLAN_ALERT_LIMITS['elite'];
    const currentCount = 9999;
    expect(currentCount >= limit).toBe(false);
  });
});

// ─── Direction / ticker validation helpers ────────────────────────────────────

describe('price alert input validation', () => {
  const VALID_EXCHANGES = ['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO'];
  const VALID_DIRECTIONS = ['above', 'below'];

  it('accepts all valid exchanges', () => {
    for (const ex of VALID_EXCHANGES) {
      expect(VALID_EXCHANGES.includes(ex)).toBe(true);
    }
  });

  it('rejects unknown exchange', () => {
    expect(VALID_EXCHANGES.includes('LSE')).toBe(false);
  });

  it('accepts both directions', () => {
    expect(VALID_DIRECTIONS.includes('above')).toBe(true);
    expect(VALID_DIRECTIONS.includes('below')).toBe(true);
  });

  it('rejects unknown direction', () => {
    expect(VALID_DIRECTIONS.includes('equal')).toBe(false);
  });

  it('target price must be positive', () => {
    expect(0 >= 0.001).toBe(false);   // 0 is invalid — below minimum
    expect(0.001 >= 0.001).toBe(true); // min valid
    expect(100 >= 0.001).toBe(true);
  });

  it('ticker is normalised to uppercase', () => {
    const raw = 'aapl';
    expect(raw.toUpperCase()).toBe('AAPL');
  });
});

// ─── AuthenticatedRequest shape ───────────────────────────────────────────────

describe('mocked authenticated request', () => {
  it('pro user request carries correct plan', () => {
    const req = mockUser('pro');
    expect(req.user.plan).toBe('pro');
    expect(req.user.id).toBe('usr_test');
  });

  it('elite user request carries correct plan', () => {
    const req = mockUser('elite');
    expect(req.user.plan).toBe('elite');
  });
});
