import { describe, expect, it } from 'vitest';
import { buildRiskRewardPlan, simulateStopScenarios } from '../profitManagement';
import type { Candle } from '../types';

const DAY = 86400;

describe('buildRiskRewardPlan', () => {
  it('places the stop below structure (support), not at an arbitrary fixed percent of entry', () => {
    const plan = buildRiskRewardPlan({ support: 100, resistance: 120, currentPrice: 101 });
    expect(plan.stopPrice).toBeLessThan(100);
    expect(plan.stopPrice).toBeCloseTo(100 * 0.98, 2);
  });

  it('includes slippage and commission drag rather than a frictionless fill', () => {
    const plan = buildRiskRewardPlan({ support: 100, resistance: 120, currentPrice: 100, slippagePct: 0.1, commissionPct: 0.05 });
    expect(plan.entryPrice).toBeGreaterThan(100);
  });

  it('flags when the minimum reward:risk bar is not met', () => {
    // Support 100, resistance 100.5 (barely any room) with a wide stop buffer -> poor R:R.
    const plan = buildRiskRewardPlan({ support: 100, resistance: 100.5, currentPrice: 100.3, structuralStopBufferPct: 5, minRewardToRisk: 3 });
    expect(plan.meetsMinimum).toBe(false);
  });

  it('meets the minimum for a wide, cheaply-stopped setup', () => {
    const plan = buildRiskRewardPlan({ support: 100, resistance: 150, currentPrice: 101, structuralStopBufferPct: 1, minRewardToRisk: 3 });
    expect(plan.meetsMinimum).toBe(true);
  });
});

function flatCandles(count: number, price: number): Candle[] {
  return Array.from({ length: count }, (_, i) => ({ time: i * DAY, open: price, high: price + 0.2, low: price - 0.2, close: price, volume: 1_000_000 }));
}

describe('simulateStopScenarios', () => {
  it('stops out the structural scenario when price falls through the initial stop', () => {
    const candles = flatCandles(30, 100);
    for (let i = 10; i < 30; i++) candles[i] = { ...candles[i], close: 90, low: 89, high: 90.5 };
    const outcomes = simulateStopScenarios(candles, 5, 100, 97, 110, 120);
    const structural = outcomes.find((o) => o.scenario === 'structural')!;
    expect(structural.exitReason).toBe('stopped_out');
    expect(structural.fullPositionPnlPct).toBeLessThan(0);
  });

  it('hits target2 and reports a positive P/L when price rallies through both targets', () => {
    const candles = flatCandles(30, 100);
    for (let i = 10; i < 30; i++) candles[i] = { ...candles[i], close: 125, high: 126, low: 124 };
    const outcomes = simulateStopScenarios(candles, 5, 100, 97, 110, 120);
    const structural = outcomes.find((o) => o.scenario === 'structural')!;
    expect(structural.exitReason).toBe('target2_hit');
    expect(structural.fullPositionPnlPct).toBeGreaterThan(0);
    expect(structural.target1Hit).toBe(true);
  });

  it('breakeven_after_t1 avoids a loss once Target 1 has been reached, unlike the structural stop', () => {
    const candles = flatCandles(40, 100);
    // Rally through target1 (110), then reverse hard and fall all the way back down.
    for (let i = 5; i < 15; i++) candles[i] = { ...candles[i], close: 112, high: 113, low: 111 };
    for (let i = 15; i < 40; i++) candles[i] = { ...candles[i], close: 90, low: 89, high: 91 };
    const outcomes = simulateStopScenarios(candles, 0, 100, 97, 110, 120);
    const structural = outcomes.find((o) => o.scenario === 'structural')!;
    const breakeven = outcomes.find((o) => o.scenario === 'breakeven_after_t1')!;
    expect(structural.fullPositionPnlPct).toBeLessThan(0);
    expect(breakeven.fullPositionPnlPct).toBeGreaterThanOrEqual(0);
  });

  it('leaves a position open (still_open) when neither the stop nor target2 is ever hit', () => {
    // A gentle, genuinely-moving drift rather than perfectly flat candles —
    // on flat data the swing_low scenario's trailing low degenerately
    // equals the current candle's own low and "stops out" immediately,
    // which is correct behavior for that edge case but not what this test
    // is after (a realistic, clearly-still-open position).
    const candles = Array.from({ length: 10 }, (_, i) => {
      const price = 100 + i * 0.05;
      return { time: i * DAY, open: price, high: price + 0.3, low: price - 0.3, close: price, volume: 1_000_000 };
    });
    const outcomes = simulateStopScenarios(candles, 0, 100, 90, 110, 120);
    expect(outcomes.every((o) => o.exitReason === 'still_open')).toBe(true);
  });
});
