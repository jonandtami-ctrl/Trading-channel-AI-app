import { describe, expect, it } from 'vitest';
import { findStableChannel } from '../stability';
import type { Candle, Channel, Pivot } from '../types';

/** A perfectly repeating triangle wave — deterministic, equal peaks/troughs every cycle, so classifyTrend reads it as sideways. */
function triangleCandles(count: number, low: number, high: number, period = 20): Candle[] {
  const half = period / 2;
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const phase = i % period;
    const price = phase <= half ? low + ((high - low) * phase) / half : high - ((high - low) * (phase - half)) / half;
    candles.push({ time: i, open: price, high: price + 0.3, low: price - 0.3, close: price });
  }
  return candles;
}

/** Same triangle shape, but each cycle's baseline steps up — highs and lows both trend up, so classifyTrend reads it as an uptrend. */
function ascendingZigzagCandles(count: number, period = 20): Candle[] {
  const half = period / 2;
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const cycle = Math.floor(i / period);
    const baseline = 100 + cycle * 10;
    const low = baseline - 3;
    const high = baseline + 3;
    const phase = i % period;
    const price = phase <= half ? low + ((high - low) * phase) / half : high - ((high - low) * (phase - half)) / half;
    candles.push({ time: i, open: price, high: price + 0.3, low: price - 0.3, close: price });
  }
  return candles;
}

function touch(index: number, price: number, type: Pivot['type']): Pivot {
  return { index, time: index, price, type };
}

function tightChannel(support: number, resistance: number): Channel {
  return {
    support: {
      price: support,
      type: 'support',
      touches: [touch(0, support, 'low'), touch(20, support, 'low'), touch(40, support, 'low')],
    },
    resistance: {
      price: resistance,
      type: 'resistance',
      touches: [touch(10, resistance, 'high'), touch(30, resistance, 'high'), touch(50, resistance, 'high')],
    },
    widthPct: ((resistance - support) / support) * 100,
    containmentPct: 90,
    status: 'active',
    lastTouchIndex: 50,
  };
}

describe('findStableChannel', () => {
  it('flags a tight, long-established, sideways channel as stable', () => {
    const candles = triangleCandles(120, 97, 103);
    const channel = tightChannel(97, 103);
    const info = findStableChannel(candles, [channel]);
    expect(info).not.toBeNull();
    expect(info!.support).toBe(97);
    expect(info!.resistance).toBe(103);
    expect(info!.widthPct).toBeCloseTo(channel.widthPct);
    expect(info!.touchCount).toBe(6);
    expect(info!.candleCount).toBe(120);
  });

  it('returns null when there is not enough history yet', () => {
    const candles = triangleCandles(60, 97, 103);
    const channel = tightChannel(97, 103);
    expect(findStableChannel(candles, [channel])).toBeNull();
  });

  it('returns null when the channel is too wide to call "stable"', () => {
    const candles = triangleCandles(120, 80, 120);
    const channel = tightChannel(80, 120);
    expect(findStableChannel(candles, [channel])).toBeNull();
  });

  it('returns null when one side does not have enough touches', () => {
    const candles = triangleCandles(120, 97, 103);
    const channel = tightChannel(97, 103);
    channel.support.touches = channel.support.touches.slice(0, 1);
    expect(findStableChannel(candles, [channel])).toBeNull();
  });

  it('returns null once the channel has broken', () => {
    const candles = triangleCandles(120, 97, 103);
    const channel = tightChannel(97, 103);
    channel.status = 'broken';
    expect(findStableChannel(candles, [channel])).toBeNull();
  });

  it('returns null for a symbol that is actually trending, not going nowhere', () => {
    const candles = ascendingZigzagCandles(120);
    const channel = tightChannel(127, 133);
    expect(findStableChannel(candles, [channel])).toBeNull();
  });

  it('returns null when price has already slipped outside the band, even if status is still "active"', () => {
    // detectChannels allows price up to 1% past support/resistance before flipping
    // to "broken" (useful slack for a swing-trade call) — but a "stable range" is a
    // claim that price sits inside these numbers right now, so that slack shouldn't
    // apply here.
    const candles = triangleCandles(120, 97, 103);
    candles[candles.length - 1] = { ...candles[candles.length - 1], close: 96.5 };
    const channel = tightChannel(97, 103);
    expect(findStableChannel(candles, [channel])).toBeNull();
  });

  it('picks the most contained candidate when multiple channels qualify', () => {
    const candles = triangleCandles(120, 97, 103);
    const weaker = { ...tightChannel(96, 104), containmentPct: 80 };
    const stronger = { ...tightChannel(97, 103), containmentPct: 95 };
    const info = findStableChannel(candles, [weaker, stronger]);
    expect(info).not.toBeNull();
    expect(info!.widthPct).toBeCloseTo(stronger.widthPct);
  });
});
