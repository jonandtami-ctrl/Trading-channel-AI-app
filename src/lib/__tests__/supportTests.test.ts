import { describe, expect, it } from 'vitest';
import type { Level, Pivot } from '../types';
import { dedupeTouchesByTime, independentSupportTouches, buildSupportTestRecords } from '../supportTests';
import type { Candle } from '../types';

const DAY = 86400;

function touch(index: number, price: number, type: Pivot['type'] = 'low'): Pivot {
  return { index, time: index * DAY, price, type };
}

function flatCandles(count: number, price = 100): Candle[] {
  return Array.from({ length: count }, (_, i) => ({ time: i * DAY, open: price, high: price + 0.5, low: price - 0.5, close: price, volume: 1_000_000 }));
}

describe('dedupeTouchesByTime', () => {
  it('collapses pivots within the gap into one representative touch', () => {
    const pivots = [touch(10, 100), touch(12, 99.5), touch(50, 100.2)];
    const result = dedupeTouchesByTime(pivots, 5, 'min');
    expect(result).toHaveLength(2);
    expect(result[0].price).toBe(99.5); // lowest of the first (same-visit) group
    expect(result[1].index).toBe(50);
  });

  it('picks the max price within a group when extreme is max (resistance)', () => {
    const pivots = [touch(10, 100, 'high'), touch(11, 101, 'high')];
    const result = dedupeTouchesByTime(pivots, 5, 'max');
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(101);
  });

  it('does not collapse pivots that are far enough apart in time', () => {
    const pivots = [touch(0, 100), touch(30, 99), touch(60, 101)];
    const result = dedupeTouchesByTime(pivots, 5, 'min');
    expect(result).toHaveLength(3);
  });

  it('returns an empty array for no pivots', () => {
    expect(dedupeTouchesByTime([], 5, 'min')).toEqual([]);
  });
});

describe('independentSupportTouches', () => {
  it('several consecutive support-touch candles count as only one test (test case 5)', () => {
    const level: Level = {
      price: 100,
      type: 'support',
      touches: [touch(10, 100.1), touch(11, 99.9), touch(12, 100.0), touch(13, 99.95)],
    };
    const result = independentSupportTouches(level, 5);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(99.9);
  });

  it('counts genuinely separated visits as separate tests', () => {
    const level: Level = {
      price: 100,
      type: 'support',
      touches: [touch(0, 100), touch(2, 99.8), touch(40, 100.1), touch(80, 99.9)],
    };
    const result = independentSupportTouches(level, 10);
    expect(result).toHaveLength(3);
  });
});

describe('buildSupportTestRecords', () => {
  it('classifies a real bounce correctly, with the right bounce magnitude', () => {
    const candles = flatCandles(60, 100);
    // A dip to 95 at index 20, then a rally to 110 within the observation window.
    candles[20] = { ...candles[20], low: 95, close: 95.5 };
    for (let i = 21; i <= 30; i++) candles[i] = { ...candles[i], close: 100 + (i - 20), high: 100 + (i - 20) + 0.5 };

    const level: Level = { price: 95, type: 'support', touches: [touch(20, 95)] };
    const records = buildSupportTestRecords(candles, level, { observationWindowDays: 20 });

    expect(records).toHaveLength(1);
    expect(records[0].outcome).toBe('bounce');
    expect(records[0].bounceMagnitudePct).toBeGreaterThan(10);
    expect(records[0].supportFailed).toBe(false);
  });

  it('classifies a breakdown correctly', () => {
    const candles = flatCandles(60, 100);
    candles[20] = { ...candles[20], low: 95, close: 95.5 };
    for (let i = 21; i <= 30; i++) candles[i] = { ...candles[i], close: 95.5 - (i - 20) * 0.5, low: 95.5 - (i - 20) * 0.5 - 0.3 };

    const level: Level = { price: 95, type: 'support', touches: [touch(20, 95)] };
    const records = buildSupportTestRecords(candles, level, { observationWindowDays: 20, breakdownTolerancePct: 2 });

    expect(records).toHaveLength(1);
    expect(records[0].outcome).toBe('breakdown');
    expect(records[0].supportFailed).toBe(true);
    expect(records[0].barsToBreakdown).not.toBeNull();
  });

  it('classifies a too-recent test as unresolved rather than a failed bounce', () => {
    const candles = flatCandles(30, 100);
    candles[29] = { ...candles[29], low: 95, close: 95.5 };
    const level: Level = { price: 95, type: 'support', touches: [touch(29, 95)] };
    const records = buildSupportTestRecords(candles, level, { observationWindowDays: 20 });
    expect(records[0].outcome).toBe('unresolved');
  });
});
