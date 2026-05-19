import { logger } from './logger';

export interface SanityResult {
  passed: boolean;
  warnings: string[];
  flagged: boolean; // true when we append a user-visible note
}

// The 7 expected section headers in a weekly brief (lowercase for matching).
const REQUIRED_SECTIONS = [
  'the week in markets',
  'geopolitical risk radar',
  '5 stocks worth watching',
  'the week ahead',
  'your portfolio this week',
  'rebalancing signals',
  'sentiment vs. price',
];

// Sanity checks run before every brief is stored/delivered.
// We never silently drop a brief. If checks fail we flag it and still deliver —
// silence is always the worst outcome for the user.
export function checkBrief(content: string, briefType: 'weekly' | 'daily' = 'weekly'): SanityResult {
  const warnings: string[] = [];
  const lower = content.toLowerCase();

  if (briefType === 'weekly') {
    // Check all 7 sections present (partial match — headers may have slight wording variations)
    const missingSections = REQUIRED_SECTIONS.filter((s) => !lower.includes(s));
    if (missingSections.length > 0) {
      warnings.push(`Missing sections: ${missingSections.join(', ')}`);
    }

    // At least 3 ticker symbols (sequences of 2-5 uppercase letters)
    const tickerMatches = content.match(/\b[A-Z]{2,5}\b/g) ?? [];
    const uniqueTickers = new Set(tickerMatches.filter((t) => !['AND', 'THE', 'FOR', 'USD', 'INR', 'ETF', 'IPO', 'CEO', 'FED', 'IMF', 'GDP', 'CPI', 'QQQ', 'SPY'].includes(t)));
    if (uniqueTickers.size < 3) {
      warnings.push(`Only ${uniqueTickers.size} ticker-like symbols found — brief may be too generic`);
    }
  }

  // Word count: weekly 400–2500, daily 80–600
  const wordCount = content.trim().split(/\s+/).filter(Boolean).length;
  const [minWords, maxWords] = briefType === 'daily' ? [80, 600] : [400, 2500];
  if (wordCount < minWords) warnings.push(`Too short: ${wordCount} words (min ${minWords})`);
  if (wordCount > maxWords) warnings.push(`Too long: ${wordCount} words (max ${maxWords})`);

  // Percentage figures must be within -100% to +100% range
  const pctMatches = content.matchAll(/([-+]?\d+\.?\d*)\s*%/g);
  const wildPcts: string[] = [];
  for (const m of pctMatches) {
    const val = parseFloat(m[1]);
    if (Math.abs(val) > 100) wildPcts.push(m[0]);
  }
  if (wildPcts.length > 0) {
    warnings.push(`Suspicious percentage figures (>100%): ${wildPcts.slice(0, 3).join(', ')}`);
  }

  const passed = warnings.length === 0;
  const flagged = !passed;

  if (!passed) {
    logger.warn('Brief sanity check failed', { warnings, wordCount });
  }

  return { passed, warnings, flagged };
}

// Appended to the brief when sanity check flags it — user sees it, but brief
// is still delivered. Never silently drop a brief.
export const SANITY_FLAG_NOTE = '\n\n---\n\n*Note: This brief was automatically flagged during quality review. Some sections may be incomplete. Your feedback helps us improve.*';
