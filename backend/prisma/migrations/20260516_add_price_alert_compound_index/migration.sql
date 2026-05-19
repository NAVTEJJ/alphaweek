-- Add compound index on (userId, triggered) for the price alert checker query.
-- Without this, every 15-minute cron run does a full table scan when filtering
-- by userId and triggered=false across all users.

CREATE INDEX IF NOT EXISTS "price_alerts_userId_triggered_idx"
  ON "price_alerts"("user_id", "triggered");
