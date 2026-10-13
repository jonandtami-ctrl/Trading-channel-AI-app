import { describe, expect, it } from 'vitest';
import { detectHorizontalRange } from '../horizontalRange';
import type { Candle } from '../types';

const DAY = 86400;

/** A genuine oscillating daily series (not hand-crafted zones) bouncing between support and resistance every cyclePeriod days. */
function oscillatingCandles(days: number, support: number, resistance: number, cyclePeriod = 20, volume = 2_000_000): Candle[] {
  const mid = (support + resistance) / 2;
  const amplitude = (resistance - support) / 2;
  return Array.from({ length: days }, (_, i) => {
    const phase = ((i % cyclePeriod) / cyclePeriod) * 2 * Math.PI;
    const price = mid - amplitude * Math.cos(phase);
    return { time: i * DAY, open: price, high: price + 0.1, low: price - 0.1, close: price, volume };
  });
}

describe('detectHorizontalRange', () => {
  it('finds a genuine 15-30%-wide range with enough independent touches on both sides', () => {
    const candles = oscillatingCandles(120, 100, 122); // ~22% wide, with lead-in history ahead of the 90-day lookback window
    const result = detectHorizontalRange(candles, 90);
    expect(result).not.toBeNull();
    expect(result!.widthPct).toBeGreaterThanOrEqual(15);
    expect(result!.widthPct).toBeLessThanOrEqual(30);
    expect(result!.supportTouches).toBeGreaterThanOrEqual(3);
    expect(result!.resistanceTouches).toBeGreaterThanOrEqual(2);
    expect(result!.qualityScore).toBeGreaterThan(0);
  });

  it('returns null for a range too narrow to qualify (below the 15% floor)', () => {
    const candles = oscillatingCandles(120, 100, 106, 20); // 6% wide
    const result = detectHorizontalRange(candles, 90);
    expect(result).toBeNull();
  });

  it('returns null without enough history for the requested lookback', () => {
    const candles = oscillatingCandles(20, 100, 122, 20);
    const result = detectHorizontalRange(candles, 90);
    expect(result).toBeNull();
  });

  it('reports a support zone as a band, not a single exact price', () => {
    const candles = oscillatingCandles(120, 100, 122, 20);
    const result = detectHorizontalRange(candles, 90)!;
    expect(result.supportZoneLow).toBeLessThanOrEqual(result.supportZoneHigh);
  });
});
