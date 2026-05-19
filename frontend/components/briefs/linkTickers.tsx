'use client';

import React from 'react';
import Link from 'next/link';

// A small set of false-positive uppercase tokens we should never link. The
// brief is markdown so a token like "CRITICAL" appears inside [BRACKETS] —
// we still guard against linking common all-caps words just in case.
const STOP_WORDS = new Set([
  'A', 'I', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'HE', 'IF', 'IN',
  'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO', 'UP', 'US', 'WE',
  // Acronyms commonly in financial copy
  'ETF', 'IPO', 'EPS', 'GDP', 'CEO', 'CFO', 'CPI', 'PPI', 'SEC', 'FED', 'RBI',
  'USD', 'EUR', 'INR', 'JPY', 'GBP', 'YTD', 'YOY', 'AI', 'API', 'EV', 'PE',
  // AlphaWeek section labels
  'CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'BUY', 'SELL', 'HOLD', 'STRONG',
  'BULLISH', 'BEARISH', 'NEUTRAL', 'WATCH', 'REVIEW',
  // Country / index names that look like tickers
  'US', 'UK', 'EU', 'UN', 'NATO', 'OPEC', 'BRICS',
  'NASDAQ', 'NYSE', 'NSE', 'BSE', 'NIFTY', 'SENSEX', 'DOW',
  // Months
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
  'Q1', 'Q2', 'Q3', 'Q4',
]);

// Token shape: 2–6 uppercase alphanumerics, optionally with a trailing
// .NS/.BO suffix, or BTC-style `XYZ-USD`. Word-boundary-anchored.
const TICKER_TOKEN = /\b([A-Z]{2,6}(?:\.NS|\.BO)?|[A-Z]{2,6}-USD)\b/g;

export interface TickerLookup {
  // Map from bare token (e.g. "AAPL") → exchange to route the link to
  tickerToExchange: Map<string, string>;
}

// Builds the lookup table by collecting:
//   1. User's actual holdings (we know their exchanges)
//   2. User's watchlist (assume NASDAQ unless otherwise clear)
//   3. Tickers that appear 2+ times in the brief itself (good signal it's
//      actually a ticker, not a stray uppercase word)
export function buildTickerLookup(opts: {
  holdings?: { ticker: string; exchange: string }[];
  watchlist?: string[];
  briefContent?: string;
}): TickerLookup {
  const map = new Map<string, string>();

  for (const h of opts.holdings ?? []) {
    map.set(h.ticker.toUpperCase(), h.exchange.toUpperCase());
  }
  for (const t of opts.watchlist ?? []) {
    const upper = t.toUpperCase();
    if (!map.has(upper)) map.set(upper, 'NASDAQ');
  }

  // Auto-detect tickers from the brief itself: any 2-6 letter uppercase token
  // that appears at least twice AND isn't in STOP_WORDS is probably a real ticker.
  if (opts.briefContent) {
    const counts = new Map<string, number>();
    const matches = opts.briefContent.match(TICKER_TOKEN) ?? [];
    for (const m of matches) {
      const bare = m.replace(/\.NS$|\.BO$|-USD$/, '');
      if (STOP_WORDS.has(bare) || bare.length < 2) continue;
      counts.set(bare, (counts.get(bare) ?? 0) + 1);
    }
    for (const [token, count] of Array.from(counts.entries())) {
      if (count >= 2 && !map.has(token)) {
        // Guess exchange from suffix if present in the brief text
        if (opts.briefContent.includes(`${token}.NS`)) map.set(token, 'NSE');
        else if (opts.briefContent.includes(`${token}.BO`)) map.set(token, 'BSE');
        else if (opts.briefContent.includes(`${token}-USD`)) map.set(token, 'CRYPTO');
        else map.set(token, 'NASDAQ');
      }
    }
  }

  return { tickerToExchange: map };
}

// Renders a string with known ticker tokens replaced by clickable Links.
// Designed to be plugged into ReactMarkdown's `text` renderer so the inline
// rich-text formatting (bold, italic, etc.) keeps working around it.
export function linkifyTickers(text: string, lookup: TickerLookup): React.ReactNode {
  if (!text || lookup.tickerToExchange.size === 0) return text;

  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  // Reset regex state since it's a /g instance
  TICKER_TOKEN.lastIndex = 0;

  while ((m = TICKER_TOKEN.exec(text)) !== null) {
    const matched = m[0];
    const bare = matched.replace(/\.NS$|\.BO$|-USD$/, '');
    const exchange = lookup.tickerToExchange.get(bare);
    if (!exchange) continue;

    // Append the preceding plain text
    if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));

    parts.push(
      <Link
        key={`${m.index}-${matched}`}
        href={`/ticker/${encodeURIComponent(bare)}?exchange=${encodeURIComponent(exchange)}`}
        className="font-mono text-primary-light hover:text-accent transition-colors underline-offset-2 hover:underline"
      >
        {matched}
      </Link>
    );
    lastIdx = m.index + matched.length;
  }

  if (lastIdx === 0) return text; // no replacements
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return parts;
}
