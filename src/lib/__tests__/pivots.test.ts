import { describe, expect, it } from 'vitest';
import { findPivots } from '../pivots';
import type { Candle } from '../types';

function candle(i: number, price: number): Candle {
  return { time: i, open: price, high: price + 0.5, low: price - 0.5, close: price };
}

describe('findPivots', () => {
  it('finds a swing high at the peak of a v-shaped-up sequence', () => {
    const prices = [10, 11, 12, 13, 14, 15, 14, 13, 12, 11, 10];
    const candles = prices.map((p, i) => candle(i, p));
    const pivots = findPivots(candles, 3);
    const highs = pivots.filter((p) => p.type === 'high');
    expect(highs).toHaveLength(1);
    expect(highs[0].index).toBe(5);
  });

  it('finds a swing low at the trough of a dip', () => {
    const prices = [15, 14, 13, 12, 11, 10, 11, 12, 13, 14, 15];
    const candles = prices.map((p, i) => candle(i, p));
    const pivots = findPivots(candles, 3);
    const lows = pivots.filter((p) => p.type === 'low');
    expect(lows).toHaveLength(1);
    expect(lows[0].index).toBe(5);
  });

  it('finds nothing in a strictly monotonic series', () => {
    const prices = Array.from({ length: 20 }, (_, i) => 10 + i);
    const candles = prices.map((p, i) => candle(i, p));
    const pivots = findPivots(candles, 3);
    expect(pivots).toHaveLength(0);
  });
});
