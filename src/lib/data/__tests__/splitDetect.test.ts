import { describe, expect, it } from 'vitest';
import { trimAtSplitDiscontinuity } from '../splitDetect';
import type { Candle } from '../../types';

function candle(close: number, time = 0): Candle {
  return { time, open: close, high: close, low: close, close };
}

describe('trimAtSplitDiscontinuity', () => {
  it('leaves a normal, internally-consistent series untouched', () => {
    const candles = [candle(100), candle(102), candle(98), candle(101), candle(103)];
    expect(trimAtSplitDiscontinuity(candles)).toEqual(candles);
  });

  it('drops everything before a reverse-split-sized jump up', () => {
    // Pre-split candles trade around $40; a reverse split then jumps the raw,
    // unadjusted close to ~$230 with nothing between to explain it.
    const preSplit = [candle(41), candle(40), candle(42)];
    const postSplit = [candle(233), candle(230), candle(235)];
    const result = trimAtSplitDiscontinuity([...preSplit, ...postSplit]);
    expect(result).toEqual(postSplit);
  });

  it('drops everything before a forward-split-sized jump down', () => {
    const preSplit = [candle(500), candle(510)];
    const postSplit = [candle(50), candle(52), candle(49)];
    const result = trimAtSplitDiscontinuity([...preSplit, ...postSplit]);
    expect(result).toEqual(postSplit);
  });

  it('keeps only the segment after the most recent jump when there are multiple', () => {
    const first = [candle(400)];
    const second = [candle(40), candle(41)];
    const third = [candle(230), candle(228)];
    const result = trimAtSplitDiscontinuity([...first, ...second, ...third]);
    expect(result).toEqual(third);
  });

  it('does not treat ordinary volatility as a split', () => {
    // A 2x leveraged ETF can easily move 15-20% in a day — nowhere near the
    // 2.5x/0.4x band that actually signals an unadjusted split.
    const candles = [candle(100), candle(122), candle(95), candle(108)];
    expect(trimAtSplitDiscontinuity(candles)).toEqual(candles);
  });
});
