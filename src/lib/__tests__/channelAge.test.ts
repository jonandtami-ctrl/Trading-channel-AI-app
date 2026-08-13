import { describe, expect, it } from 'vitest';
import { channelAgeDays, formatChannelAge } from '../channelAge';
import type { Candle, Channel, Level } from '../types';

const DAY = 86400;

function makeChannel(supportFirstTouchTime: number, resistanceFirstTouchTime: number): Channel {
  const support: Level = {
    price: 90,
    type: 'support',
    touches: [{ index: 0, time: supportFirstTouchTime, price: 90, type: 'low' }],
  };
  const resistance: Level = {
    price: 110,
    type: 'resistance',
    touches: [{ index: 1, time: resistanceFirstTouchTime, price: 110, type: 'high' }],
  };
  return { support, resistance, widthPct: 20, containmentPct: 90, status: 'active', lastTouchIndex: 1 };
}

function candleAt(time: number): Candle {
  return { time, open: 100, high: 100, low: 100, close: 100 };
}

describe('channelAgeDays', () => {
  it('measures from the earliest touch (support or resistance) to the most recent candle', () => {
    const channel = makeChannel(1000 * DAY, 1005 * DAY);
    const candles = [candleAt(1000 * DAY), candleAt(1010 * DAY)];
    expect(channelAgeDays(channel, candles)).toBe(10);
  });

  it('picks whichever side touched first, regardless of support/resistance order', () => {
    const channel = makeChannel(1010 * DAY, 1000 * DAY); // resistance touched first this time
    const candles = [candleAt(1000 * DAY), candleAt(1020 * DAY)];
    expect(channelAgeDays(channel, candles)).toBe(20);
  });

  it('never returns a negative age', () => {
    const channel = makeChannel(1000 * DAY, 1000 * DAY);
    const candles = [candleAt(999 * DAY)]; // last candle somehow before the touch — shouldn't happen, but stay safe
    expect(channelAgeDays(channel, candles)).toBe(0);
  });
});

describe('formatChannelAge', () => {
  it('shows days under a month', () => {
    expect(formatChannelAge(1)).toBe('1 day');
    expect(formatChannelAge(15)).toBe('15 days');
    expect(formatChannelAge(29)).toBe('29 days');
  });

  it('shows months between a month and a year', () => {
    expect(formatChannelAge(30)).toBe('1 month');
    expect(formatChannelAge(90)).toBe('3 months');
    expect(formatChannelAge(300)).toBe('10 months');
  });

  it('shows years at 365+ days', () => {
    expect(formatChannelAge(365)).toBe('1.0 years');
    expect(formatChannelAge(730)).toBe('2.0 years');
    expect(formatChannelAge(400)).toBe('1.1 years');
  });
});
