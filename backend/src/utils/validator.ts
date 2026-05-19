import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

// Run validation chains and return 422 if any fail
export function validate(chains: ValidationChain[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    await Promise.all(chains.map((chain) => chain.run(req)));

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(422).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.mapped(),
      });
      return;
    }
    next();
  };
}

// Sanitize a string — strip HTML tags, trim whitespace
export function sanitizeString(value: string): string {
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // strip script blocks + content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')    // strip style blocks + content
    .replace(/<[^>]*>/g, '')                                              // strip remaining tags
    .trim();
}

// Validate ticker format (1–10 uppercase letters, optionally suffixed with .NS/.BO for Indian stocks)
export function isValidTicker(ticker: string): boolean {
  return /^[A-Z]{1,10}(\.(NS|BO))?$/.test(ticker);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
