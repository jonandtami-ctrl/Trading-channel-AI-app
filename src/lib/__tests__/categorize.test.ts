import { describe, expect, it } from 'vitest';
import { resultsForCategory } from '../categorize';
import type { Candle, ScanResult } from '../types';

const candle: Candle = { time: 0, open: 1, high: 1, low: 1, close: 1 };

function makeResult(symbol: string, overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    symbol,
    candles: [candle],
    channels: [],
    levels: [],
    alerts: [],
    isLive: true,
    ...overrides,
  };
}

describe('resultsForCategory — notable filtering', () => {
  it('excludes an S&P 500 constituent marked not-notable from the stocks category', () => {
    // AVGO (Broadcom) is a real S&P 500 member marked notable: false in sp500.ts.
    const obscure = makeResult('AVGO');
    const famous = makeResult('AAPL');

    const results = resultsForCategory('stocks', [], [obscure, famous]);
    expect(results.map((r) => r.symbol)).toEqual(['AAPL']);
  });

  it('never excludes a symbol from crypto results (no notable flag applies there)', () => {
    const btc = makeResult('BTC');
    expect(resultsForCategory('crypto', [btc], [])).toEqual([btc]);
  });

  it('also excludes a not-notable symbol from the stable-ranges category even with a real stability range', () => {
    const stableButObscure = makeResult('AVGO', { stability: { support: 1, resistance: 2, widthPct: 100 } as any });
    expect(resultsForCategory('stable', [], [stableButObscure])).toEqual([]);
  });
});
