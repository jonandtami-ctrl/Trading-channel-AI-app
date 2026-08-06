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
});
