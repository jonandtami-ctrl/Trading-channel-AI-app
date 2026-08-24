import { describe, expect, it } from 'vitest';
import { searchSymbols } from '../symbolSearch';
import type { SymbolInfo } from '../data/symbols';

const universe: SymbolInfo[] = [
  { symbol: 'SHOP.TO', name: 'Shopify Inc.', kind: 'stock', exchange: 'TSX' },
  { symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', exchange: 'S&P 500' },
  { symbol: 'AVGO', name: 'Broadcom Inc.', kind: 'stock', exchange: 'S&P 500', notable: false },
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' },
];

describe('searchSymbols', () => {
  it('matches a TSX symbol by its bare ticker, without the .TO suffix', () => {
    expect(searchSymbols('SHOP', universe).map((s) => s.symbol)).toEqual(['SHOP.TO']);
  });

  it('matches by company name too', () => {
    expect(searchSymbols('shopify', universe).map((s) => s.symbol)).toEqual(['SHOP.TO']);
  });

  it('is case-insensitive', () => {
    expect(searchSymbols('aapl', universe).map((s) => s.symbol)).toEqual(['AAPL']);
  });

  it('returns nothing for an empty or whitespace-only query', () => {
    expect(searchSymbols('', universe)).toEqual([]);
    expect(searchSymbols('   ', universe)).toEqual([]);
  });

  it('includes a symbol marked notable: false — search bypasses that filter entirely', () => {
    expect(searchSymbols('AVGO', universe).map((s) => s.symbol)).toEqual(['AVGO']);
  });

  it('ranks a ticker-prefix match ahead of a mid-name substring match', () => {
    const pool: SymbolInfo[] = [
      { symbol: 'XBTC', name: 'Some Fund Tracking BTC', kind: 'stock' },
      { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' },
    ];
    expect(searchSymbols('BTC', pool).map((s) => s.symbol)).toEqual(['BTC', 'XBTC']);
  });
});
