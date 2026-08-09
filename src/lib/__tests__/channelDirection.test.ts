import { describe, expect, it } from 'vitest';
import { classifyChannelDirection, channelDirectionWarning } from '../channelDirection';
import type { Channel, Pivot } from '../types';

function touch(index: number, price: number): Pivot {
  return { index, time: index, price, type: 'low' };
}

function makeChannel(supportPrices: number[], resistancePrices: number[]): Channel {
  return {
    support: { price: supportPrices[supportPrices.length - 1], type: 'support', touches: supportPrices.map((p, i) => touch(i, p)) },
    resistance: {
      price: resistancePrices[resistancePrices.length - 1],
      type: 'resistance',
      touches: resistancePrices.map((p, i) => touch(i, p)),
    },
    widthPct: 5,
    containmentPct: 90,
    status: 'active',
    lastTouchIndex: Math.max(supportPrices.length, resistancePrices.length) - 1,
  };
}

describe('classifyChannelDirection', () => {
  it('calls it ascending when both support and resistance touches trend up', () => {
    const channel = makeChannel([100, 102, 105], [110, 113, 116]);
    expect(classifyChannelDirection(channel)).toBe('ascending');
  });

  it('calls it descending when both support and resistance touches trend down', () => {
    const channel = makeChannel([105, 102, 100], [116, 113, 110]);
    expect(classifyChannelDirection(channel)).toBe('descending');
  });

  it('calls it horizontal when touches stay roughly flat', () => {
    const channel = makeChannel([100, 100.5, 100.2], [110, 110.3, 109.8]);
    expect(classifyChannelDirection(channel)).toBe('horizontal');
  });

  it('calls it horizontal when only one side slopes', () => {
    const channel = makeChannel([100, 102, 105], [110, 110.2, 109.9]);
    expect(classifyChannelDirection(channel)).toBe('horizontal');
  });
});

describe('channelDirectionWarning', () => {
  it('warns only for descending channels', () => {
    expect(channelDirectionWarning('descending')).toContain('increased risk');
    expect(channelDirectionWarning('ascending')).toBeNull();
    expect(channelDirectionWarning('horizontal')).toBeNull();
  });
});
