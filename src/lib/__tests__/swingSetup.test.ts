import { describe, expect, it } from 'vitest';
import { evaluateSwingSetup, evaluateAllSwingSetups } from '../swingSetup';
import type { Candle, ScanResult } from '../types';

const DAY = 86400;

function oscillatingCandles(days: number, support: number, resistance: number, cyclePeriod = 20, volume = 2_000_000): Candle[] {
  const mid = (support + resistance) / 2;
  const amplitude = (resistance - support) / 2;
  return Array.from({ length: days }, (_, i) => {
    const phase = ((i % cyclePeriod) / cyclePeriod) * 2 * Math.PI;
    const price = mid - amplitude * Math.cos(phase);
    return { time: i * DAY, open: price, high: price + 0.1, low: price - 0.1, close: price, volume };
  });
}

function scanResult(symbol: string, candles: Candle[]): ScanResult {
  return { symbol, candles, channels: [], levels: [], alerts: [], isLive: true };
}

describe('evaluateSwingSetup', () => {
  it('produces a complete, internally consistent setup for a genuine wide range', () => {
    const candles = oscillatingCandles(120, 100, 122);
    const setup = evaluateSwingSetup(scanResult('TEST', candles));

    expect(setup).not.toBeNull();
    expect(setup!.patternType).toBe('horizontal_range');
    expect(setup!.support).toBeLessThan(setup!.resistance);
    expect(setup!.channelWidthPct).toBeGreaterThanOrEqual(15);
    expect(setup!.overallSetupScore).toBeGreaterThanOrEqual(0);
    expect(setup!.overallSetupScore).toBeLessThanOrEqual(100);
    expect(setup!.currency).toBe('USD');
    expect(setup!.riskRewardPlan.stopPrice).toBeLessThan(setup!.support);
  });

  it('returns null for a flat series with nothing resembling a range', () => {
    const candles = Array.from({ length: 90 }, (_, i) => ({ time: i * DAY, open: 100, high: 100.1, low: 99.9, close: 100, volume: 1_000_000 }));
    expect(evaluateSwingSetup(scanResult('FLAT', candles))).toBeNull();
  });

  it('a financially-irrelevant but technically broken setup is excluded from ranking eligibility', () => {
    const candles = oscillatingCandles(120, 100, 122);
    // Force a confirmed breakdown: several closes well below support at the very end.
    for (let i = candles.length - 6; i < candles.length; i++) {
      candles[i] = { ...candles[i], close: 80, low: 79, high: 81 };
    }
    const setup = evaluateSwingSetup(scanResult('BROKEN', candles));
    if (setup) {
      expect(setup.eligibleForRanking).toBe(false);
      expect(setup.overallSetupScore).toBe(0);
    }
  });
});

describe('evaluateAllSwingSetups', () => {
  it('excludes demo/non-live results and sorts by overall score descending', () => {
    const good = scanResult('GOOD', oscillatingCandles(120, 100, 122));
    const demo = { ...scanResult('DEMO', oscillatingCandles(120, 100, 122)), isLive: false };
    const results = evaluateAllSwingSetups([good, demo]);
    expect(results.map((r) => r.symbol)).toEqual(['GOOD']);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].overallSetupScore).toBeGreaterThanOrEqual(results[i].overallSetupScore);
    }
  });
});
