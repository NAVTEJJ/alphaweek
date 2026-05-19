import request from 'supertest';
import express from 'express';
import webhookRoutes from '../src/routes/webhooks';

jest.mock('../config/db', () => ({
  prisma: {
    user: {
      upsert: jest.fn().mockResolvedValue({ id: 'usr_1', email: 'test@test.com' }),
      delete: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    portfolio: { create: jest.fn().mockResolvedValue({}) },
    alert: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('svix', () => ({
  Webhook: jest.fn().mockImplementation(() => ({
    verify: jest.fn().mockReturnValue({
      type: 'user.created',
      data: {
        id: 'user_test123',
        email_addresses: [{ email_address: 'test@example.com' }],
        first_name: 'Test',
        last_name: 'User',
      },
    }),
  })),
}));

const app = express();
app.use(express.json());
app.use('/webhooks', webhookRoutes);

// Stripe webhook route no longer exists — payments are disabled in beta.
describe('POST /webhooks/stripe', () => {
  it('returns 404 — stripe payments not active in beta', async () => {
    const res = await request(app)
      .post('/webhooks/stripe')
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('POST /webhooks/clerk', () => {
  it('returns 400 when svix headers are missing', async () => {
    const res = await request(app)
      .post('/webhooks/clerk')
      .send({ type: 'user.created', data: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing svix headers/i);
  });

  it('returns 200 on valid user.created event', async () => {
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test_clerk_secret';
    const res = await request(app)
      .post('/webhooks/clerk')
      .set('svix-id', 'msg_test')
      .set('svix-timestamp', String(Math.floor(Date.now() / 1000)))
      .set('svix-signature', 'v1,test_signature')
      .send({ type: 'user.created', data: {} });
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
