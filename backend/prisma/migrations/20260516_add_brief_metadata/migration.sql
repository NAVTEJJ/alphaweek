-- AlphaWeek: Add structured metadata columns to briefs
-- Stores Market Mood, 30-second summary, and closing question as separate
-- fields so they can be displayed independently of the main markdown content.

ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "mood"             TEXT;
ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "mood_reason"      TEXT;
ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "brief_summary"    TEXT;
ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "closing_question" TEXT;
