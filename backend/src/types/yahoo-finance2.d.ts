declare module 'yahoo-finance2' {
  interface YahooFinance {
    quote(symbol: string, options?: unknown): Promise<unknown>;
    quoteSummary(symbol: string, options?: unknown): Promise<unknown>;
    screener(options: unknown, queryOptions?: unknown): Promise<unknown>;
    search(query: string, queryOptions?: unknown): Promise<unknown>;
    historical(symbol: string, options?: unknown): Promise<unknown[]>;
  }
  const yahooFinance: YahooFinance;
  export default yahooFinance;
}
