import { Queue, QueueEvents } from 'bullmq';
import { bullMQConnection } from '../../config/redis';
import { logger } from '../utils/logger';
import { BriefGenerationJob } from '../types';

export const BRIEF_QUEUE_NAME = 'brief-generation';

export const briefQueue = new Queue<BriefGenerationJob>(BRIEF_QUEUE_NAME, {
  connection: bullMQConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 60_000, // 1 minute base delay between retries
    },
    removeOnComplete: { count: 100 }, // Keep last 100 completed jobs
    removeOnFail: { count: 500 },     // Keep last 500 failed jobs
  },
});

export const briefQueueEvents = new QueueEvents(BRIEF_QUEUE_NAME, {
  connection: bullMQConnection,
});

briefQueueEvents.on('completed', ({ jobId }) => {
  logger.info('Brief job completed', { jobId });
});

briefQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.error('Brief job failed', { jobId, reason: failedReason });
});

export async function enqueueBriefJob(job: BriefGenerationJob): Promise<string> {
  const bullJob = await briefQueue.add('generate-brief', job, {
    jobId: `brief-${job.briefId}`,
    priority: job.plan === 'elite' || job.plan === 'whitelabel' ? 1 : 10,
  });

  logger.info('Brief job enqueued', {
    jobId: bullJob.id,
    userId: job.userId,
    plan: job.plan,
    weekOf: job.weekOf,
  });

  return bullJob.id ?? job.briefId;
}

// Returns where a brief sits in the queue and an ETA. Used by the frontend's
// pending-brief banner so users see "#3 in queue, ready in ~90s" instead of
// "queued" with no progress signal.
//
// Position is approximate — BullMQ doesn't expose an exact queue index, but
// "waiting count + active count" is a good upper bound on how many jobs are
// ahead of us. Avg gen time is hardcoded; we'll learn it from telemetry later.
const AVG_BRIEF_SECONDS = 30;

export interface BriefQueueStatus {
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';
  positionInQueue: number | null;     // null when active/completed
  ahead: number | null;                // jobs ahead of this one
  estimatedSecondsUntilStart: number | null;
  estimatedSecondsUntilComplete: number | null;
}

export async function getBriefQueueStatus(briefId: string): Promise<BriefQueueStatus> {
  const jobId = `brief-${briefId}`;
  const job = await briefQueue.getJob(jobId);
  if (!job) {
    return { state: 'unknown', positionInQueue: null, ahead: null, estimatedSecondsUntilStart: null, estimatedSecondsUntilComplete: null };
  }

  const state = await job.getState();
  const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? '3', 10);

  if (state === 'completed') {
    return { state: 'completed', positionInQueue: null, ahead: 0, estimatedSecondsUntilStart: 0, estimatedSecondsUntilComplete: 0 };
  }
  if (state === 'failed') {
    return { state: 'failed', positionInQueue: null, ahead: null, estimatedSecondsUntilStart: null, estimatedSecondsUntilComplete: null };
  }
  if (state === 'active') {
    return {
      state: 'active',
      positionInQueue: 0,
      ahead: 0,
      estimatedSecondsUntilStart: 0,
      estimatedSecondsUntilComplete: AVG_BRIEF_SECONDS,
    };
  }

  // Waiting / delayed: use waiting+active counts as the upper bound on jobs ahead.
  // We can't determine exact position cheaply; the displayed value is approximate.
  const [waiting, active] = await Promise.all([
    briefQueue.getWaitingCount(),
    briefQueue.getActiveCount(),
  ]);
  // Conservative: our job is *somewhere* in the waiting list. Best-case 1st.
  const ahead = Math.max(0, waiting - 1) + active;
  const waveSeconds = Math.ceil(ahead / Math.max(1, concurrency)) * AVG_BRIEF_SECONDS;

  return {
    state: 'waiting',
    positionInQueue: ahead + 1,
    ahead,
    estimatedSecondsUntilStart: waveSeconds,
    estimatedSecondsUntilComplete: waveSeconds + AVG_BRIEF_SECONDS,
  };
}
