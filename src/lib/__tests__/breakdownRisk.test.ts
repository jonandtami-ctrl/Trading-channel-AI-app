import { describe, expect, it } from 'vitest';
import { computeBreakdownRisk, isBreakdownConfirmed, DEFAULT_BREAKDOWN_CONFIG } from '../breakdownRisk';
import type { Candle } from '../types';
import type { SupportTestRecord } from '../supportTests';

const DAY = 86400;

function flatCandles(count: number, price = 100): Candle[] {
  return Array.from({ length: count }, (_, i) => ({ time: i * DAY, open: price, high: price + 0.3, low: price - 0.3, close: price, volume: 1_000_000 }));
}

function record(overrides: Partial<SupportTestRecord>): SupportTestRecord {
  return {
    testNumber: 1,
    index: 0,
    date: '2024-01-01',
    time: 0,
    supportZoneLow: 100,
    supportZoneHigh: 101,
    lowestPrice: 100,
    bounceMagnitudePct: 10,
    bounceDurationBars: 5,
    volumeRatio: 1,
    maxFavorableExcursionPct: 10,
    maxAdverseExcursionPct: 1,
    supportFailed: false,
    barsToBreakdown: null,
    outcome: 'bounce',
    ...overrides,
  };
}

describe('isBreakdownConfirmed', () => {
  it('is not confirmed while still inside the reclaim grace window', () => {
    const candles = flatCandles(40, 100);
    candles[38] = { ...candles[38], close: 95 }; // broke below support (100) 1 session ago
    expect(isBreakdownConfirmed(candles, 100, { ...DEFAULT_BREAKDOWN_CONFIG, reclaimWindowSessions: 3 })).toBe(false);
  });

  it('is confirmed once the reclaim window has passed with no reclaim', () => {
    const candles = flatCandles(40, 100);
    for (let i = 35; i < 40; i++) candles[i] = { ...candles[i], close: 95 };
    expect(isBreakdownConfirmed(candles, 100, { ...DEFAULT_BREAKDOWN_CONFIG, reclaimWindowSessions: 3 })).toBe(true);
  });

  it('is not confirmed if price reclaimed support after dipping below it', () => {
    const candles = flatCandles(40, 100);
    candles[35] = { ...candles[35], close: 95 };
    for (let i = 36; i < 40; i++) candles[i] = { ...candles[i], close: 101 }; // reclaimed
    expect(isBreakdownConfirmed(candles, 100, { ...DEFAULT_BREAKDOWN_CONFIG, reclaimWindowSessions: 3 })).toBe(false);
  });

  it('atr_based rule confirms immediately on a large enough single-candle move below support', () => {
    const candles = flatCandles(40, 100);
    candles[39] = { ...candles[39], close: 90 }; // far below support, same session
    const confirmed = isBreakdownConfirmed(candles, 100, { rule: 'atr_based', reclaimWindowSessions: 3, atrMultiple: 1.5 });
    expect(confirmed).toBe(true);
  });
});

describe('computeBreakdownRisk', () => {
  it('returns health=broken with score 100 when the confirmation rule is satisfied', () => {
    const candles = flatCandles(40, 100);
    for (let i = 35; i < 40; i++) candles[i] = { ...candles[i], close: 95 };
    const result = computeBreakdownRisk(candles, 100, 101, []);
    expect(result.health).toBe('broken');
    expect(result.score).toBe(100);
  });

  it('reads healthy for an unremarkable, non-weakening series', () => {
    const candles = flatCandles(40, 100);
    const result = computeBreakdownRisk(candles, 95, 96, [record({ outcome: 'bounce' }), record({ outcome: 'bounce' })]);
    expect(result.health).toBe('healthy');
    expect(result.score).toBeLessThan(30);
  });

  it('flags weakening when successive bounce magnitudes are declining', () => {
    const candles = flatCandles(40, 100);
    const records = [
      record({ outcome: 'bounce', bounceMagnitudePct: 20 }),
      record({ outcome: 'bounce', bounceMagnitudePct: 12 }),
      record({ outcome: 'bounce', bounceMagnitudePct: 5 }),
    ];
    const result = computeBreakdownRisk(candles, 95, 96, records);
    expect(result.score).toBeGreaterThan(0);
    expect(result.factors.some((f) => f.toLowerCase().includes('smaller'))).toBe(true);
  });

  it('never returns a risk score above 99 unless a breakdown is actually confirmed', () => {
    const candles = flatCandles(40, 100);
    const records = [record({ outcome: 'breakdown' }), record({ outcome: 'breakdown' }), record({ outcome: 'breakdown' })];
    const result = computeBreakdownRisk(candles, 95, 96, records);
    expect(result.health).not.toBe('broken');
    expect(result.score).toBeLessThanOrEqual(99);
  });
});
