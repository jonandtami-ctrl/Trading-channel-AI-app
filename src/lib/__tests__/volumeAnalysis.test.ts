import { describe, expect, it } from 'vitest';
import { classifyVolume, volumeScore } from '../volumeAnalysis';
import type { Candle } from '../types';

function candlesWithVolume(volumes: number[]): Candle[] {
  return volumes.map((volume, i) => ({ time: i, open: 100, high: 101, low: 99, close: 100, volume }));
}

describe('classifyVolume', () => {
  it('classifies a breakout candle with 2x+ average volume as high', () => {
    const candles = candlesWithVolume([...Array(20).fill(500_000), 1_200_000]);
    const result = classifyVolume(candles, 20);
    expect(result.level).toBe('high');
    expect(result.ratio).toBeCloseTo(2.4, 1);
  });

  it('classifies roughly-average volume as normal', () => {
    const candles = candlesWithVolume([...Array(20).fill(500_000), 520_000]);
    expect(classifyVolume(candles, 20).level).toBe('normal');
  });

  it('classifies well-below-average volume as low', () => {
    const candles = candlesWithVolume([...Array(20).fill(500_000), 150_000]);
    expect(classifyVolume(candles, 20).level).toBe('low');
  });

  it('falls back to normal when volume data is missing', () => {
    const candles: Candle[] = [{ time: 0, open: 100, high: 101, low: 99, close: 100 }];
    expect(classifyVolume(candles, 0)).toEqual({ level: 'normal', ratio: 1 });
  });
});

describe('volumeScore', () => {
  it('ranks high > elevated > normal > low', () => {
    expect(volumeScore('high')).toBeGreaterThan(volumeScore('elevated'));
    expect(volumeScore('elevated')).toBeGreaterThan(volumeScore('normal'));
    expect(volumeScore('normal')).toBeGreaterThan(volumeScore('low'));
  });
});
