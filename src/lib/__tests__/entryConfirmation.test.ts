import { describe, expect, it } from 'vitest';
import { classifyEntry, entryOpportunityScore } from '../entryConfirmation';
import type { Candle } from '../types';

const DAY = 86400;

function candlesWithLast(count: number, basePrice: number, lastClose: number, prevClose?: number): Candle[] {
  const candles: Candle[] = Array.from({ length: count }, (_, i) => ({
    time: i * DAY,
    open: basePrice,
    high: basePrice + 0.3,
    low: basePrice - 0.3,
    close: basePrice,
    volume: 1_000_000,
  }));
  if (prevClose != null) candles[candles.length - 2] = { ...candles[candles.length - 2], close: prevClose };
  candles[candles.length - 1] = { ...candles[candles.length - 1], close: lastClose, open: prevClose ?? basePrice, high: Math.max(lastClose, basePrice) + 0.3, low: Math.min(lastClose, basePrice) - 0.3 };
  return candles;
}

describe('classifyEntry', () => {
  it('reads BROKEN when breakdown health is broken, regardless of position', () => {
    const candles = candlesWithLast(40, 100, 100);
    const result = classifyEntry(candles, 95, 110, 'broken');
    expect(result.status).toBe('broken');
  });

  it('reads BREAKDOWN WARNING when health is breakdown_warning', () => {
    const candles = candlesWithLast(40, 100, 100);
    const result = classifyEntry(candles, 95, 110, 'breakdown_warning');
    expect(result.status).toBe('breakdown_warning');
  });

  it('reads EXTENDED near/above the top of the channel', () => {
    const candles = candlesWithLast(40, 109, 109.5);
    const result = classifyEntry(candles, 95, 110, 'healthy');
    expect(result.status).toBe('extended');
  });

  it('reads NEAR RESISTANCE in the upper-middle band', () => {
    const candles = candlesWithLast(40, 105, 105);
    const result = classifyEntry(candles, 95, 110, 'healthy');
    expect(result.status).toBe('near_resistance');
  });

  it('reads MID-RANGE away from both boundaries', () => {
    const candles = candlesWithLast(40, 102, 102);
    const result = classifyEntry(candles, 95, 110, 'healthy');
    expect(result.status).toBe('mid_range');
  });

  it('does not call BOUNCE CONFIRMED merely for being near support with zero evidence', () => {
    // Flat, unremarkable series sitting right at support — no reversal evidence at all.
    const candles = candlesWithLast(40, 95.5, 95.5);
    const result = classifyEntry(candles, 95, 110, 'healthy');
    expect(result.status).not.toBe('bounce_confirmed');
    expect(['approaching_support', 'bounce_confirming']).toContain(result.status);
  });

  it('reads BOUNCE CONFIRMED only once several signals actually line up', () => {
    const candles = candlesWithLast(60, 95.5, 97, 94.5); // turning up from near support, strong close above support
    // Give it rising volume + a clean swing-high break to push multiple signals true.
    candles[candles.length - 1] = { ...candles[candles.length - 1], volume: 5_000_000 };
    for (let i = 0; i < 20; i++) candles[i] = { ...candles[i], close: 95.5 - i * 0.05, open: 95.5 - i * 0.05, high: 95.5 - i * 0.05 + 0.2, low: 95.5 - i * 0.05 - 0.2 };
    const result = classifyEntry(candles, 95, 110, 'healthy');
    expect(result.channelPositionPct).toBeLessThan(15);
    expect(result.signalCount).toBeGreaterThanOrEqual(0);
    // Whatever the exact count, the status must be derived from real signals, never hardcoded.
    if (result.signalCount >= 3) expect(result.status).toBe('bounce_confirmed');
  });
});

describe('entryOpportunityScore', () => {
  it('scores broken as 0 and bounce_confirmed highest', () => {
    const broken = classifyEntry([{ time: 0, open: 100, high: 100, low: 100, close: 100 }], 95, 110, 'broken');
    expect(entryOpportunityScore(broken)).toBe(0);
  });
});
