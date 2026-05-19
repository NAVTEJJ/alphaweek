#!/usr/bin/env node
// Run with: node scripts/migrate.mjs
// Applies pending Alphaweek migrations directly via pg — no Prisma CLI required.
// Reads DATABASE_URL from .env in the backend root.

import { readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { connect } from 'node:tls';
import { URL } from 'node:url';

// ── Minimal .env parser ──────────────────────────────────────────────────────
function loadEnv(path) {
  try {
    const lines = readFileSync(path, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env not found — rely on actual environment variables
  }
}

loadEnv(new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not set. Fill in backend/.env first.');
  process.exit(1);
}

// ── SQL to apply ─────────────────────────────────────────────────────────────
const MIGRATIONS = [
  {
    name: '20260515_add_referral_reward_given',
    sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "referral_reward_given" BOOLEAN NOT NULL DEFAULT false;`,
  },
  {
    name: '20260515_add_brief_type',
    sql: `
      DO $$ BEGIN
        CREATE TYPE "BriefType" AS ENUM ('weekly', 'daily');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
      ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "brief_type" "BriefType" NOT NULL DEFAULT 'weekly';
    `,
  },
  {
    name: '20260516_add_price_alert_compound_index',
    sql: `CREATE INDEX IF NOT EXISTS "price_alerts_userId_triggered_idx"
            ON "price_alerts"("user_id", "triggered");`,
  },
];

// ── PostgreSQL client ────────────────────────────────────────────────────────
async function runMigrations() {
  const { default: pg } = await import('pg');
  const { Client } = pg;
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('Connected to database.');

    // Ensure migration tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_alphaweek_migrations" (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    for (const { name, sql } of MIGRATIONS) {
      const { rows } = await client.query(
        `SELECT 1 FROM "_alphaweek_migrations" WHERE name = $1`,
        [name]
      );
      if (rows.length > 0) {
        console.log(`  [skip] ${name} — already applied`);
        continue;
      }

      console.log(`  [run]  ${name}`);
      await client.query(sql);
      await client.query(
        `INSERT INTO "_alphaweek_migrations" (name) VALUES ($1)`,
        [name]
      );
      console.log(`  [done] ${name}`);
    }

    console.log('\nAll migrations applied.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
