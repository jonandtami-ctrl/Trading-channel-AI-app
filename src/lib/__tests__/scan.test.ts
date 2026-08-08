import { describe, expect, it } from 'vitest';
import { getSignal, closestLevelDistance, classifyStrength, assessRisk, getSignalDetail } from '../scan';
import type { Alert, Candle, Channel, Level, ScanResult } from '../types';

function makeResult(alerts: Alert[], lastClose = 100, channels: Channel[] = []): ScanResult {
  const candles: Candle[] = [{ time: 0, open: lastClose, high: lastClose, low: lastClose, close: lastClose }];
  return { symbol: 'TEST', candles, channels, alerts, isLive: true };
}

function alert(type: Alert['type'], levelPrice: number, strengthPct?: number): Alert {
  return { symbol: 'TEST', type, price: 100, levelPrice, time: 0, message: '', strengthPct };
}

function makeChannel(supportPrice: number, resistancePrice: number): Channel {
  const support: Level = { price: supportPrice, type: 'support', touches: [] };
  const resistance: Level = { price: resistancePrice, type: 'resistance', touches: [] };
  return {
    support,
    resistance,
    widthPct: ((resistancePrice - supportPrice) / supportPrice) * 100,
    containmentPct: 90,
    status: 'active',
    lastTouchIndex: 0,
  };
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

describe('classifyStrength', () => {
  it('tiers 10%+ as high, 5%+ as medium, 1%+ as low', () => {
    expect(classifyStrength(12)).toBe('high');
    expect(classifyStrength(10)).toBe('high');
    expect(classifyStrength(7)).toBe('medium');
    expect(classifyStrength(5)).toBe('medium');
    expect(classifyStrength(2)).toBe('low');
    expect(classifyStrength(1)).toBe('low');
  });

  it('returns null below 1% or when missing', () => {
    expect(classifyStrength(0.5)).toBeNull();
    expect(classifyStrength(undefined)).toBeNull();
    expect(classifyStrength(null)).toBeNull();
  });
});

describe('assessRisk', () => {
  it('calls it high risk once the move has used up most of the channel width', () => {
    expect(assessRisk(8, 10)).toBe('high'); // 80% of the channel already used
  });

  it('calls it low risk when the move has barely used any of the channel width', () => {
    expect(assessRisk(1, 10)).toBe('low'); // 10% used, plenty of room left
  });

  it('calls it medium risk in between', () => {
    expect(assessRisk(4, 10)).toBe('medium'); // 40% used
  });
});

describe('getSignalDetail', () => {
  it('pairs a BUY with its strength tier and risk relative to the channel width', () => {
    const channel = makeChannel(100, 110); // 10% wide
    const result = makeResult([alert('breakout', 110, 9)], 119.9, [channel]); // strength 9% of a 10%-wide channel = 90% consumed
    const detail = getSignalDetail(result);
    expect(detail.signal).toBe('buy');
    expect(detail.strengthPct).toBe(9);
    expect(detail.strengthTier).toBe('medium');
    expect(detail.risk).toBe('high');
  });

  it('returns nulls for strength/risk when there is no signal', () => {
    const detail = getSignalDetail(makeResult([]));
    expect(detail.signal).toBeNull();
    expect(detail.strengthPct).toBeNull();
    expect(detail.risk).toBeNull();
  });
});
