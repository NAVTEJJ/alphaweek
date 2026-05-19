// Set required env vars before any module is imported during tests.
// These are dummy values — no real network calls are made in unit tests.
// Point REDIS_URL at a non-routable address so ioredis fails fast rather than
// hanging for 30s. Tests that need Redis should mock the config/redis module.
process.env.REDIS_URL            = process.env.REDIS_URL            ?? 'redis://127.0.0.2:6399';
process.env.DATABASE_URL         = process.env.DATABASE_URL         ?? 'postgresql://test:test@localhost/test';
process.env.DATABASE_URL_UNPOOLED= process.env.DATABASE_URL_UNPOOLED?? 'postgresql://test:test@localhost/test';
process.env.GROQ_API_KEY         = process.env.GROQ_API_KEY         ?? 'test-key';
process.env.CLERK_SECRET_KEY     = process.env.CLERK_SECRET_KEY     ?? 'test-key';
process.env.CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? 'test-key';
process.env.RESEND_API_KEY       = process.env.RESEND_API_KEY       ?? 'test-key';
process.env.VAPID_PUBLIC_KEY     = process.env.VAPID_PUBLIC_KEY     ?? 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
process.env.VAPID_PRIVATE_KEY    = process.env.VAPID_PRIVATE_KEY    ?? 'UUxI4O8-FbRouAevSmBQ6co62grn2DCR5y_E-K9m6r0';
process.env.ALPHA_VANTAGE_API_KEY= process.env.ALPHA_VANTAGE_API_KEY?? 'test-key';
process.env.NEWS_API_KEY         = process.env.NEWS_API_KEY         ?? 'test-key';
process.env.UNSUBSCRIBE_SECRET   = process.env.UNSUBSCRIBE_SECRET   ?? 'test-secret-32-chars-long-minimum';
