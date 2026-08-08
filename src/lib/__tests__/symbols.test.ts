import { describe, expect, it } from 'vitest';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS, findSymbol } from '../data/symbols';

describe('symbol data', () => {
  it('has a stock universe spanning S&P 500 + extra NASDAQ/NYSE + ETFs', () => {
    expect(STOCK_SYMBOLS.length).toBeGreaterThan(900);
    expect(STOCK_SYMBOLS.length).toBeLessThan(1000);
  });

  it('has no duplicate symbols across the combined universe', () => {
    const symbols = ALL_SYMBOLS.map((s) => s.symbol);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('every entry has a non-empty symbol and name', () => {
    for (const s of ALL_SYMBOLS) {
      expect(s.symbol.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(0);
    }
  });

  it('finds a known crypto and stock symbol case-insensitively', () => {
    expect(findSymbol('BTC')?.name).toBe('Bitcoin');
    expect(findSymbol('aapl')?.name).toBe('Apple Inc.');
    expect(CRYPTO_SYMBOLS.length).toBe(3);
  });
});
