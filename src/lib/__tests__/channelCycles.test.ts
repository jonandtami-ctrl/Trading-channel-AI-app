import { describe, expect, it } from 'vitest';
import { countChannelCycles } from '../channelCycles';
import type { Candle, Channel, Pivot } from '../types';

const DAY = 86400;

function touch(time: number, price: number, type: Pivot['type']): Pivot {
  return { index: 0, time, price, type };
}

function candlesUpTo(lastTime: number): Candle[] {
  return [{ time: lastTime, open: 1, high: 1, low: 1, close: 1 }];
}

function channelWithTouches(supportTimes: number[], resistanceTimes: number[]): Channel {
  return {
    support: { price: 100, type: 'support', touches: supportTimes.map((t) => touch(t, 100, 'low')) },
    resistance: { price: 110, type: 'resistance', touches: resistanceTimes.map((t) => touch(t, 110, 'high')) },
    widthPct: 10,
    containmentPct: 90,
    status: 'active',
    lastTouchIndex: 0,
  };
}

describe('countChannelCycles', () => {
  it('counts each support-then-later-resistance alternation as one cycle', () => {
    // support, resistance, support, resistance, support, resistance — 3 full up-legs.
    const channel = channelWithTouches([0 * DAY, 10 * DAY, 20 * DAY], [5 * DAY, 15 * DAY, 25 * DAY]);
    const cycles = countChannelCycles(channel, candlesUpTo(30 * DAY));
    expect(cycles.supportToResistanceCycles).toBe(3);
  });

  it('does not count repeated touches on the same side as a cycle', () => {
    // Three support touches in a row, never reaching resistance — exactly the "two lines that fit" case, not a proven channel.
    const channel = channelWithTouches([0, 5 * DAY, 10 * DAY], []);
    const cycles = countChannelCycles(channel, candlesUpTo(15 * DAY));
    expect(cycles.supportToResistanceCycles).toBe(0);
    expect(cycles.resistanceToSupportCycles).toBe(0);
  });

  it('counts the mirror resistance -> support direction separately', () => {
    const channel = channelWithTouches([5 * DAY], [0, 10 * DAY]);
    const cycles = countChannelCycles(channel, candlesUpTo(15 * DAY));
    // resistance(0) -> support(5d) -> resistance(10d): one up-leg, one down-leg.
    expect(cycles.supportToResistanceCycles).toBe(1);
    expect(cycles.resistanceToSupportCycles).toBe(1);
  });

  it('excludes touches older than the window', () => {
    const channel = channelWithTouches(
      [0, 90 * DAY], // the touch at time 0 is more than 60 days before the last candle
      [95 * DAY]
    );
    const cycles = countChannelCycles(channel, candlesUpTo(100 * DAY), 60);
    // Only the 90d support touch and 95d resistance touch fall inside the last 60 days.
    expect(cycles.supportToResistanceCycles).toBe(1);
  });

  it('respects a custom window size', () => {
    const channel = channelWithTouches([0, 20 * DAY], [10 * DAY, 30 * DAY]);
    expect(countChannelCycles(channel, candlesUpTo(30 * DAY), 15).supportToResistanceCycles).toBe(1);
    expect(countChannelCycles(channel, candlesUpTo(30 * DAY), 60).supportToResistanceCycles).toBe(2);
  });

  it('returns zero cycles when there are no candles', () => {
    const channel = channelWithTouches([0], [10 * DAY]);
    expect(countChannelCycles(channel, [])).toEqual({ supportToResistanceCycles: 0, resistanceToSupportCycles: 0, windowDays: 60 });
  });
});
