import { describe, expect, it } from 'vitest';
import { backtestChannel } from '../backtest';
import type { Channel, Level, Pivot } from '../types';

function pivot(index: number, price: number, type: 'high' | 'low'): Pivot {
  return { index, time: index, price, type };
}

function makeChannel(supportTouches: Pivot[], resistanceTouches: Pivot[]): Channel {
  const support: Level = { price: 100, type: 'support', touches: supportTouches };
  const resistance: Level = { price: 110, type: 'resistance', touches: resistanceTouches };
  return { support, resistance, widthPct: 10, containmentPct: 90, status: 'active', lastTouchIndex: 0 };
}

describe('backtestChannel', () => {
  it('pairs an alternating buy-at-support / sell-at-resistance sequence into trades', () => {
    const channel = makeChannel(
      [pivot(0, 100, 'low'), pivot(4, 101, 'low')],
      [pivot(2, 110, 'high'), pivot(6, 109, 'high')]
    );
    const result = backtestChannel(channel);
    expect(result.trades).toHaveLength(2);
    expect(result.trades[0].entryPrice).toBe(100);
    expect(result.trades[0].exitPrice).toBe(110);
    expect(result.trades[0].pnlPct).toBeCloseTo(10, 5);
    expect(result.winCount).toBe(2);
    expect(result.lossCount).toBe(0);
    expect(result.totalReturnPct).toBeCloseTo(10 + ((109 - 101) / 101) * 100, 5);
  });

  it('ignores a resistance touch that comes before any support touch (no open position yet)', () => {
    const channel = makeChannel([pivot(3, 100, 'low')], [pivot(0, 110, 'high')]);
    const result = backtestChannel(channel);
    expect(result.trades).toHaveLength(0);
  });

  it('leaves a trailing buy with no matching sell as an open (unrecorded) trade', () => {
    const channel = makeChannel([pivot(0, 100, 'low'), pivot(5, 102, 'low')], [pivot(2, 110, 'high')]);
    const result = backtestChannel(channel);
    expect(result.trades).toHaveLength(1); // the second buy has no exit yet
  });

  it('returns an empty result for a channel with no touches', () => {
    const channel = makeChannel([], []);
    const result = backtestChannel(channel);
    expect(result.trades).toHaveLength(0);
    expect(result.totalReturnPct).toBe(0);
  });
});
