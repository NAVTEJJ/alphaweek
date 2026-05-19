import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 8;

// CSPRNG-backed referral code generator. 36^8 ≈ 2.8e12 — collisions negligible at our scale.
export function generateReferralCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export type ReferralApplyOutcome =
  | { ok: true }
  | { ok: false; code: 'ALREADY_REFERRED' | 'SELF_REFERRAL' | 'CODE_NOT_FOUND' };

// Decides whether a referral apply should succeed, given the caller's current
// state and the target referrer. Pure — no I/O — so the route handler can
// stay thin and this logic can be unit tested.
export function validateReferralApply(input: {
  callerReferredBy: string | null;
  callerReferralCode: string;
  submittedCode: string;
  referrerExists: boolean;
}): ReferralApplyOutcome {
  if (input.callerReferredBy) return { ok: false, code: 'ALREADY_REFERRED' };
  if (input.callerReferralCode === input.submittedCode) return { ok: false, code: 'SELF_REFERRAL' };
  if (!input.referrerExists) return { ok: false, code: 'CODE_NOT_FOUND' };
  return { ok: true };
}
