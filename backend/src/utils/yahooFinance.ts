// yahoo-finance2 is ESM-only and its shipped d.ts only types `quote` + `autoc`
// even though the runtime exposes far more (chart, quoteSummary, screener…).
// This wrapper uses dynamic import for CJS compatibility AND declares the
// methods we actually call so consumers stay typesafe.

type YFQuoteOptions = { fields?: string[] };

interface YFChartArgs {
  period1?: Date | string | number;
  period2?: Date | string | number;
  interval?: '1d' | '1wk' | '1mo' | '1m' | '5m' | '15m' | '30m' | '60m' | '90m' | '1h';
}

interface YFScreenerArgs {
  scrIds: string;
  count?: number;
  region?: string;
  lang?: string;
}

interface YFQuoteSummaryArgs {
  modules: string[];
}

interface YFRuntime {
  quote: (symbol: string | string[], options?: YFQuoteOptions) => Promise<unknown>;
  chart: (symbol: string, args: YFChartArgs) => Promise<unknown>;
  quoteSummary: (symbol: string, args: YFQuoteSummaryArgs) => Promise<unknown>;
  screener: (args: YFScreenerArgs, opts?: { validateResult?: boolean }) => Promise<unknown>;
}

let _yf: YFRuntime | null = null;

export async function getYF(): Promise<YFRuntime> {
  if (!_yf) {
    const mod = await import('yahoo-finance2');
    _yf = mod.default as unknown as YFRuntime;
  }
  return _yf;
}
