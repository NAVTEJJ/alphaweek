import { redis } from '../../config/redis';

// Brief feedback lives in Redis until we earn a column on the Brief table.
// Each user can only vote once per brief — `voteKey` is the per-user record,
// `aggKey` is the brief-wide counter so we can show "12 up / 3 down" without
// scanning users.

function voteKey(briefId: string, userId: string): string {
  return `brief:vote:${briefId}:${userId}`;
}

function aggKey(briefId: string): string {
  return `brief:agg:${briefId}`;
}

export type Vote = 'up' | 'down';

export async function setBriefVote(
  briefId: string,
  userId: string,
  vote: Vote,
  reason?: string
): Promise<{ up: number; down: number; myVote: Vote }> {
  const userKey = voteKey(briefId, userId);
  const agg = aggKey(briefId);

  // What was the user's previous vote so we can adjust the aggregate?
  const previous = (await redis.hget(userKey, 'vote')) as Vote | null;

  const multi = redis.multi();
  multi.hset(userKey, { vote, reason: reason ?? '', at: new Date().toISOString() });
  // Keep per-user votes for 1 year — plenty for the feedback loop.
  multi.expire(userKey, 365 * 86400);

  if (previous !== vote) {
    multi.hincrby(agg, vote, 1);
    if (previous) multi.hincrby(agg, previous, -1);
  }
  await multi.exec();

  const [up, down] = await Promise.all([
    redis.hget(agg, 'up').then((v) => parseInt(v ?? '0', 10)),
    redis.hget(agg, 'down').then((v) => parseInt(v ?? '0', 10)),
  ]);
  return { up, down, myVote: vote };
}

export async function getBriefVoteSummary(
  briefId: string,
  userId: string
): Promise<{ up: number; down: number; myVote: Vote | null }> {
  const [up, down, mine] = await Promise.all([
    redis.hget(aggKey(briefId), 'up').then((v) => parseInt(v ?? '0', 10)),
    redis.hget(aggKey(briefId), 'down').then((v) => parseInt(v ?? '0', 10)),
    redis.hget(voteKey(briefId, userId), 'vote') as Promise<Vote | null>,
  ]);
  return { up, down, myVote: mine };
}
