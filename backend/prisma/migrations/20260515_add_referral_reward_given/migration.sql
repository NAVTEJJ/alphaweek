-- AlphaWeek: Add referral_reward_given to users
-- Tracks whether the Stripe $29 credit has been issued to a referrer
-- to prevent double-crediting on repeated webhook deliveries.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_reward_given" BOOLEAN NOT NULL DEFAULT false;
