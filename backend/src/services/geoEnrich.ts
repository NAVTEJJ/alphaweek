import Groq from 'groq-sdk';
import { GeoEvent } from '../types';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retryHelper';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'llama-3.3-70b-versatile';

// Asks the LLM to write a one-sentence market implication for each event in
// ONE batched call (cheaper + faster than per-event). Output is strict JSON
// keyed by index so we can stitch back deterministically.
//
// Falls back to a generic implication if the LLM is unavailable — better than
// the empty string the prompt template was rendering before.
export async function enrichGeoEventsWithImplications(events: GeoEvent[]): Promise<GeoEvent[]> {
  if (events.length === 0) return events;

  const numbered = events
    .map((e, i) => `${i}. [${e.impactScore} / ${e.category}] ${e.title}\n   ${e.summary}`)
    .join('\n\n');

  const system = `You are a buy-side macro analyst. For each numbered event, write ONE specific sentence on the market implication: which assets / sectors / regions are affected and which direction. Be concrete — name the mechanism (rate path, FX, sector rotation, supply chain). No hedging, no "could potentially", no generic warnings.

Return STRICT JSON only — no prose, no markdown fences. Shape: {"implications":[{"i":0,"text":"..."},{"i":1,"text":"..."}]}.`;

  const user = `Events:\n\n${numbered}`;

  try {
    const result = await withRetry(
      async () => {
        const response = await groq.chat.completions.create({
          model: MODEL,
          max_tokens: 600,
          temperature: 0.3,
          // Forcing JSON cuts hallucination on the structure.
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
      'enrichGeoEvents',
      { maxAttempts: 2, delayMs: 1500 }
    );

    const parsed = JSON.parse(result) as { implications?: { i: number; text: string }[] };
    const byIndex = new Map<number, string>();
    for (const item of parsed.implications ?? []) {
      if (typeof item.i === 'number' && typeof item.text === 'string') {
        byIndex.set(item.i, item.text.trim());
      }
    }

    return events.map((e, i) => ({
      ...e,
      marketImplication: byIndex.get(i) || fallbackImplication(e),
    }));
  } catch (err) {
    logger.warn('Geo enrichment via LLM failed — using fallbacks', { error: String(err) });
    return events.map((e) => ({ ...e, marketImplication: fallbackImplication(e) }));
  }
}

// Generic-but-specific-enough copy so the brief prompt never renders an empty
// "Implication:" line. Category-aware to feel less templated.
function fallbackImplication(event: GeoEvent): string {
  switch (event.category) {
    case 'MONETARY_POLICY':
      return 'Watch for shifts in rate expectations and dollar strength; rate-sensitive sectors (real estate, utilities, growth tech) most exposed.';
    case 'TRADE':
      return 'Cross-border trade flows and currency volatility likely; export-heavy sectors and EM equities at risk.';
    case 'CONFLICT':
      return 'Risk-off bias likely: oil, gold and defensive equities benefit; regional equity indices and EM FX under pressure.';
    case 'ENERGY':
      return 'Energy and materials sectors directly exposed; second-order effects on inflation expectations and transportation costs.';
    case 'TECH_REGULATION':
      return 'Tech sector multiples at risk; watch for impact on large-cap megacaps and any sector rotation out of growth.';
    default:
      return 'Monitor for cross-asset spillovers — track equity volatility and safe-haven flows over the next session.';
  }
}
