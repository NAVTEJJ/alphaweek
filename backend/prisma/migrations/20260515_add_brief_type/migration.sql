-- AlphaWeek: Add brief_type to briefs
-- Distinguishes daily micro-briefs (Mon-Fri for Elite) from weekly briefs.

DO $$ BEGIN
  CREATE TYPE "BriefType" AS ENUM ('weekly', 'daily');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "brief_type" "BriefType" NOT NULL DEFAULT 'weekly';
