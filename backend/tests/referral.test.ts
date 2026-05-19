import { generateReferralCode, validateReferralApply } from '../src/utils/referral';

describe('generateReferralCode', () => {
  it('returns an 8-char uppercase alphanumeric code', () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[A-Z0-9]{8}$/);
  });

  it('produces unique codes across many invocations', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 1000; i++) codes.add(generateReferralCode());
    // With 36^8 codespace and 1000 samples, collision probability is ~1.7e-9
    expect(codes.size).toBe(1000);
  });
});

describe('validateReferralApply', () => {
  const base = {
    callerReferredBy: null,
    callerReferralCode: 'OWNCODE1',
    submittedCode: 'OTHER001',
    referrerExists: true,
  };

  it('allows a fresh referral apply', () => {
    expect(validateReferralApply(base)).toEqual({ ok: true });
  });

  it('rejects a second referral apply (idempotency guard)', () => {
    expect(validateReferralApply({ ...base, callerReferredBy: 'user_prev' })).toEqual({
      ok: false,
      code: 'ALREADY_REFERRED',
    });
  });

  it('rejects self-referral when caller submits their own code', () => {
    expect(
      validateReferralApply({ ...base, submittedCode: 'OWNCODE1' })
    ).toEqual({ ok: false, code: 'SELF_REFERRAL' });
  });

  it('rejects when the referrer code does not match any user', () => {
    expect(
      validateReferralApply({ ...base, referrerExists: false })
    ).toEqual({ ok: false, code: 'CODE_NOT_FOUND' });
  });

  it('ALREADY_REFERRED takes priority over other failures', () => {
    // Caller is already referred AND submits their own code AND referrer doesn't exist —
    // we should report the most-actionable failure (they already redeemed).
    expect(
      validateReferralApply({
        callerReferredBy: 'user_prev',
        callerReferralCode: 'OWNCODE1',
        submittedCode: 'OWNCODE1',
        referrerExists: false,
      })
    ).toEqual({ ok: false, code: 'ALREADY_REFERRED' });
  });
});
