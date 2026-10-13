import { describe, expect, it } from 'vitest';
import { detectAscendingChannel } from '../ascendingChannel';
import type { Candle } from '../types';

const DAY = 86400;

/** A rising baseline with an oscillation superimposed — produces a genuine sequence of higher swing lows and higher swing highs (an ascending channel), not a hand-crafted trendline. */
function risingChannelCandles(days: number, basePrice: number, slopePerDay: number, amplitude: number, cyclePeriod = 20): Candle[] {
  return Array.from({ length: days }, (_, i) => {
    const baseline = basePrice + slopePerDay * i;
    const phase = ((i % cyclePeriod) / cyclePeriod) * 2 * Math.PI;
    const price = baseline - amplitude * Math.cos(phase);
    return { time: i * DAY, open: price, high: price + 0.1, low: price - 0.1, close: price, volume: 2_000_000 };
  });
}

describe('detectAscendingChannel', () => {
  it('finds a genuine ascending channel with higher lows and higher highs', () => {
    const candles = risingChannelCandles(120, 100, 0.25, 8);
    const result = detectAscendingChannel(candles, 90);
    expect(result).not.toBeNull();
    expect(result!.supportSlopePerBar).toBeGreaterThan(0);
    expect(result!.resistanceSlopePerBar).toBeGreaterThan(0);
    expect(result!.higherLowCount).toBeGreaterThanOrEqual(3);
    expect(result!.higherHighCount).toBeGreaterThanOrEqual(2);
    expect(result!.projectedResistance).toBeGreaterThan(result!.projectedSupport);
  });

  it('rejects a descending channel outright — never classified as ascending', () => {
    const candles = risingChannelCandles(120, 250, -0.25, 8); // negative slope = falling baseline
    const result = detectAscendingChannel(candles, 90);
    expect(result).toBeNull();
  });

  it('rejects a flat (horizontal) series — no sustained rise to project', () => {
    const candles = risingChannelCandles(120, 100, 0, 8);
    const result = detectAscendingChannel(candles, 90);
    expect(result).toBeNull();
  });

  it('projects support/resistance at the current bar, not the channel’s original historical level', () => {
    const candles = risingChannelCandles(120, 100, 0.25, 8);
    const result = detectAscendingChannel(candles, 90)!;
    // After 90 days at 0.25/day, the projected support should be meaningfully
    // above the very first candle's price — a static "original boundary" read
    // would still show something close to the starting level instead.
    expect(result.projectedSupport).toBeGreaterThan(100 + 0.25 * 60);
  });

  it('returns null without enough history', () => {
    const candles = risingChannelCandles(20, 100, 0.25, 8);
    expect(detectAscendingChannel(candles, 90)).toBeNull();
  });
});
