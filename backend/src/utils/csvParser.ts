import { isValidTicker } from './validator';

export type Exchange = 'NASDAQ' | 'NYSE' | 'NSE' | 'BSE' | 'CRYPTO';

const VALID_EXCHANGES = new Set<Exchange>(['NASDAQ', 'NYSE', 'NSE', 'BSE', 'CRYPTO']);

export interface ParsedHolding {
  ticker: string;
  exchange: Exchange;
  quantity: number;
  avgBuyPrice: number;
}

export function parseExchange(raw: string): Exchange {
  const upper = raw.trim().toUpperCase();
  if (VALID_EXCHANGES.has(upper as Exchange)) return upper as Exchange;
  if (upper === 'XNAS' || upper === 'NQ') return 'NASDAQ';
  if (upper === 'XNYS' || upper === 'NY') return 'NYSE';
  if (upper === 'XNSE') return 'NSE';
  if (upper === 'XBOM') return 'BSE';
  if (['BTC', 'ETH', 'COIN', 'CRYPTO'].some((s) => upper.includes(s))) return 'CRYPTO';
  return 'NASDAQ'; // sensible default for US stocks
}

export function parseRow(row: Record<string, string>): ParsedHolding | null {
  // Normalize keys: lowercase, strip spaces/underscores/dashes
  const normalized: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    normalized[k.toLowerCase().replace(/[\s_-]+/g, '')] = v?.trim() ?? '';
  }

  const ticker = (
    normalized['ticker'] ??
    normalized['symbol'] ??
    normalized['stock'] ??
    normalized['scrip'] ??
    ''
  ).toUpperCase().replace(/[^A-Z0-9.^-]/g, '');

  if (!ticker || !isValidTicker(ticker)) return null;

  const qtyRaw =
    normalized['quantity'] ??
    normalized['qty'] ??
    normalized['shares'] ??
    normalized['units'] ??
    '';
  const quantity = parseFloat(qtyRaw.replace(/,/g, ''));
  if (!quantity || quantity <= 0) return null;

  const priceRaw =
    normalized['avgbuyprice'] ??
    normalized['avgprice'] ??
    normalized['buyprice'] ??
    normalized['averageprice'] ??
    normalized['costpershare'] ??
    normalized['purchaseprice'] ??
    normalized['averagebuyprice'] ??
    '';
  const avgBuyPrice = parseFloat(priceRaw.replace(/[,$]/g, ''));
  if (!avgBuyPrice || avgBuyPrice <= 0) return null;

  const exchangeRaw =
    normalized['exchange'] ??
    normalized['market'] ??
    normalized['exch'] ??
    'NASDAQ';
  const exchange = parseExchange(exchangeRaw);

  return { ticker, exchange, quantity, avgBuyPrice };
}

export function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const rows: Record<string, string>[] = [];

  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const values: string[] = [];
    let cur = '';
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"' || ch === "'") { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { values.push(cur); cur = ''; continue; }
      cur += ch;
    }
    values.push(cur);

    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = values[i]?.trim() ?? ''; });
    rows.push(row);
  }

  return rows;
}

// Parse and validate a CSV body in one step. Returns the parsed holdings and
// the count of rows that failed validation (for user feedback / preview).
export function parsePortfolioCSV(csvText: string): {
  holdings: ParsedHolding[];
  invalidRowCount: number;
} {
  const rawRows = parseCSV(csvText);
  let invalidRowCount = 0;
  const holdings: ParsedHolding[] = [];
  for (const row of rawRows) {
    const parsed = parseRow(row);
    if (parsed) holdings.push(parsed);
    else invalidRowCount++;
  }
  return { holdings, invalidRowCount };
}
