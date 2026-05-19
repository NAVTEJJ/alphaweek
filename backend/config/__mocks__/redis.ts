// Lightweight in-memory stub replacing the real Redis client in unit tests.
// Tests that need a real Redis connection should not use this mock.

const store: Record<string, string> = {};

const redisMock = {
  get: jest.fn(async (key: string) => store[key] ?? null),
  set: jest.fn(async (key: string, value: string) => { store[key] = value; return 'OK'; }),
  del: jest.fn(async (...keys: string[]) => { keys.forEach((k) => delete store[k]); return keys.length; }),
  incr: jest.fn(async (key: string) => { store[key] = String((parseInt(store[key] ?? '0', 10) + 1)); return parseInt(store[key], 10); }),
  decr: jest.fn(async (key: string) => { store[key] = String((parseInt(store[key] ?? '0', 10) - 1)); return parseInt(store[key], 10); }),
  expire: jest.fn(async () => 1),
  pexpire: jest.fn(async () => 1),
  eval: jest.fn(async () => [1, 60000]),
  ping: jest.fn(async () => 'PONG'),
  on: jest.fn(),
  quit: jest.fn(async () => 'OK'),
  disconnect: jest.fn(),
};

export const redis = redisMock;
export const bullMQConnection = redisMock;

export async function cacheGet<T>(key: string): Promise<T | null> {
  const val = store[key];
  if (!val) return null;
  try { return JSON.parse(val) as T; } catch { return null; }
}

export async function cacheSet(key: string, value: unknown, _ttl: number): Promise<void> {
  store[key] = JSON.stringify(value);
}

export async function checkRedisHealth(): Promise<boolean> { return true; }
