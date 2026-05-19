import { parseCSV, parseRow, parseExchange, parsePortfolioCSV } from '../src/utils/csvParser';

describe('parseExchange', () => {
  it('passes through valid exchanges', () => {
    expect(parseExchange('NASDAQ')).toBe('NASDAQ');
    expect(parseExchange('NYSE')).toBe('NYSE');
    expect(parseExchange('NSE')).toBe('NSE');
    expect(parseExchange('BSE')).toBe('BSE');
    expect(parseExchange('CRYPTO')).toBe('CRYPTO');
  });

  it('normalizes broker-specific labels', () => {
    expect(parseExchange('xnas')).toBe('NASDAQ');
    expect(parseExchange('XNYS')).toBe('NYSE');
    expect(parseExchange('XBOM')).toBe('BSE');
    expect(parseExchange('XNSE')).toBe('NSE');
  });

  it('detects crypto from substring hints', () => {
    expect(parseExchange('BTC-USD')).toBe('CRYPTO');
    expect(parseExchange('Coinbase')).toBe('CRYPTO');
  });

  it('falls back to NASDAQ for unknown labels', () => {
    expect(parseExchange('UNKNOWN')).toBe('NASDAQ');
    expect(parseExchange('')).toBe('NASDAQ');
  });
});

describe('parseCSV', () => {
  it('parses a basic CSV with header', () => {
    const csv = 'ticker,quantity,avgBuyPrice\nAAPL,10,150.00\nTSLA,5,200.00';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ ticker: 'AAPL', quantity: '10', avgBuyPrice: '150.00' });
  });

  it('handles CRLF line endings', () => {
    const csv = 'ticker,quantity,avgBuyPrice\r\nAAPL,10,150.00';
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(1);
  });

  it('returns empty array for empty or header-only CSVs', () => {
    expect(parseCSV('')).toEqual([]);
    expect(parseCSV('ticker,quantity,avgBuyPrice')).toEqual([]);
  });

  it('strips surrounding quotes from header columns', () => {
    const csv = '"ticker","quantity","avgBuyPrice"\nAAPL,10,150';
    const rows = parseCSV(csv);
    expect(Object.keys(rows[0])).toEqual(['ticker', 'quantity', 'avgBuyPrice']);
  });

  it('skips blank lines in the middle of input', () => {
    const csv = 'ticker,quantity,avgBuyPrice\nAAPL,10,150\n\nTSLA,5,200';
    expect(parseCSV(csv)).toHaveLength(2);
  });
});

describe('parseRow', () => {
  it('parses a clean row with canonical column names', () => {
    const result = parseRow({ ticker: 'AAPL', quantity: '10', avgBuyPrice: '150' });
    expect(result).toEqual({
      ticker: 'AAPL', exchange: 'NASDAQ', quantity: 10, avgBuyPrice: 150,
    });
  });

  it('accepts broker-export column synonyms', () => {
    // Robinhood-ish export
    const result = parseRow({ Symbol: 'TSLA', Shares: '5', 'Average Cost': '200' });
    // 'Average Cost' is not in the alias list; let's use one that IS
    expect(result).toBeNull();

    const ok = parseRow({ Symbol: 'TSLA', Shares: '5', 'Avg Price': '200' });
    expect(ok).toEqual({ ticker: 'TSLA', exchange: 'NASDAQ', quantity: 5, avgBuyPrice: 200 });
  });

  it('strips thousands separators and currency symbols from numbers', () => {
    const result = parseRow({ ticker: 'AAPL', quantity: '1,000', avgBuyPrice: '$1,500.50' });
    expect(result?.quantity).toBe(1000);
    expect(result?.avgBuyPrice).toBe(1500.5);
  });

  it('rejects rows with invalid ticker', () => {
    expect(parseRow({ ticker: '', quantity: '10', avgBuyPrice: '150' })).toBeNull();
    expect(parseRow({ ticker: 'TOOLONGTICKER', quantity: '10', avgBuyPrice: '150' })).toBeNull();
  });

  it('rejects rows with non-positive quantity or price', () => {
    expect(parseRow({ ticker: 'AAPL', quantity: '0', avgBuyPrice: '150' })).toBeNull();
    expect(parseRow({ ticker: 'AAPL', quantity: '10', avgBuyPrice: '-5' })).toBeNull();
    expect(parseRow({ ticker: 'AAPL', quantity: '', avgBuyPrice: '150' })).toBeNull();
  });

  it('honors the exchange column when present', () => {
    const result = parseRow({ ticker: 'RELIANCE', quantity: '10', avgBuyPrice: '2500', exchange: 'NSE' });
    expect(result?.exchange).toBe('NSE');
  });
});

describe('parsePortfolioCSV', () => {
  it('returns valid holdings and counts invalid rows', () => {
    const csv = [
      'ticker,quantity,avgBuyPrice',
      'AAPL,10,150',
      ',5,200',           // invalid: empty ticker
      'TSLA,5,200',
      'GOOG,abc,xyz',     // invalid: garbage numbers
    ].join('\n');
    const { holdings, invalidRowCount } = parsePortfolioCSV(csv);
    expect(holdings.map((h) => h.ticker)).toEqual(['AAPL', 'TSLA']);
    expect(invalidRowCount).toBe(2);
  });

  it('returns empty result for a completely invalid CSV', () => {
    const { holdings, invalidRowCount } = parsePortfolioCSV('foo,bar\nbaz,qux');
    expect(holdings).toEqual([]);
    expect(invalidRowCount).toBe(1);
  });
});
