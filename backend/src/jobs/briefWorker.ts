import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../../config/redis';
import { BRIEF_QUEUE_NAME } from './briefQueue';
import { orchestrateBriefGeneration } from '../services/briefService';
import { deliverByEmail, deliverByTelegram, notifyBriefFailure, sendPushNotification } from '../services/deliveryService';
import { prisma } from '../../config/db';
import { PLAN_FEATURES } from '../middleware/planGate';
import { logger } from '../utils/logger';
import { BriefGenerationJob } from '../types';

async function processBriefJob(job: Job<BriefGenerationJob>): Promise<void> {
  const { userId, weekOf, plan, briefId } = job.data;

  logger.info('Processing brief job', { jobId: job.id, userId, weekOf, plan });

  const result = await orchestrateBriefGeneration(job.data);

  // Fetch user delivery preferences
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, telegramChatId: true },
  });

  if (!user) {
    logger.warn('User not found for brief delivery', { userId, briefId });
    return;
  }

  const features = PLAN_FEATURES[plan as keyof typeof PLAN_FEATURES];
  const deliveryTasks: Promise<void>[] = [];

  const briefType = job.data.briefType ?? 'weekly';

  // Email delivery — all plans
  deliveryTasks.push(
    deliverByEmail(userId, user.email, user.name ?? 'there', briefId, result.content, weekOf, plan, briefType)
  );

  // Telegram delivery — starter+ with chatId configured
  if (features.telegramDelivery && user.telegramChatId) {
    deliveryTasks.push(
      deliverByTelegram(userId, user.telegramChatId, briefId, result.content, weekOf, briefType)
    );
  }

  await Promise.allSettled(deliveryTasks);

  // Push notification — fire-and-forget, non-fatal
  sendPushNotification(userId, briefId, briefType).catch(() => null);

  logger.info('Brief delivered', { userId, briefId, weekOf });
}

async function handleJobFailure(job: Job<BriefGenerationJob> | undefined, error: Error): Promise<void> {
  if (!job) return;

  const { userId, weekOf } = job.data;
  logger.error('Brief job permanently failed', {
    jobId: job.id,
    userId,
    weekOf,
    attempts: job.attemptsMade,
    error: error.message,
  });

  // Only notify user after all retries exhausted
  if (job.attemptsMade >= (job.opts.attempts ?? 3)) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (user) {
      await notifyBriefFailure(userId, user.email, weekOf);
    }
  }
}

export function startBriefWorker(): Worker<BriefGenerationJob> {
  const worker = new Worker<BriefGenerationJob>(
    BRIEF_QUEUE_NAME,
    processBriefJob,
    {
      connection: bullMQConnection,
      concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '3', 10),
    }
  );

  worker.on('completed', (job) => {
    logger.info('Worker: job completed', { jobId: job.id, userId: job.data.userId });
  });

  worker.on('failed', (job, error) => {
    handleJobFailure(job, error).catch(() => null);
  });

  worker.on('error', (error) => {
    logger.error('Worker error', { error: error.message });
  });

  logger.info('Brief worker started', {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY ?? '3', 10),
  });

  return worker;
}
