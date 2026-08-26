import { describe, expect, it } from 'vitest';
import { detectSupportSweepReclaim } from '../supportSweepReclaim';
import type { Candle, Channel, Level } from '../types';

function candle(open: number, high: number, low: number, close: number): Candle {
  return { time: 0, open, high, low, close };
}

const SUPPORT = 100;
const RESISTANCE = 120;

function level(price: number, type: 'support' | 'resistance'): Level {
  return { price, type, touches: [] };
}

function baseChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    support: level(SUPPORT, 'support'),
    resistance: level(RESISTANCE, 'resistance'),
    widthPct: 20,
    containmentPct: 90,
    status: 'active',
    lastTouchIndex: 0,
    ...overrides,
  };
}

/** 30 calm candles comfortably mid-channel with a constant TR of 2, so ATR converges cleanly by the time the event candles start. */
function baseline(count = 30): Candle[] {
  return Array.from({ length: count }, () => candle(105, 106, 104, 105));
}

describe('detectSupportSweepReclaim', () => {
  it('detects a clean sweep -> reclaim -> confirmation sequence', () => {
    const candles = [
      ...baseline(30),
      candle(101, 101.5, 98, 99), // sweep: dips below support, closes below
      candle(99.5, 102, 100.5, 101.2), // reclaim: low back above support, closes above it
      candle(101.5, 103.5, 101, 103), // confirmation: closes higher than reclaim, bullish
    ];

    const result = detectSupportSweepReclaim(candles, baseChannel());
    expect(result).not.toBeNull();
    expect(result!.sweepIndex).toBe(30);
    expect(result!.sweepLow).toBe(98);
    expect(result!.reclaimIndex).toBe(31);
    expect(result!.confirmationIndex).toBe(32);
    expect(result!.sweepDepthAtr).toBeCloseTo(1, 1);
    expect(result!.roomToResistanceFraction).toBeGreaterThan(0.35);
  });

  it('does not fire on the first touch of support with no sweep below it', () => {
    // Classic "touched support and closed higher" — exactly the pattern this setup exists to reject.
    const candles = [...baseline(30), candle(101, 101.5, 100, 100.5), candle(100.5, 102, 100, 101.5)];
    expect(detectSupportSweepReclaim(candles, baseChannel())).toBeNull();
  });

  it('does not fire while price is still below support (no reclaim yet)', () => {
    const candles = [...baseline(30), candle(101, 101.5, 98, 99), candle(99, 99.5, 97, 98)];
    expect(detectSupportSweepReclaim(candles, baseChannel())).toBeNull();
  });

  it('rejects a sweep that goes too deep relative to ATR (real breakdown, not a shakeout)', () => {
    const candles = [
      ...baseline(30),
      candle(101, 101.5, 92, 93), // ~4 ATR below support — too deep
      candle(93.5, 101, 92.5, 100.5),
      candle(101, 103, 100, 102.5),
    ];
    expect(detectSupportSweepReclaim(candles, baseChannel())).toBeNull();
  });

  it('rejects a negligible dip below support (noise, not a real sweep)', () => {
    const candles = [
      ...baseline(30),
      candle(101, 101.2, 99.98, 100.5), // 0.01 below support — far under the minimum ATR depth
      candle(100.5, 102, 100.2, 101.5),
    ];
    expect(detectSupportSweepReclaim(candles, baseChannel())).toBeNull();
  });

  it('rejects the setup when there is not enough room left to resistance', () => {
    const nearResistanceChannel = baseChannel({ resistance: level(103, 'resistance') });
    const candles = [
      ...baseline(30).map(() => candle(101, 102, 100.5, 101)),
      candle(101, 101.5, 98, 99),
      candle(99.5, 102.5, 100.5, 101.2),
      candle(101.5, 103, 101, 102.9), // confirmed, but right up against resistance at 103
    ];
    expect(detectSupportSweepReclaim(candles, nearResistanceChannel)).toBeNull();
  });

  it('returns null when the channel is not active', () => {
    const candles = [
      ...baseline(30),
      candle(101, 101.5, 98, 99),
      candle(99.5, 102, 100.5, 101.2),
      candle(101.5, 103.5, 101, 103),
    ];
    expect(detectSupportSweepReclaim(candles, baseChannel({ status: 'broken', brokenDirection: 'down' }))).toBeNull();
  });

  it('returns null when there is not enough history yet', () => {
    const candles = [candle(101, 101.5, 98, 99), candle(99.5, 102, 100.5, 101.2)];
    expect(detectSupportSweepReclaim(candles, baseChannel())).toBeNull();
  });
});
