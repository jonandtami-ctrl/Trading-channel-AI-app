import { describe, expect, it } from 'vitest';
import { calculateATR } from '../atr';
import type { Candle } from '../types';

function candle(high: number, low: number, close: number, open = close): Candle {
  return { time: 0, open, high, low, close };
}

describe('calculateATR', () => {
  it('converges to the constant true range once warmed up', () => {
    const candles: Candle[] = Array.from({ length: 20 }, () => candle(106, 104, 105));
    const atr = calculateATR(candles, 14);
    expect(atr[13]).toBeCloseTo(2, 5);
    expect(atr[19]).toBeCloseTo(2, 5);
  });

  it('returns NaN before the period has enough history', () => {
    const candles: Candle[] = Array.from({ length: 10 }, () => candle(106, 104, 105));
    const atr = calculateATR(candles, 14);
    expect(atr.every((v) => Number.isNaN(v))).toBe(true);
  });

  it('reacts to a wider true-range candle after warmup', () => {
    const candles: Candle[] = Array.from({ length: 14 }, () => candle(106, 104, 105));
    candles.push(candle(115, 100, 110)); // TR = 15, much wider than the prior 2
    const atr = calculateATR(candles, 14);
    expect(atr[14]).toBeGreaterThan(atr[13]);
  });

  it('returns an empty array for no candles', () => {
    expect(calculateATR([], 14)).toEqual([]);
  });
});
