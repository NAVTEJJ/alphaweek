import { MarketSnapshot, PortfolioAnalysis } from '../types';
import { logger } from '../utils/logger';

// Tolerance for matching a quoted number to a source-data number. The AI often
// rounds (e.g., "+1.2%" in the brief for source "+1.234%"), so we accept any
// source value within ±0.15 absolute or ±5% relative — whichever is wider.
const ABS_TOL = 0.15;
const REL_TOL = 0.05;

function numberMatches(quoted: number, source: number): boolean {
  if (quoted === source) return true;
  if (Math.abs(quoted - source) <= ABS_TOL) return true;
  if (source !== 0 && Math.abs((quoted - source) / source) <= REL_TOL) return true;
  return false;
}

// Extract every numeric figure mentioned in the brief — percentages, dollar
// amounts, raw index points — for cross-checking. Returns [{value, label}].
function extractFigures(content: string): { value: number; raw: string; line: string }[] {
  const figures: { value: number; raw: string; line: string }[] = [];
  const lines = content.split(/\r?\n/);

  // Match numbers like: +1.23%, -0.5%, $1,234.56, 5,432, 6,200 pts
  const pattern = /([+-]?\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?%?)/g;

  for (const line of lines) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(line)) !== null) {
      const raw = m[1];
      // Drop pure two-digit numbers — too many false positives (years, list nums).
      // Keep percentages, currency-prefixed, or large numbers.
      const hasContext = raw.includes('%') || raw.includes('$') || raw.includes(',') || raw.includes('.');
      if (!hasContext) continue;
      const cleaned = raw.replace(/[$,]/g, '').replace(/%$/, '');
      const value = parseFloat(cleaned);
      if (!Number.isFinite(value)) continue;
      figures.push({ value, raw, line });
    }
  }
  return figures;
}

// Build the set of "source-of-truth" numbers the AI was given. We allow any
// figure that's within tolerance of one of these. Tolerance is wide enough to
// cover rounding ("4.2%" vs "4.17%") but narrow enough to catch fabrication.
function buildSourceValues(market: MarketSnapshot, portfolio: PortfolioAnalysis): number[] {
  const values: number[] = [];

  // Indices: value, change %
  const m = market;
  if (m.us?.sp500) values.push(m.us.sp500.value, m.us.sp500.changePercent);
  if (m.us?.nasdaq) values.push(m.us.nasdaq.value, m.us.nasdaq.changePercent);
  if (m.us?.dowJones) values.push(m.us.dowJones.value, m.us.dowJones.changePercent);
  if (m.india?.nifty50) values.push(m.india.nifty50.value, m.india.nifty50.changePercent);
  if (m.india?.sensex) values.push(m.india.sensex.value, m.india.sensex.changePercent);
  if (m.crypto?.bitcoin) values.push(m.crypto.bitcoin.price, m.crypto.bitcoin.change7dPercent);
  if (m.crypto?.ethereum) values.push(m.crypto.ethereum.price, m.crypto.ethereum.change7dPercent);
  if (m.global) {
    values.push(m.global.gold, m.global.brentCrude, m.global.usdInr, m.global.eurUsd);
  }
  if (m.us?.fearGreedIndex !== null && m.us?.fearGreedIndex !== undefined) values.push(m.us.fearGreedIndex);
  if (m.crypto?.fearGreedIndex !== undefined) values.push(m.crypto.fearGreedIndex);

  // Top movers per region
  const movers = [
    ...(m.us?.topGainers ?? []), ...(m.us?.topLosers ?? []),
    ...(m.india?.topGainers ?? []), ...(m.india?.topLosers ?? []),
  ];
  for (const mover of movers) {
    values.push(mover.changePercent, mover.price);
  }

  // Portfolio numbers
  if (portfolio) {
    values.push(portfolio.totalValue, portfolio.totalPnLPercent, portfolio.weeklyChangePercent, portfolio.benchmarkReturn);
    for (const h of portfolio.holdings) {
      values.push(h.pnLPercent, h.weeklyChangePercent, h.currentPrice);
    }
  }

  return values.filter((v) => typeof v === 'number' && Number.isFinite(v));
}

export interface FactCheckReport {
  totalFigures: number;
  suspicious: { raw: string; value: number; line: string }[];
  passRate: number; // 0..1
}

// Cross-checks every numeric figure in the brief against the source data the
// AI was given. A "suspicious" figure is one we can't find within tolerance of
// any source value — likely a hallucination. We don't throw; we report. The
// orchestrator decides whether to ship, regenerate, or flag.
export function factCheckBrief(
  content: string,
  market: MarketSnapshot,
  portfolio: PortfolioAnalysis
): FactCheckReport {
  const figures = extractFigures(content);
  const sources = buildSourceValues(market, portfolio);

  const suspicious: FactCheckReport['suspicious'] = [];
  for (const fig of figures) {
    const matched = sources.some((s) => numberMatches(fig.value, s));
    if (!matched) suspicious.push({ raw: fig.raw, value: fig.value, line: fig.line.slice(0, 120) });
  }

  const passRate = figures.length === 0 ? 1 : 1 - suspicious.length / figures.length;
  return { totalFigures: figures.length, suspicious, passRate };
}

export function logFactCheck(briefId: string, report: FactCheckReport): void {
  const sample = report.suspicious.slice(0, 5);
  if (report.suspicious.length > 0) {
    logger.warn('Brief fact-check: unverified figures detected', {
      briefId,
      total: report.totalFigures,
      suspiciousCount: report.suspicious.length,
      passRate: report.passRate.toFixed(2),
      sample,
    });
  } else {
    logger.info('Brief fact-check: all figures verified', {
      briefId,
      total: report.totalFigures,
    });
  }
}
