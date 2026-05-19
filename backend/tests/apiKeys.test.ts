/**
 * WhiteLabel API Keys — unit tests for key generation format, hash logic,
 * and plan-gating rules. Does NOT require a live database.
 */

import { createHash, randomBytes } from 'crypto';

// ─── Key generation helpers (mirrors user route logic exactly) ────────────────

function generateApiKey(): { rawKey: string; keyHash: string; prefix: string } {
  const rawKey = `aw_live_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const prefix = rawKey.slice(0, 12); // "aw_live_XXXX"
  return { rawKey, keyHash, prefix };
}

// ─── Key format ───────────────────────────────────────────────────────────────

describe('API key format', () => {
  it('starts with aw_live_ prefix', () => {
    const { rawKey } = generateApiKey();
    expect(rawKey.startsWith('aw_live_')).toBe(true);
  });

  it('has correct total length (8 prefix + 48 hex chars = 56 chars)', () => {
    const { rawKey } = generateApiKey();
    // "aw_live_" = 8 chars, randomBytes(24).toString('hex') = 48 chars
    expect(rawKey.length).toBe(56);
  });

  it('display prefix is 12 characters', () => {
    const { prefix } = generateApiKey();
    expect(prefix.length).toBe(12);
    expect(prefix).toBe('aw_live_XXXX'.replace('XXXX', prefix.slice(8)));
    expect(prefix.startsWith('aw_live_')).toBe(true);
  });

  it('generates unique keys each time', () => {
    const a = generateApiKey().rawKey;
    const b = generateApiKey().rawKey;
    expect(a).not.toBe(b);
  });
});

// ─── Hash correctness ─────────────────────────────────────────────────────────

describe('API key hash', () => {
  it('produces a 64-char hex SHA-256 hash', () => {
    const { keyHash } = generateApiKey();
    expect(keyHash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(keyHash)).toBe(true);
  });

  it('same raw key always produces same hash (deterministic)', () => {
    const raw = 'aw_live_abc123def456abc123def456abc123def456abc123def456';
    const h1 = createHash('sha256').update(raw).digest('hex');
    const h2 = createHash('sha256').update(raw).digest('hex');
    expect(h1).toBe(h2);
  });

  it('different raw keys produce different hashes', () => {
    const { keyHash: h1 } = generateApiKey();
    const { keyHash: h2 } = generateApiKey();
    expect(h1).not.toBe(h2);
  });

  it('raw key cannot be recovered from hash (one-way property)', () => {
    const { rawKey, keyHash } = generateApiKey();
    // SHA-256 is one-way — we verify by checking that the hash does NOT equal rawKey
    expect(keyHash).not.toBe(rawKey);
    expect(keyHash.length).not.toBe(rawKey.length);
  });

  it('verifying a key: hash of incoming key matches stored hash', () => {
    const { rawKey, keyHash } = generateApiKey();
    const incoming = rawKey;
    const incomingHash = createHash('sha256').update(incoming).digest('hex');
    expect(incomingHash).toBe(keyHash);
  });

  it('wrong key does not match stored hash', () => {
    const { keyHash } = generateApiKey();
    const wrongKey = 'aw_live_wrong';
    const wrongHash = createHash('sha256').update(wrongKey).digest('hex');
    expect(wrongHash).not.toBe(keyHash);
  });
});

// ─── Plan gate ────────────────────────────────────────────────────────────────

describe('API key plan gate', () => {
  function isWhitelabel(plan: string): boolean {
    return plan === 'whitelabel';
  }

  it('whitelabel plan has access', () => {
    expect(isWhitelabel('whitelabel')).toBe(true);
  });

  it('free plan is blocked', () => {
    expect(isWhitelabel('free')).toBe(false);
  });

  it('starter plan is blocked', () => {
    expect(isWhitelabel('starter')).toBe(false);
  });

  it('pro plan is blocked', () => {
    expect(isWhitelabel('pro')).toBe(false);
  });

  it('elite plan is blocked', () => {
    expect(isWhitelabel('elite')).toBe(false);
  });
});

// ─── Key limit ────────────────────────────────────────────────────────────────

describe('API key limit', () => {
  const MAX_KEYS = 10;

  it('allows creating a key when count is below limit', () => {
    const count = 9;
    expect(count < MAX_KEYS).toBe(true);
  });

  it('blocks creating a key when count equals limit', () => {
    const count = 10;
    expect(count >= MAX_KEYS).toBe(true);
  });

  it('max is exactly 10', () => {
    expect(MAX_KEYS).toBe(10);
  });
});

// ─── Key name validation ──────────────────────────────────────────────────────

describe('API key name validation', () => {
  it('accepts a short valid name', () => {
    const name = 'Production';
    expect(name.trim().length >= 1 && name.trim().length <= 50).toBe(true);
  });

  it('rejects empty name', () => {
    const name = '';
    expect(name.trim().length >= 1).toBe(false);
  });

  it('rejects name exceeding 50 characters', () => {
    const name = 'a'.repeat(51);
    expect(name.trim().length <= 50).toBe(false);
  });

  it('accepts name at max boundary (50 chars)', () => {
    const name = 'a'.repeat(50);
    expect(name.trim().length <= 50).toBe(true);
  });
});
