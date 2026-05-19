import { Router, Response } from 'express';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { apiRateLimit } from '../middleware/rateLimit';
import { prisma } from '../../config/db';
import { parsePortfolioCSV, ParsedHolding } from '../utils/csvParser';
import { logger } from '../utils/logger';

const router = Router();
router.use(requireAuth as never);
router.use(apiRateLimit);

function validateCsvBody(csv: unknown, mode: unknown): { error: string; code: string } | null {
  if (!csv || typeof csv !== 'string') return { error: 'csv field is required', code: 'MISSING_CSV' };
  if (csv.length > 500_000) return { error: 'CSV file too large (max 500 KB)', code: 'CSV_TOO_LARGE' };
  if (mode !== undefined && !['replace', 'merge'].includes(mode as string)) {
    return { error: 'mode must be "replace" or "merge"', code: 'INVALID_MODE' };
  }
  return null;
}

// POST /portfolio/import-csv/preview — dry-run: parse the CSV and return what
// *would* be imported, without writing to the database. Lets the UI show a
// confirmation table before committing.
router.post(
  '/import-csv/preview',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { csv, mode = 'replace' } = req.body as { csv: string; mode?: 'replace' | 'merge' };
    const validationError = validateCsvBody(csv, mode);
    if (validationError) {
      res.status(400).json(validationError);
      return;
    }

    try {
      const { holdings: parsed, invalidRowCount } = parsePortfolioCSV(csv);

      let finalHoldings: ParsedHolding[] = parsed;
      let existingCount = 0;
      let overlapCount = 0;

      if (mode === 'merge') {
        const existing = await prisma.portfolio.findUnique({
          where: { userId: req.user.id },
          select: { holdings: true },
        });
        const existingHoldings = ((existing?.holdings ?? []) as unknown) as ParsedHolding[];
        existingCount = existingHoldings.length;
        const importedTickers = new Set(parsed.map((h) => h.ticker));
        overlapCount = existingHoldings.filter((h) => importedTickers.has(h.ticker)).length;

        const existingMap = new Map(existingHoldings.map((h) => [h.ticker, h]));
        for (const h of parsed) existingMap.set(h.ticker, h);
        finalHoldings = Array.from(existingMap.values());
      }

      res.json({
        data: {
          holdings: finalHoldings,
          parsed,
        },
        meta: {
          imported: parsed.length,
          invalidRowCount,
          existingCount,
          overlapCount,
          finalCount: finalHoldings.length,
          mode,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('CSV preview failed', { userId: req.user.id, error: error.message });
      res.status(500).json({ error: 'Failed to preview CSV', code: 'PREVIEW_ERROR' });
    }
  }
);

// POST /portfolio/import-csv — parse a CSV and replace/merge portfolio
// Body: { csv: string; mode: 'replace' | 'merge' }
router.post(
  '/import-csv',
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { csv, mode = 'replace' } = req.body as { csv: string; mode?: 'replace' | 'merge' };
    const validationError = validateCsvBody(csv, mode);
    if (validationError) {
      res.status(400).json(validationError);
      return;
    }

    try {
      const { holdings: parsed, invalidRowCount } = parsePortfolioCSV(csv);

      if (parsed.length === 0) {
        res.status(422).json({
          error: 'No valid holdings found in CSV. Ensure columns: ticker, quantity, avgBuyPrice',
          code: 'NO_VALID_HOLDINGS',
        });
        return;
      }

      let finalHoldings: ParsedHolding[] = parsed;

      if (mode === 'merge') {
        const existing = await prisma.portfolio.findUnique({
          where: { userId: req.user.id },
          select: { holdings: true },
        });
        const existingHoldings = ((existing?.holdings ?? []) as unknown) as ParsedHolding[];
        // Merge: imported tickers override existing ones, new ones appended
        const existingMap = new Map(existingHoldings.map((h) => [h.ticker, h]));
        for (const h of parsed) existingMap.set(h.ticker, h);
        finalHoldings = Array.from(existingMap.values());
      }

      const portfolio = await prisma.portfolio.update({
        where: { userId: req.user.id },
        data: { holdings: finalHoldings as unknown as object[] },
        select: { id: true, holdings: true, updatedAt: true },
      });

      logger.info('Portfolio imported via CSV', {
        userId: req.user.id,
        imported: parsed.length,
        final: finalHoldings.length,
        mode,
      });

      res.json({
        data: portfolio,
        meta: { imported: parsed.length, total: finalHoldings.length, invalidRowCount, mode },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('CSV import failed', { userId: req.user.id, error: error.message });
      res.status(500).json({ error: 'Failed to import portfolio', code: 'IMPORT_ERROR' });
    }
  }
);

export default router;
