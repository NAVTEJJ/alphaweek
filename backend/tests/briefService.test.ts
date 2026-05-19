import { getCurrentWeekOf, createBriefRecord } from '../src/services/briefService';

// Mock prisma
const mockBriefCreate = jest.fn().mockResolvedValue({ id: 'brief_abc123' });
jest.mock('../config/db', () => ({
  prisma: {
    brief: { create: (...args: unknown[]) => mockBriefCreate(...args) },
  },
}));

describe('getCurrentWeekOf', () => {
  it('returns a valid YYYY-MM-DD string', () => {
    const result = getCurrentWeekOf();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('always returns a Monday', () => {
    const result = getCurrentWeekOf();
    const date = new Date(result + 'T00:00:00Z');
    // getUTCDay(): 0=Sun, 1=Mon
    expect(date.getUTCDay()).toBe(1);
  });

  it('is deterministic within same millisecond', () => {
    // Call many times — should all return same value
    const results = new Set(Array.from({ length: 10 }, () => getCurrentWeekOf()));
    expect(results.size).toBe(1);
  });
});

describe('createBriefRecord', () => {
  it('calls prisma.brief.create with correct shape', async () => {
    mockBriefCreate.mockClear();

    const id = await createBriefRecord('user_123', '2025-01-06', 'pro');

    expect(id).toBe('brief_abc123');
    expect(mockBriefCreate).toHaveBeenCalledTimes(1);

    const call = mockBriefCreate.mock.calls[0][0];
    expect(call.data.userId).toBe('user_123');
    expect(call.data.status).toBe('pending');
    expect(call.data.planAtGeneration).toBe('pro');
  });

  it('propagates DB errors', async () => {
    mockBriefCreate.mockRejectedValueOnce(new Error('DB connection failed'));

    await expect(
      createBriefRecord('user_123', '2025-01-06', 'free')
    ).rejects.toThrow('DB connection failed');
  });
});
