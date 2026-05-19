import request from 'supertest';
import express from 'express';
import { publicRateLimit, authRateLimit } from '../src/middleware/rateLimit';

function buildApp(middleware: express.RequestHandler) {
  const app = express();
  app.use(middleware);
  app.get('/test', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('publicRateLimit', () => {
  it('allows requests under the limit', async () => {
    const app = buildApp(publicRateLimit);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('sets RateLimit headers', async () => {
    const app = buildApp(publicRateLimit);
    const res = await request(app).get('/test');
    // express-rate-limit v7 sets RateLimit-Limit
    expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
  });
});

describe('authRateLimit', () => {
  it('allows first request through', async () => {
    const app = buildApp(authRateLimit);
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
  });
});
