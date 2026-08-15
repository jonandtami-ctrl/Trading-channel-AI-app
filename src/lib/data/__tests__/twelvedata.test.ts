import { describe, expect, it } from 'vitest';
import { parseSeries, toTwelveDataSymbol } from '../twelvedata';

describe('toTwelveDataSymbol', () => {
  it('leaves a plain US stock symbol untouched', () => {
    expect(toTwelveDataSymbol({ symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', exchange: 'S&P 500' })).toBe(
      'AAPL'
    );
  });

  it('converts a .TO TSX symbol to the colon-exchange format', () => {
    expect(toTwelveDataSymbol({ symbol: 'RY.TO', name: 'Royal Bank of Canada', kind: 'stock', exchange: 'TSX' })).toBe(
      'RY:TSX'
    );
  });
});

describe('parseSeries', () => {
  it('parses daily datetimes (no time component) as UTC midnight', () => {
    const [candle] = parseSeries([
      { datetime: '2024-01-15', open: '10', high: '12', low: '9', close: '11' },
    ]);
    expect(candle.time).toBe(Date.UTC(2024, 0, 15) / 1000);
    expect(candle).toMatchObject({ open: 10, high: 12, low: 9, close: 11 });
  });

  it('parses intraday datetimes as UTC (Twelve Data is called with timezone=UTC)', () => {
    const [candle] = parseSeries([
      { datetime: '2024-01-15 09:30:00', open: '10', high: '12', low: '9', close: '11' },
    ]);
    expect(candle.time).toBe(Date.UTC(2024, 0, 15, 9, 30, 0) / 1000);
  });

  it('parses numeric string fields, including optional volume', () => {
    const [candle] = parseSeries([
      { datetime: '2024-01-15', open: '10.5', high: '12.25', low: '9.75', close: '11.1', volume: '123456' },
    ]);
    expect(candle).toMatchObject({ open: 10.5, high: 12.25, low: 9.75, close: 11.1, volume: 123456 });
  });

  it('leaves volume undefined when absent', () => {
    const [candle] = parseSeries([{ datetime: '2024-01-15', open: '10', high: '12', low: '9', close: '11' }]);
    expect(candle.volume).toBeUndefined();
  });

  it('sorts into ascending (oldest-first) order regardless of input order', () => {
    const candles = parseSeries([
      { datetime: '2024-01-17', open: '1', high: '1', low: '1', close: '1' },
      { datetime: '2024-01-15', open: '1', high: '1', low: '1', close: '1' },
      { datetime: '2024-01-16', open: '1', high: '1', low: '1', close: '1' },
    ]);
    expect(candles.map((c) => c.time)).toEqual([...candles.map((c) => c.time)].sort((a, b) => a - b));
    expect(candles[0].time).toBe(Date.UTC(2024, 0, 15) / 1000);
    expect(candles[2].time).toBe(Date.UTC(2024, 0, 17) / 1000);
  });
});
