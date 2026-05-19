// Validates required environment variables at startup and exits with a clear
// error message rather than allowing the process to start with missing config.

interface EnvVar {
  key: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Database
  { key: 'DATABASE_URL', required: true, description: 'Neon PostgreSQL connection string' },
  { key: 'DATABASE_URL_UNPOOLED', required: true, description: 'Neon direct (unpooled) connection' },

  // Auth
  { key: 'CLERK_SECRET_KEY', required: true, description: 'Clerk backend secret key' },
  { key: 'CLERK_WEBHOOK_SECRET', required: true, description: 'Clerk webhook signing secret' },

  // AI
  { key: 'GROQ_API_KEY', required: true, description: 'Groq API key (free — console.groq.com)' },

  // Redis
  { key: 'REDIS_URL', required: true, description: 'Redis connection URL' },

  // Email
  { key: 'RESEND_API_KEY', required: true, description: 'Resend email API key' },

  // Storage
  { key: 'R2_ACCOUNT_ID', required: true, description: 'Cloudflare R2 account ID' },
  { key: 'R2_ACCESS_KEY_ID', required: true, description: 'Cloudflare R2 access key' },
  { key: 'R2_SECRET_ACCESS_KEY', required: true, description: 'Cloudflare R2 secret key' },
  { key: 'R2_BUCKET_NAME', required: true, description: 'Cloudflare R2 bucket name' },
  { key: 'R2_PUBLIC_URL', required: true, description: 'Cloudflare R2 public CDN URL' },

  // Optional but recommended
  { key: 'NEWS_API_KEY', required: false, description: 'NewsAPI key (geo-political alerts)' },
  { key: 'TELEGRAM_BOT_TOKEN', required: false, description: 'Telegram bot token (delivery)' },
  { key: 'SENTRY_DSN', required: false, description: 'Sentry DSN (error tracking)' },
  { key: 'APP_URL', required: false, description: 'Frontend URL for email links' },
  { key: 'ADMIN_API_KEY', required: false, description: 'Admin dashboard API key' },
  { key: 'RESEND_FROM_EMAIL', required: false, description: 'Verified sending email address' },
  { key: 'RESEND_FROM_NAME', required: false, description: 'Sender display name' },
  { key: 'REDDIT_CLIENT_ID', required: false, description: 'Reddit API client ID (Elite sentiment)' },
  { key: 'REDDIT_CLIENT_SECRET', required: false, description: 'Reddit API client secret' },
  { key: 'WORKER_CONCURRENCY', required: false, description: 'BullMQ worker concurrency (default: 3)' },
];

export function validateEnv(): void {
  // Skip strict validation in test environment
  if (process.env.NODE_ENV === 'test') return;

  const missing: EnvVar[] = [];
  const warnings: EnvVar[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.key];
    if (!value || value.trim() === '') {
      if (envVar.required) {
        missing.push(envVar);
      } else {
        warnings.push(envVar);
      }
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Optional env vars not set (some features may be disabled):');
    for (const w of warnings) {
      console.warn(`   ${w.key.padEnd(30)} — ${w.description}`);
    }
  }

  if (missing.length > 0) {
    console.error('\n❌ FATAL: Required environment variables are missing:\n');
    for (const m of missing) {
      console.error(`   ${m.key.padEnd(30)} — ${m.description}`);
    }
    console.error('\nCopy .env.example to .env and fill in the missing values.\n');
    process.exit(1);
  }
}
