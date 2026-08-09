import { describe, expect, it } from 'vitest';
import { findPivots } from '../pivots';
import { clusterLevels } from '../levels';
import { detectChannels } from '../channels';
import type { Candle } from '../types';

/** Builds a synthetic series that oscillates between `low` and `high` for `length` candles. */
function buildChannelCandles(low: number, high: number, length: number): Candle[] {
  const candles: Candle[] = [];
  const mid = (low + high) / 2;
  const amp = (high - low) / 2;
  for (let i = 0; i < length; i++) {
    const close = mid + amp * Math.sin(i * 0.9) * 0.96;
    candles.push({
      time: i,
      open: close,
      high: Math.min(close + amp * 0.1, high),
      low: Math.max(close - amp * 0.1, low),
      close,
    });
  }
  return candles;
}

describe('detectChannels', () => {
  it('finds an active channel in a clean, fast-cycling oscillating series', () => {
    const candles = buildChannelCandles(100, 110, 20);
    const pivots = findPivots(candles, 3);
    const levels = clusterLevels(pivots);
    const channels = detectChannels(candles, levels);

    expect(channels.length).toBeGreaterThan(0);
    const channel = channels[0];
    expect(channel.status).toBe('active');
    expect(channel.support.price).toBeLessThan(channel.resistance.price);
    expect(channel.widthPct).toBeGreaterThanOrEqual(1);
    expect(channel.widthPct).toBeLessThanOrEqual(15);
  });

  it('flags a channel as broken once price closes decisively above resistance', () => {
    const base = buildChannelCandles(100, 110, 20);
    const breakout: Candle[] = [
      ...base,
      { time: 20, open: 110, high: 118, low: 109, close: 117 },
    ];
    const pivots = findPivots(breakout, 3);
    const levels = clusterLevels(pivots);
    const channels = detectChannels(breakout, levels);

    expect(channels.length).toBeGreaterThan(0);
    expect(channels[0].status).toBe('broken');
    expect(channels[0].brokenDirection).toBe('up');
  });

  it('does not report a channel for a straight uptrend with no consolidation', () => {
    const candles: Candle[] = Array.from({ length: 60 }, (_, i) => ({
      time: i,
      open: 100 + i,
      high: 100 + i + 1,
      low: 100 + i - 1,
      close: 100 + i,
    }));
    const pivots = findPivots(candles, 3);
    const levels = clusterLevels(pivots);
    const channels = detectChannels(candles, levels);
    expect(channels).toHaveLength(0);
  });

  it('rejects a channel whose touches are spread across months, not a swing-tradable span', () => {
    // Same shape as the fast-cycling series above, just stretched out so its
    // first and last touch are ~60 candles apart — a multi-month range, not
    // something that resolves in a day/week/month swing.
    const candles = buildChannelCandles(100, 110, 60);
    const pivots = findPivots(candles, 3);
    const levels = clusterLevels(pivots);
    const channels = detectChannels(candles, levels);
    expect(channels).toHaveLength(0);
  });

  it('allows a longer span when the caller opts out of the swing cap', () => {
    const candles = buildChannelCandles(100, 110, 60);
    const pivots = findPivots(candles, 3);
    const levels = clusterLevels(pivots);
    const channels = detectChannels(candles, levels, { maxSpanCandles: Infinity });
    expect(channels.length).toBeGreaterThan(0);
  });
});
