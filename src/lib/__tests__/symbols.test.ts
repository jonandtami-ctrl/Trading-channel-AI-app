import { describe, expect, it } from 'vitest';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS, findSymbol } from '../data/symbols';

describe('symbol data', () => {
  it('has a curated stock universe — blue-chip S&P 500 + TSX (CAD) + US leveraged ETFs — not all 500 equities', () => {
    expect(STOCK_SYMBOLS.length).toBeGreaterThan(100);
    expect(STOCK_SYMBOLS.length).toBeLessThan(130);
    expect(STOCK_SYMBOLS.every((s) => s.kind === 'stock')).toBe(true);
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

  it('finds a known crypto, blue-chip stock, and ETF symbol case-insensitively', () => {
    expect(findSymbol('BTC')?.name).toBe('Bitcoin');
    expect(findSymbol('aapl')?.name).toBe('Apple Inc.');
    expect(findSymbol('aapl')?.exchange).toBe('Blue Chip');
    expect(findSymbol('tqqq')?.name).toContain('Nasdaq-100');
    expect(findSymbol('qqu.to')?.exchange).toBe('TSX');
    expect(CRYPTO_SYMBOLS.length).toBe(50);
  });
});
