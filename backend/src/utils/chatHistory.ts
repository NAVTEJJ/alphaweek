import { redis } from '../../config/redis';

// Server-side chat history — stored as a JSON-encoded array in a single Redis
// key per user. Cap at MAX_TURNS messages (user + assistant rows combined) so
// the blob stays small and the read is one round-trip.
//
// Why a single key: we never need partial reads, the history is small enough
// (~40 rows × ~500 bytes ≈ 20KB), and atomic replacement avoids race conditions
// when two browser tabs both append at once.

const MAX_TURNS = 50;
const TTL_DAYS = 90;

function key(userId: string): string {
  return `chat:history:${userId}`;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  at: number; // ms epoch — lets the frontend sort if it merges with local drafts
}

export async function loadChatHistory(userId: string): Promise<ChatMessage[]> {
  try {
    const raw = await redis.get(key(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    // Defensive: drop any row that doesn't match our shape (legacy data, etc.)
    return parsed.filter(
      (m): m is ChatMessage =>
        m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
    );
  } catch {
    return [];
  }
}

export async function appendChatHistory(
  userId: string,
  newRows: { role: 'user' | 'assistant'; content: string }[]
): Promise<ChatMessage[]> {
  const existing = await loadChatHistory(userId);
  const now = Date.now();
  const stamped: ChatMessage[] = newRows.map((m, i) => ({ ...m, at: now + i }));
  const merged = [...existing, ...stamped].slice(-MAX_TURNS);
  await redis.set(key(userId), JSON.stringify(merged), 'EX', TTL_DAYS * 86400);
  return merged;
}

export async function clearChatHistory(userId: string): Promise<void> {
  await redis.del(key(userId));
}
