import { describe, expect, it } from 'vitest';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS, findSymbol } from '../data/symbols';

describe('symbol data', () => {
  it('has a broad S&P 500 + TSX stock universe, no ETFs or leveraged products', () => {
    expect(STOCK_SYMBOLS.length).toBeGreaterThan(300);
    expect(STOCK_SYMBOLS.length).toBeLessThan(450);
    expect(STOCK_SYMBOLS.every((s) => s.kind === 'stock')).toBe(true);
    expect(STOCK_SYMBOLS.every((s) => s.exchange === 'S&P 500' || s.exchange === 'TSX')).toBe(true);
    expect(STOCK_SYMBOLS.some((s) => s.exchange === 'TSX')).toBe(true);
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

  it('finds a known crypto, S&P 500, and TSX symbol case-insensitively', () => {
    expect(findSymbol('BTC')?.name).toBe('Bitcoin');
    expect(findSymbol('aapl')?.name).toBe('Apple Inc.');
    expect(findSymbol('aapl')?.exchange).toBe('S&P 500');
    expect(findSymbol('ry.to')?.exchange).toBe('TSX');
    expect(findSymbol('ry.to')?.name).toContain('Royal Bank');
    expect(CRYPTO_SYMBOLS.length).toBe(50);
  });
});
