import { describe, expect, it } from 'vitest';
import { averageDailyDollarVolume, isLiquid, MIN_LIQUIDITY_USD } from '../liquidity';
import type { Candle } from '../types';

function candle(close: number, volume: number | undefined): Candle {
  return { time: 0, open: close, high: close, low: close, close, volume };
}

describe('averageDailyDollarVolume', () => {
  it('averages close * volume over the trailing window', () => {
    const candles = Array.from({ length: 20 }, () => candle(100, 1_000_000));
    expect(averageDailyDollarVolume(candles)).toBe(100_000_000);
  });

  it('returns 0 when no candle in the window has volume data', () => {
    const candles = Array.from({ length: 20 }, () => candle(100, undefined));
    expect(averageDailyDollarVolume(candles)).toBe(0);
  });

  it('only looks at the trailing window, not the whole history', () => {
    const old = Array.from({ length: 30 }, () => candle(100, 10_000_000));
    const recent = Array.from({ length: 20 }, () => candle(100, 100_000));
    expect(averageDailyDollarVolume([...old, ...recent], 20)).toBe(10_000_000);
  });
});

describe('isLiquid', () => {
  it('passes a symbol clearing the liquidity floor', () => {
    const candles = Array.from({ length: 20 }, () => candle(100, 1_000_000)); // $100M/day
    expect(isLiquid(candles)).toBe(true);
  });

  it('rejects a symbol below the liquidity floor', () => {
    const candles = Array.from({ length: 20 }, () => candle(5, 10_000)); // $50k/day
    expect(isLiquid(candles)).toBe(false);
  });

  it('respects a custom threshold', () => {
    const candles = Array.from({ length: 20 }, () => candle(10, 100_000)); // $1M/day
    expect(isLiquid(candles, 500_000)).toBe(true);
    expect(isLiquid(candles, MIN_LIQUIDITY_USD)).toBe(false);
  });
});
