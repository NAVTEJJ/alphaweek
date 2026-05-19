import Groq from 'groq-sdk';
import { withRetry } from '../utils/retryHelper';
import { logger } from '../utils/logger';
import { MarketSnapshot, GeoEvent, PortfolioAnalysis } from '../types';
import { SentimentSummary } from './sentimentService';
import { buildElitePrompt, buildEliteSystemPrompt } from '../prompts/elitePrompt';
import { buildDailyPrompt, buildDailySystemPrompt } from '../prompts/dailyPrompt';
import { buildPreviewPrompt, buildPreviewSystemPrompt } from '../prompts/previewPrompt';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// One model for everyone — 70B params, 128K context. The 8B-instant model was
// being used for daily briefs but its hallucination rate makes it unsafe for
// financial content. Temperature kept low (0.35) to favour factual recall over
// creative phrasing.
const MODEL = 'llama-3.3-70b-versatile';
const TEMPERATURE = 0.35;

export interface PriorResearchOutcome {
  ticker: string;
  thesis: string;
  weeklyChangePercent: number | null; // null = price data unavailable
}

interface BriefGenerationInput {
  weekOf: string;
  market: MarketSnapshot;
  geoEvents: GeoEvent[];
  portfolio: PortfolioAnalysis;
  sentiment?: SentimentSummary;
  priorResearch?: PriorResearchOutcome[];
}

interface BriefGenerationResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function generateBrief(input: BriefGenerationInput): Promise<BriefGenerationResult> {
  const { weekOf, market, geoEvents, portfolio, sentiment, priorResearch } = input;
  // Everyone gets the Elite brief: full market + portfolio + sentiment synthesis.
  const system = buildEliteSystemPrompt();
  const user = buildElitePrompt(market, geoEvents, portfolio, sentiment ?? null, weekOf, priorResearch);

  logger.info('Generating brief with AI', { model: MODEL, weekOf });

  const result = await withRetry(
    async () => {
      const response = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq API');

      return {
        content,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: response.model,
      };
    },
    'generateBrief',
    { maxAttempts: 3, delayMs: 5000, backoffMultiplier: 2 }
  );

  logger.info('Brief generated successfully', {
    model: MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    contentLength: result.content.length,
  });

  return result;
}

export async function generateDailyBrief(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  portfolio: PortfolioAnalysis,
  date: string
): Promise<BriefGenerationResult> {
  const system = buildDailySystemPrompt();
  const user = buildDailyPrompt(market, geoEvents, portfolio, date);

  logger.info('Generating daily brief', { date });

  const result = await withRetry(
    async () => {
      const response = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 1024,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq API');

      return {
        content,
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: response.model,
      };
    },
    'generateDailyBrief',
    { maxAttempts: 3, delayMs: 5000, backoffMultiplier: 2 }
  );

  logger.info('Daily brief generated', {
    date,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result;
}

export async function generatePreviewBrief(
  market: MarketSnapshot,
  geoEvents: GeoEvent[],
  portfolio: PortfolioAnalysis,
  date: string
): Promise<BriefGenerationResult> {
  const system = buildPreviewSystemPrompt();
  const user   = buildPreviewPrompt(market, geoEvents, portfolio, date);

  const result = await withRetry(
    async () => {
      const response = await groq.chat.completions.create({
        model: MODEL,
        max_tokens: 700,
        temperature: TEMPERATURE,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user },
        ],
      });
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');
      return {
        content,
        inputTokens:  response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        model: response.model,
      };
    },
    'generatePreviewBrief',
    { maxAttempts: 2, delayMs: 3000 }
  );

  logger.info('Preview brief generated', { date });
  return result;
}
