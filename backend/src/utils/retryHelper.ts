import { logger } from './logger';

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delayMs = 1000,
    backoffMultiplier = 2,
    onRetry,
  } = options;

  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxAttempts) break;

      const waitMs = delayMs * Math.pow(backoffMultiplier, attempt - 1);

      logger.warn(`${context} failed (attempt ${attempt}/${maxAttempts}), retrying in ${waitMs}ms`, {
        error: lastError.message,
        attempt,
        context,
      });

      if (onRetry) onRetry(attempt, lastError);

      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  logger.error(`${context} failed after ${maxAttempts} attempts`, {
    error: lastError.message,
    context,
  });

  throw lastError;
}
