import Groq from 'groq-sdk';
import { cacheGet, cacheSet } from '../../config/redis';
import { withRetry } from '../utils/retryHelper';
import { logger } from '../utils/logger';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

// What changed between this week's brief and the prior week's. The LLM does
// the semantic diff so the user gets "the AI's view on tech rotated from
// constructive to cautious" rather than a raw markdown diff. Output is strict
// JSON so the frontend can render structured panels.

export interface BriefDiff {
  // 3–5 short sentences on the most important changes.
  topChanges: string[];
  // Tickers featured this week that weren't featured last week.
  newTickersHighlighted: string[];
  // Tickers featured last week that disappeared this week.
  removedTickersHighlighted: string[];
  // High-level macro/sentiment shift (e.g. "BULLISH → CAUTIOUS"). Empty if
  // unchanged.
  sentimentShift: string;
  // 1-sentence headline: "the AI's view has shifted X" or "view holds".
  summary: string;
  // True if the LLM couldn't compute a diff (used for graceful fallback in UI).
  empty: boolean;
}

// Returns the diff cached for an hour (briefs are immutable post-generation, so
// the only reason to invalidate is if a prior brief was edited — which we don't
// support). One LLM call per pair of briefs.
export async function diffBriefs(
  currentBriefId: string,
  currentContent: string,
  priorContent: string
): Promise<BriefDiff> {
  const cacheKey = `briefdiff:${currentBriefId}`;
  const cached = await cacheGet<BriefDiff>(cacheKey);
  if (cached) return cached;

  const system = `You compare two weekly investment briefs from the same author and produce a structured diff. Your goal: tell the reader, in plain English, how the AI's view has changed week-over-week.

Focus on:
- Macro stance: did the overall tone shift bullish → cautious, or vice versa?
- Sector calls: which sectors moved from "rotate in" to "rotate out" or got dropped entirely
- Specific tickers: which tickers were featured this week vs last week
- Geopolitical: which risks escalated, de-escalated, or appeared/disappeared
- Specific number deltas: if both briefs cite the same metric (e.g., S&P weekly return, fear & greed), call out the change

Return STRICT JSON only — no prose, no markdown fences. Schema:
{
  "topChanges": ["sentence", "sentence", "sentence"],  // 3-5 entries
  "newTickersHighlighted": ["AAPL", "NVDA"],
  "removedTickersHighlighted": ["TSLA"],
  "sentimentShift": "BULLISH → CAUTIOUS",   // or empty string if unchanged
  "summary": "One-sentence headline."
}

Rules:
- Tickers MUST be plain uppercase symbols (no $ prefix, no exchange suffix).
- If briefs are essentially the same, return summary: "View holds — no major shifts." and empty arrays.
- Never invent tickers or events not present in one of the briefs.
- topChanges entries should be specific, not "markets shifted slightly".`;

  const user = `THIS WEEK'S BRIEF:
${currentContent.slice(0, 6000)}

LAST WEEK'S BRIEF:
${priorContent.slice(0, 6000)}`;

  try {
    const raw = await withRetry(
      async () => {
        const response = await groq.chat.completions.create({
          model: MODEL,
          max_tokens: 600,
          temperature: 0.3,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
        const content = response.choices[0]?.message?.content;
        if (!content) throw new Error('Empty response from Groq');
        return content;
      },
      'diffBriefs',
      { maxAttempts: 2, delayMs: 1500 }
    );

    const parsed = JSON.parse(raw) as Partial<BriefDiff>;
    const diff: BriefDiff = {
      topChanges: Array.isArray(parsed.topChanges) ? parsed.topChanges.slice(0, 5).filter((s): s is string => typeof s === 'string') : [],
      newTickersHighlighted: Array.isArray(parsed.newTickersHighlighted)
        ? parsed.newTickersHighlighted.filter((s): s is string => typeof s === 'string').map((s) => s.toUpperCase()).slice(0, 10)
        : [],
      removedTickersHighlighted: Array.isArray(parsed.removedTickersHighlighted)
        ? parsed.removedTickersHighlighted.filter((s): s is string => typeof s === 'string').map((s) => s.toUpperCase()).slice(0, 10)
        : [],
      sentimentShift: typeof parsed.sentimentShift === 'string' ? parsed.sentimentShift : '',
      summary: typeof parsed.summary === 'string' ? parsed.summary : 'View holds — no major shifts.',
      empty: false,
    };

    await cacheSet(cacheKey, diff, 3600);
    return diff;
  } catch (err) {
    logger.warn('Brief diff via LLM failed', { error: String(err) });
    return {
      topChanges: [],
      newTickersHighlighted: [],
      removedTickersHighlighted: [],
      sentimentShift: '',
      summary: 'Diff unavailable.',
      empty: true,
    };
  }
}
