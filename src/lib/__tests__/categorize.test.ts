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

describe('resultsForCategory', () => {
  it('includes every scanned S&P 500 constituent in the stocks category, not just recognizable names', () => {
    // AMAT (Applied Materials) is a real but less well-known S&P 500 member — it should still show up as a buy/sell/watch candidate.
    const obscure = makeResult('AMAT');
    const famous = makeResult('AAPL');

    const results = resultsForCategory('stocks', [], [obscure, famous]);
    expect(results.map((r) => r.symbol)).toEqual(['AMAT', 'AAPL']);
  });

  it('never excludes a symbol from crypto results', () => {
    const btc = makeResult('BTC');
    expect(resultsForCategory('crypto', [btc], [])).toEqual([btc]);
  });

  it('includes a lesser-known symbol in the stable-ranges category when it has a real stability range', () => {
    const stableObscure = makeResult('AMAT', { stability: { support: 1, resistance: 2, widthPct: 100 } as any });
    expect(resultsForCategory('stable', [], [stableObscure])).toEqual([stableObscure]);
  });

  it('splits TSX symbols from the rest by exchange', () => {
    const shop = makeResult('SHOP.TO');
    const aapl = makeResult('AAPL');
    expect(resultsForCategory('tsx', [], [shop, aapl]).map((r) => r.symbol)).toEqual(['SHOP.TO']);
    expect(resultsForCategory('stocks', [], [shop, aapl]).map((r) => r.symbol)).toEqual(['AAPL']);
  });
});
