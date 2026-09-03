import { describe, expect, it } from 'vitest';
import { calculateRSI } from '../rsi';
import type { Candle } from '../types';

function candle(close: number): Candle {
  return { time: 0, open: close, high: close, low: close, close };
}

describe('calculateRSI', () => {
  it('returns NaN for every index before enough history exists', () => {
    const candles = Array.from({ length: 10 }, (_, i) => candle(100 + i));
    const rsi = calculateRSI(candles, 14);
    expect(rsi.every((v) => Number.isNaN(v))).toBe(true);
  });

  it('reads 100 when every candle in the period closed higher than the last', () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(100 + i));
    const rsi = calculateRSI(candles, 14);
    expect(rsi[rsi.length - 1]).toBe(100);
  });

  it('reads 0 when every candle in the period closed lower than the last', () => {
    const candles = Array.from({ length: 20 }, (_, i) => candle(200 - i));
    const rsi = calculateRSI(candles, 14);
    expect(rsi[rsi.length - 1]).toBe(0);
  });

  it('reads roughly neutral (50) for a flat, unchanging price series', () => {
    const candles = Array.from({ length: 20 }, () => candle(100));
    const rsi = calculateRSI(candles, 14);
    expect(rsi[rsi.length - 1]).toBe(50);
  });

  it('reads lower after a decline than after a recovery off that decline', () => {
    const declining = [...Array.from({ length: 15 }, (_, i) => candle(120 - i))];
    const rsiDeclining = calculateRSI(declining, 14);

    const recovering = [...declining, candle(110), candle(112), candle(114), candle(116)];
    const rsiRecovering = calculateRSI(recovering, 14);

    expect(rsiRecovering[rsiRecovering.length - 1]).toBeGreaterThan(rsiDeclining[rsiDeclining.length - 1]);
  });
});
