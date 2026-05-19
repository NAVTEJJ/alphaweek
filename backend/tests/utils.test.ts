import { sanitizeString, isValidTicker, isValidEmail } from '../src/utils/validator';
import { getCurrentWeekOf } from '../src/services/briefService';

describe('isValidTicker', () => {
  it('accepts standard US tickers', () => {
    expect(isValidTicker('AAPL')).toBe(true);
    expect(isValidTicker('TSLA')).toBe(true);
    expect(isValidTicker('GOOGL')).toBe(true);
    expect(isValidTicker('BTC')).toBe(true);
  });

  it('accepts Indian NSE tickers', () => {
    expect(isValidTicker('RELIANCE.NS')).toBe(true);
    expect(isValidTicker('TCS.NS')).toBe(true);
  });

  it('accepts Indian BSE tickers', () => {
    expect(isValidTicker('INFY.BO')).toBe(true);
  });

  it('rejects invalid tickers', () => {
    expect(isValidTicker('aapl')).toBe(false);       // lowercase
    expect(isValidTicker('TOOLONGTICKER')).toBe(false); // >10 chars
    expect(isValidTicker('A.B')).toBe(false);         // invalid suffix
    expect(isValidTicker('')).toBe(false);             // empty
    expect(isValidTicker('123')).toBe(false);          // numbers only
    expect(isValidTicker('A B')).toBe(false);          // spaces
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('u+tag@sub.domain.io')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('missing@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});

describe('sanitizeString', () => {
  it('removes HTML tags', () => {
    expect(sanitizeString('<script>alert(1)</script>hello')).toBe('hello');
    expect(sanitizeString('<b>bold</b>')).toBe('bold');
  });

  it('trims whitespace', () => {
    expect(sanitizeString('  hello world  ')).toBe('hello world');
  });

  it('passes clean strings through unchanged', () => {
    expect(sanitizeString('John Doe')).toBe('John Doe');
  });
});

describe('getCurrentWeekOf', () => {
  it('returns a Monday in YYYY-MM-DD format', () => {
    const weekOf = getCurrentWeekOf();
    expect(weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const date = new Date(weekOf);
    expect(date.getUTCDay()).toBe(1); // Monday
  });

  it('is idempotent — calling twice returns same value', () => {
    expect(getCurrentWeekOf()).toBe(getCurrentWeekOf());
  });
});
