import { describe, expect, it } from 'vitest';
import { generateAlerts } from '../alerts';
import type { Candle, Channel, Level } from '../types';

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

describe('generateAlerts', () => {
  it('fires an approaching_resistance alert when price nears the top of the channel', () => {
    const channel = makeChannel(100, 110);
    const candles: Candle[] = [{ time: 0, open: 109, high: 109.5, low: 108.5, close: 109 }];
    const alerts = generateAlerts('TEST', candles, [channel]);
    expect(alerts.some((a) => a.type === 'approaching_resistance')).toBe(true);
  });

  it('fires a breakout alert when the channel is already flagged broken upward', () => {
    const channel = { ...makeChannel(100, 110), status: 'broken' as const, brokenDirection: 'up' as const };
    const candles: Candle[] = [{ time: 0, open: 115, high: 116, low: 114, close: 115 }];
    const alerts = generateAlerts('TEST', candles, [channel]);
    expect(alerts.some((a) => a.type === 'breakout')).toBe(true);
  });

  it('produces no alerts when price sits calmly mid-channel', () => {
    const channel = makeChannel(100, 110);
    const candles: Candle[] = [{ time: 0, open: 105, high: 105.5, low: 104.5, close: 105 }];
    const alerts = generateAlerts('TEST', candles, [channel]);
    expect(alerts).toHaveLength(0);
  });

  it('attaches strengthPct to a breakout alert, measuring how far past resistance price closed', () => {
    const channel = { ...makeChannel(100, 110), status: 'broken' as const, brokenDirection: 'up' as const };
    const candles: Candle[] = [{ time: 0, open: 115, high: 116, low: 114, close: 121 }];
    const alerts = generateAlerts('TEST', candles, [channel]);
    const breakout = alerts.find((a) => a.type === 'breakout');
    expect(breakout?.strengthPct).toBeCloseTo(10, 5); // (121-110)/110 * 100
  });

  it('attaches strengthPct to a bounce_support alert, measuring the move off the touched low', () => {
    const channel = makeChannel(100, 110);
    const candles: Candle[] = [
      { time: 0, open: 100, high: 101, low: 99.8, close: 100 },
      { time: 1, open: 100, high: 102, low: 99.6, close: 101 },
      { time: 2, open: 101, high: 103, low: 100.5, close: 102 },
      { time: 3, open: 102, high: 108, low: 101, close: 106 },
    ];
    const alerts = generateAlerts('TEST', candles, [channel]);
    const bounce = alerts.find((a) => a.type === 'bounce_support');
    expect(bounce?.strengthPct).toBeCloseTo(((106 - 99.6) / 99.6) * 100, 5);
  });
});
