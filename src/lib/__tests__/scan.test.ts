import { describe, expect, it } from 'vitest';
import { getSignal, closestLevelDistance } from '../scan';
import type { Alert, Candle, ScanResult } from '../types';

function makeResult(alerts: Alert[], lastClose = 100): ScanResult {
  const candles: Candle[] = [{ time: 0, open: lastClose, high: lastClose, low: lastClose, close: lastClose }];
  return { symbol: 'TEST', candles, channels: [], alerts, isLive: true };
}

function alert(type: Alert['type'], levelPrice: number): Alert {
  return { symbol: 'TEST', type, price: 100, levelPrice, time: 0, message: '' };
}

describe('getSignal', () => {
  it('calls breakout and a support bounce a BUY', () => {
    expect(getSignal(makeResult([alert('breakout', 110)]))).toBe('buy');
    expect(getSignal(makeResult([alert('bounce_support', 90)]))).toBe('buy');
  });

  it('calls breakdown and a resistance bounce a SELL', () => {
    expect(getSignal(makeResult([alert('breakdown', 90)]))).toBe('sell');
    expect(getSignal(makeResult([alert('bounce_resistance', 110)]))).toBe('sell');
  });

  it('calls merely approaching a level a WATCH, not a firm call', () => {
    expect(getSignal(makeResult([alert('approaching_support', 90)]))).toBe('watch_support');
    expect(getSignal(makeResult([alert('approaching_resistance', 110)]))).toBe('watch_resistance');
  });

  it('returns null when there are no relevant alerts', () => {
    expect(getSignal(makeResult([]))).toBeNull();
  });
});

describe('closestLevelDistance', () => {
  it('returns the smallest fractional distance to any alert level', () => {
    const result = makeResult([alert('approaching_resistance', 110), alert('approaching_support', 99)], 100);
    expect(closestLevelDistance(result)).toBeCloseTo(0.01, 5);
  });

  it('returns Infinity when there are no alerts', () => {
    expect(closestLevelDistance(makeResult([]))).toBe(Infinity);
  });
});
