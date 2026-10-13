import type { Candle } from './types';
import { calculateATR } from './atr';

/**
 * Risk/reward planning (item 10) and partial-profit management (item 11).
 * The stop is always structural (below support, with a configurable
 * buffer) — never an arbitrary fixed percent of entry price — and the
 * entry/target math includes slippage and commission drag so the reward:risk
 * ratio isn't flattering itself with frictionless fills. None of this
 * executes a trade; it's a planning calculation only.
 */

export interface RiskRewardPlan {
  entryPrice: number;
  stopPrice: number;
  stopDistancePct: number;
  target1: number;
  target2: number;
  rewardToRisk1: number | null;
  rewardToRisk2: number | null;
  meetsMinimum: boolean;
}

const DEFAULT_MIN_REWARD_RISK = 3;
const DEFAULT_STRUCTURAL_STOP_BUFFER_PCT = 2;
const DEFAULT_SLIPPAGE_PCT = 0.1;
const DEFAULT_COMMISSION_PCT = 0.05; // per leg; applied twice below for a round trip

export function buildRiskRewardPlan(args: {
  support: number;
  resistance: number;
  currentPrice: number;
  structuralStopBufferPct?: number;
  minRewardToRisk?: number;
  slippagePct?: number;
  commissionPct?: number;
}): RiskRewardPlan {
  const structuralStopBufferPct = args.structuralStopBufferPct ?? DEFAULT_STRUCTURAL_STOP_BUFFER_PCT;
  const minRewardToRisk = args.minRewardToRisk ?? DEFAULT_MIN_REWARD_RISK;
  const slippagePct = args.slippagePct ?? DEFAULT_SLIPPAGE_PCT;
  const commissionPct = args.commissionPct ?? DEFAULT_COMMISSION_PCT;

  // A market/stop-entry doesn't fill at the exact last price — a small
  // slippage allowance makes the planned entry realistic rather than best-case.
  const entryPrice = args.currentPrice * (1 + slippagePct / 100);
  const stopPrice = args.support * (1 - structuralStopBufferPct / 100);
  const channelHeight = args.resistance - args.support;
  const target1 = args.support + channelHeight * 0.5;
  const target2 = args.resistance;

  const riskPerShare = entryPrice - stopPrice;
  const costDrag = entryPrice * (commissionPct / 100) * 2; // round-trip commission estimate

  const reward1 = target1 - entryPrice - costDrag;
  const reward2 = target2 - entryPrice - costDrag;

  const rewardToRisk1 = riskPerShare > 0 ? reward1 / riskPerShare : null;
  const rewardToRisk2 = riskPerShare > 0 ? reward2 / riskPerShare : null;
  const stopDistancePct = entryPrice > 0 ? ((entryPrice - stopPrice) / entryPrice) * 100 : 0;

  return {
    entryPrice,
    stopPrice,
    stopDistancePct,
    target1,
    target2,
    rewardToRisk1,
    rewardToRisk2,
    meetsMinimum: rewardToRisk1 != null && rewardToRisk1 >= minRewardToRisk,
  };
}

export type StopScenario = 'structural' | 'breakeven_after_t1' | 'atr_trailing' | 'swing_low';

export const STOP_SCENARIO_LABELS: Record<StopScenario, string> = {
  structural: 'Original structural stop',
  breakeven_after_t1: 'Breakeven stop after Target 1',
  atr_trailing: 'ATR trailing stop',
  swing_low: 'Stop below a recent higher swing low',
};

export interface ScenarioOutcome {
  scenario: StopScenario;
  exitIndex: number | null;
  exitPrice: number | null;
  exitReason: 'stopped_out' | 'target2_hit' | 'still_open';
  /** P/L on the full position, as if nothing was sold at Target 1. */
  fullPositionPnlPct: number | null;
  /** P/L if 50% was sold at Target 1 and the rest followed this scenario's stop — the spec's default partial-profit plan. Equal to fullPositionPnlPct when Target 1 was never reached. */
  partialProfitPnlPct: number | null;
  target1Hit: boolean;
}

const DEFAULT_ATR_TRAIL_MULTIPLE = 2;
const SWING_LOW_LOOKBACK_BARS = 5;

/**
 * Walks forward candle-by-candle from the entry, applying each stop-
 * management scenario's own update rule, and reports where/how each would
 * have actually exited — a real simulation against the historical candles
 * that follow entryIndex, not a static label. Only uses information from
 * entryIndex onward (no look-ahead into data the stop rule wouldn't have
 * had yet at that point in time).
 */
export function simulateStopScenarios(
  candles: Candle[],
  entryIndex: number,
  entryPrice: number,
  initialStop: number,
  target1: number,
  target2: number,
  atrTrailMultiple = DEFAULT_ATR_TRAIL_MULTIPLE
): ScenarioOutcome[] {
  const atrSeries = calculateATR(candles, 14);
  const scenarios: StopScenario[] = ['structural', 'breakeven_after_t1', 'atr_trailing', 'swing_low'];
  return scenarios.map((scenario) => simulateOne(scenario));

  function pnlPct(exitPrice: number): number {
    return ((exitPrice - entryPrice) / entryPrice) * 100;
  }

  function blendedPnl(target1Hit: boolean, finalExitPrice: number): number {
    if (!target1Hit) return pnlPct(finalExitPrice);
    return 0.5 * pnlPct(target1) + 0.5 * pnlPct(finalExitPrice);
  }

  function simulateOne(scenario: StopScenario): ScenarioOutcome {
    let stop = initialStop;
    let target1Hit = false;
    let highestClose = entryPrice;
    let recentSwingLow = initialStop;

    for (let i = entryIndex + 1; i < candles.length; i++) {
      const c = candles[i];
      highestClose = Math.max(highestClose, c.close);

      if (scenario === 'atr_trailing') {
        const atr = atrSeries[i];
        if (atr && !Number.isNaN(atr)) stop = Math.max(stop, highestClose - atr * atrTrailMultiple);
      }
      if (scenario === 'swing_low' && i - entryIndex > SWING_LOW_LOOKBACK_BARS) {
        const trailing = candles.slice(i - SWING_LOW_LOOKBACK_BARS, i).map((x) => x.low);
        const candidateLow = Math.min(...trailing);
        if (candidateLow > recentSwingLow) {
          stop = Math.max(stop, candidateLow);
          recentSwingLow = candidateLow;
        }
      }

      if (c.low <= stop) {
        return {
          scenario,
          exitIndex: i,
          exitPrice: stop,
          exitReason: 'stopped_out',
          fullPositionPnlPct: pnlPct(stop),
          partialProfitPnlPct: blendedPnl(target1Hit, stop),
          target1Hit,
        };
      }
      if (!target1Hit && c.high >= target1) {
        target1Hit = true;
        if (scenario === 'breakeven_after_t1') stop = Math.max(stop, entryPrice);
      }
      if (c.high >= target2) {
        return {
          scenario,
          exitIndex: i,
          exitPrice: target2,
          exitReason: 'target2_hit',
          fullPositionPnlPct: pnlPct(target2),
          partialProfitPnlPct: blendedPnl(target1Hit, target2),
          target1Hit,
        };
      }
    }

    return {
      scenario,
      exitIndex: null,
      exitPrice: null,
      exitReason: 'still_open',
      fullPositionPnlPct: null,
      partialProfitPnlPct: null,
      target1Hit,
    };
  }
}
