-- AlphaWeek: Add public_slug to briefs for shareable links
ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "public_slug" TEXT UNIQUE;
CREATE UNIQUE INDEX IF NOT EXISTS "briefs_public_slug_key" ON "briefs"("public_slug");
