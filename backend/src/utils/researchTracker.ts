import { redis } from '../../config/redis';

// Stores the 3 research idea tickers from a completed brief so the following
// week's generation can explicitly score them. TTL is 10 days (Mon→Mon + buffer).
const TTL = 10 * 24 * 3600;

export interface ResearchIdea {
  ticker: string;
  thesis: string; // one-sentence thesis extracted from the brief
}

export interface ResearchRecord {
  briefId: string;
  weekOf: string;
  ideas: ResearchIdea[];
}

function key(userId: string) {
  return `research:prior:${userId}`;
}

export async function savePriorResearch(userId: string, record: ResearchRecord): Promise<void> {
  await redis.set(key(userId), JSON.stringify(record), 'EX', TTL);
}

export async function loadPriorResearch(userId: string): Promise<ResearchRecord | null> {
  const raw = await redis.get(key(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ResearchRecord;
  } catch {
    return null;
  }
}

// Extracts up to 3 research idea tickers from brief markdown.
// Looks for the "3 High-Conviction Research Ideas" section pattern:
// **Ticker: XXXX** — ...
export function extractResearchIdeas(content: string): ResearchIdea[] {
  const ideas: ResearchIdea[] = [];
  const pattern = /\*\*Ticker:\s*([A-Z\-]{1,10})\*\*[^*\n]*—[^\n]*\n\*\*Thesis:\*\*\s*([^\n]+)/g;
  let match;
  while ((match = pattern.exec(content)) !== null && ideas.length < 3) {
    ideas.push({ ticker: match[1].trim(), thesis: match[2].trim().slice(0, 120) });
  }
  return ideas;
}
