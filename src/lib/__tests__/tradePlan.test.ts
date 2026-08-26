import { describe, expect, it } from 'vitest';
import { computeTradePlan, computeBestTradePlan } from '../tradePlan';
import type { Candle, Channel, Pivot } from '../types';

function c(close: number, overrides: Partial<Candle> = {}): Candle {
  return { time: 0, open: close, high: close + 0.3, low: close - 0.3, close, ...overrides };
}

function touch(index: number, price: number, type: Pivot['type']): Pivot {
  return { index, time: index, price, type };
}

function baseChannel(
  support: number,
  resistance: number,
  status: 'active' | 'broken' = 'active',
  brokenDirection?: 'up' | 'down'
): Channel {
  return {
    support: {
      price: support,
      type: 'support',
      touches: [touch(0, support, 'low'), touch(5, support, 'low'), touch(10, support, 'low')],
    },
    resistance: {
      price: resistance,
      type: 'resistance',
      touches: [touch(2, resistance, 'high'), touch(7, resistance, 'high'), touch(12, resistance, 'high')],
    },
    widthPct: ((resistance - support) / support) * 100,
    containmentPct: 92,
    status,
    brokenDirection,
    lastTouchIndex: 12,
  };
}

describe('computeTradePlan — channel state detection', () => {
  it('recognizes a confirmed bounce off support (spec example 32)', () => {
    const channel = baseChannel(100, 110);
    const candles: Candle[] = [c(103, { low: 99.9, close: 99.9 }), c(100, { low: 99.7, close: 100.0 }), c(100.6, { low: 99.8 }), c(101.2, { low: 100.3 })];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('bouncing_from_support');
    expect(plan.entryQuality).toBe('excellent');
    expect(plan.setupType).toBe('Channel bounce');
    expect(plan.stopLoss).toBeLessThan(channel.support.price);
    expect(plan.target1).toBe(110);
    expect(plan.riskRewardRatio).toBeGreaterThan(2);
    expect(['high_quality_setup', 'confirmed_setup']).toContain(plan.finalStatus);
    expect(plan.finalStatusLabel).toContain('🟢');
  });

  it('calls it AT_SUPPORT (not yet a confirmed bounce) when price hasn’t reversed', () => {
    const channel = baseChannel(100, 110);
    // Still declining into support, no reversal yet.
    const candles: Candle[] = [c(103), c(102), c(101), c(100.3, { low: 99.9 })];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('at_support');
    expect(plan.confirmationNeeded).toContain('confirmation');
    expect(plan.finalStatus).toBe('watch');
  });

  it('recognizes a breakout attempt — single candle over resistance, not confirmed yet (spec example 33)', () => {
    const channel = baseChannel(100, 110, 'broken', 'up');
    const candles: Candle[] = [c(108), c(109), c(112)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('breakout_attempt');
    expect(plan.finalStatus).toBe('breakout_attempt');
    expect(plan.finalStatusLabel).toContain('🟡');
  });

  it('recognizes a confirmed breakout once subsequent candles hold above resistance (spec example 34)', () => {
    const channel = baseChannel(100, 110, 'broken', 'up');
    const candles: Candle[] = [c(108), c(109), c(112), c(113), c(114)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('confirmed_breakout');
    expect(plan.setupType).toBe('Breakout');
    expect(plan.target1).toBeGreaterThan(channel.resistance.price);
  });

  it('recognizes a successful breakout retest (spec example 35)', () => {
    const channel = baseChannel(100, 110, 'broken', 'up');
    // Breaks out, dips back to resistance, then holds above it for 2+ candles.
    const candles: Candle[] = [c(108), c(109), c(112.6), c(109.5), c(110.5), c(111.5)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('breakout_retest');
    expect(plan.setupType).toBe('Breakout retest');
  });

  it('recognizes a false breakout — price reached over resistance then fell back inside (spec example 36)', () => {
    const channel = baseChannel(100, 110); // still active per channels.ts since last close settled back inside
    const candles: Candle[] = [c(108), c(109), c(112.4), c(110.9), c(109.5), c(108)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('false_breakout');
    expect(plan.finalStatus).toBe('invalidated_setup');
    expect(plan.finalStatusLabel).toContain('🔴');
  });

  it('recognizes a channel breakdown', () => {
    const channel = baseChannel(100, 110, 'broken', 'down');
    const candles: Candle[] = [c(102), c(101), c(97)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('channel_breakdown');
    expect(plan.finalStatus).toBe('channel_breakdown');
    expect(plan.setupType).toBe('None');
  });

  it('calls it MID_CHANNEL / NO_TRADE when price is nowhere near either edge', () => {
    const channel = baseChannel(100, 110);
    const candles: Candle[] = [c(104), c(105), c(105.2), c(105)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('mid_channel');
    expect(plan.finalStatus).toBe('no_trade');
  });
});

describe('computeTradePlan — entry quality (spec point 27 examples)', () => {
  const channel = baseChannel(38, 42);

  it('rates a confirmed bounce entry right off support as excellent', () => {
    // Touches support with a low wick, then closes progressively higher: a confirmed reversal.
    const candles: Candle[] = [c(37.8, { low: 37.6 }), c(37.9, { low: 37.7 }), c(38.0, { low: 37.75 }), c(38.3, { low: 38.0 })];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('bouncing_from_support');
    expect(plan.entryQuality).toBe('excellent');
  });

  it('rates a mid-channel entry as late, not excellent', () => {
    // Force a confirmed-breakout style state so entryQuality is actually computed regardless of proximity.
    const brokenChannel = baseChannel(38, 42, 'broken', 'up');
    const candles: Candle[] = [c(40), c(40.3, { low: 39.8 }), c(42.5), c(43), c(40.5)];
    // 40.5 is well through the 38-42 channel width relative to support -> should not be excellent.
    const plan = computeTradePlan('XYZ', candles, brokenChannel);
    expect(plan.entryQuality).not.toBe('excellent');
  });
});

describe('computeTradePlan — descending channel warning', () => {
  it('warns about descending channels', () => {
    const channel: Channel = {
      support: { price: 100, type: 'support', touches: [touch(0, 105, 'low'), touch(5, 102, 'low'), touch(10, 100, 'low')] },
      resistance: { price: 110, type: 'resistance', touches: [touch(2, 116, 'high'), touch(7, 113, 'high'), touch(12, 110, 'high')] },
      widthPct: 10,
      containmentPct: 90,
      status: 'active',
      lastTouchIndex: 12,
    };
    const candles: Candle[] = [c(103), c(102), c(101), c(100.3, { low: 99.9 })];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.warnings.some((w) => w.includes('Descending channel'))).toBe(true);
  });
});

describe('computeTradePlan — runaway stop distance once price has extended too far from the breakout level', () => {
  it('does not anchor a stop to the old resistance once price has run far past it (trending_above_channel)', () => {
    const channel = baseChannel(100, 110, 'broken', 'up');
    // Broke out long ago and has kept climbing well past the channel — a stop at the old
    // resistance would now sit >30% below current price, not a usable risk figure.
    const candles: Candle[] = [
      c(108), c(109), c(112), c(113), c(115), c(118), c(120), c(122), c(125), c(128), c(132), c(137),
    ];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('trending_above_channel');
    expect(plan.setupType).toBe('None');
    expect(plan.stopLoss).toBeNull();
    expect(plan.target1).toBeNull();
    expect(plan.stopPct).toBeNull();
    expect(plan.confirmationNeeded).toContain('too far');
  });

  it('still gives a real, tight stop/target when a confirmed breakout has not run away yet', () => {
    const channel = baseChannel(100, 110, 'broken', 'up');
    const candles: Candle[] = [c(108), c(109), c(112), c(113), c(114)];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('confirmed_breakout');
    expect(plan.stopLoss).not.toBeNull();
    expect(Math.abs(plan.stopPct!)).toBeLessThan(10);
  });

  it('does not anchor a stop to the old resistance for a breakout_retest that kept climbing away from it', () => {
    const channel = baseChannel(100, 110, 'broken', 'up');
    // Breaks out, dips back to retest resistance (confirming the retest), then runs away.
    const candles: Candle[] = [
      c(108), c(109), c(112.6), c(109.5), c(110.5), c(111.5), c(118), c(125), c(132), c(140),
    ];
    const plan = computeTradePlan('XYZ', candles, channel);
    expect(plan.channelState).toBe('breakout_retest');
    expect(plan.setupType).toBe('None');
    expect(plan.stopLoss).toBeNull();
    expect(plan.confirmationNeeded).toContain('too far');
  });
});

describe('computeBestTradePlan — SUPPORT_SWEEP_RECLAIM setup', () => {
  it('picks the dedicated sweep-reclaim plan over the generic bounce reading for the same channel', () => {
    const channel = baseChannel(100, 120);
    const baseline: Candle[] = Array.from({ length: 30 }, () => c(105, { open: 105, high: 106, low: 104 }));
    const candles: Candle[] = [
      ...baseline,
      c(99, { open: 101, high: 101.5, low: 98 }), // sweep below support
      c(101.2, { open: 99.5, high: 102, low: 100.5 }), // reclaim: closes back above support
      c(103, { open: 101.5, high: 103.5, low: 101 }), // confirmation: bullish, closes higher than reclaim
    ];

    const plan = computeBestTradePlan('XYZ', candles, [channel]);
    expect(plan).not.toBeNull();
    expect(plan!.channelState).toBe('support_sweep_reclaim');
    expect(plan!.finalStatus).toBe('support_sweep_reclaim_confirmed');
    expect(plan!.finalStatusLabel).toContain('🟢');
    // Stop sits just under the actual swept low (98), not the generic flat support*0.98 (98) — anchored to real structure.
    expect(plan!.stopLoss).toBeLessThan(98);
    expect(plan!.stopLoss).toBeGreaterThan(96);
    expect(plan!.target1).toBe(120);
    expect(plan!.riskRewardRatio).toBeGreaterThan(1);
  });

  it('falls back to the generic reading when no sweep-reclaim sequence is present', () => {
    const channel = baseChannel(100, 110);
    const candles: Candle[] = [c(103, { low: 99.9, close: 99.9 }), c(100, { low: 99.7, close: 100.0 }), c(100.6, { low: 99.8 }), c(101.2, { low: 100.3 })];
    const plan = computeBestTradePlan('XYZ', candles, [channel]);
    expect(plan!.channelState).toBe('bouncing_from_support');
  });
});

describe('computeTradePlan — quality score stays within 0-100', () => {
  it('never exceeds the 0-100 range across a variety of states', () => {
    const scenarios: [Channel, Candle[]][] = [
      [baseChannel(100, 110), [c(103), c(102), c(101), c(100.3, { low: 99.9 })]],
      [baseChannel(100, 110, 'broken', 'up'), [c(108), c(109), c(112), c(113), c(114)]],
      [baseChannel(100, 110, 'broken', 'down'), [c(102), c(101), c(97)]],
    ];
    for (const [channel, candles] of scenarios) {
      const plan = computeTradePlan('XYZ', candles, channel);
      expect(plan.qualityScore).toBeGreaterThanOrEqual(0);
      expect(plan.qualityScore).toBeLessThanOrEqual(100);
    }
  });
});
