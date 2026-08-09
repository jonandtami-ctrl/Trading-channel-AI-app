import { findPivots } from './pivots';
import { clusterLevels } from './levels';
import { detectChannels } from './channels';
import { generateAlerts } from './alerts';
import { computeBestTradePlan, type TradePlan } from './tradePlan';
import { findStableChannel } from './stability';
import type { Alert, Candle, ScanResult } from './types';

export function scanSymbol(symbol: string, candles: Candle[], isLive: boolean): ScanResult {
  const pivots = findPivots(candles, 5);
  const levels = clusterLevels(pivots);
  const channels = detectChannels(candles, levels);
  const alerts = generateAlerts(symbol, candles, channels);
  const tradePlan = computeBestTradePlan(symbol, candles, channels);
  const stability = findStableChannel(candles, channels);
  return { symbol, candles, channels, alerts, isLive, tradePlan, stability };
}

/** Urgency ranking used to sort the watchlist: breakouts first, then near a level, calm last. */
export function urgencyScore(result: ScanResult): number {
  const hasBreakout = result.alerts.some((a) => a.type === 'breakout' || a.type === 'breakdown');
  if (hasBreakout) return 0;

  const hasApproach = result.alerts.some(
    (a) => a.type === 'approaching_resistance' || a.type === 'approaching_support'
  );
  if (hasApproach) return 1;

  const hasBounce = result.alerts.some((a) => a.type === 'bounce_support' || a.type === 'bounce_resistance');
  if (hasBounce) return 2;

  const hasActiveChannel = result.channels.some((c) => c.status === 'active');
  if (hasActiveChannel) return 3;

  return 4;
}

export type Signal = 'buy' | 'sell' | 'watch_support' | 'watch_resistance' | null;

const GREEN_STATUSES: TradePlan['finalStatus'][] = ['high_quality_setup', 'confirmed_setup'];

/** Reads a call straight off a trade plan — the plan already encodes confirmation, quality, and risk/reward. */
function signalFromTradePlan(plan: TradePlan): Signal {
  if (plan.channelState === 'bouncing_from_support' && GREEN_STATUSES.includes(plan.finalStatus)) return 'buy';
  if (plan.channelState === 'channel_breakdown' || plan.channelState === 'trending_below_channel') return 'sell';
  if (plan.channelState === 'at_support') return 'watch_support';
  if (plan.channelState === 'approaching_resistance' || plan.channelState === 'testing_resistance') {
    return 'watch_resistance';
  }
  return null;
}

/**
 * Turns a result into a single trade call. When a trade plan is
 * available (see tradePlan.ts), the call comes straight from it — a BUY
 * requires a genuinely confirmed, quality-gated support bounce, not just
 * any bounce alert, following the "structure -> confirmation -> risk ->
 * reward -> entry" discipline instead of firing on a raw price event.
 * Falls back to the simpler alert-based read when no plan is attached
 * (e.g. in tests that construct a ScanResult directly).
 */
export function getSignal(result: ScanResult): Signal {
  if (result.tradePlan) return signalFromTradePlan(result.tradePlan);

  if (result.alerts.some((a) => a.type === 'bounce_support')) return 'buy';
  if (result.alerts.some((a) => a.type === 'breakdown' || a.type === 'bounce_resistance')) return 'sell';
  if (result.alerts.some((a) => a.type === 'approaching_support')) return 'watch_support';
  if (result.alerts.some((a) => a.type === 'approaching_resistance')) return 'watch_resistance';
  return null;
}

/** Filters results down to one signal bucket, nearest-to-actionable first. */
export function bySignal(results: ScanResult[], signal: Signal, cap = Infinity): ScanResult[] {
  return results
    .filter((r) => getSignal(r) === signal)
    .sort((a, b) => closestLevelDistance(a) - closestLevelDistance(b))
    .slice(0, cap);
}

/** Smallest current distance (as a fraction of price) from the last close to any alert's level. */
export function closestLevelDistance(result: ScanResult): number {
  const last = result.candles[result.candles.length - 1];
  if (!last || result.alerts.length === 0) return Infinity;
  return Math.min(...result.alerts.map((a) => Math.abs(last.close - a.levelPrice) / last.close));
}

export type StrengthTier = 'high' | 'medium' | 'low' | null;

/** Buckets how big a confirmed move (breakout/breakdown/bounce) has been so far. */
export function classifyStrength(strengthPct: number | undefined | null): StrengthTier {
  if (strengthPct == null) return null;
  if (strengthPct >= 10) return 'high';
  if (strengthPct >= 5) return 'medium';
  if (strengthPct >= 1) return 'low';
  return null;
}

export type RiskLevel = 'high' | 'medium' | 'low';

/**
 * Risk read for a BUY/SELL call: how much of the channel's total room the
 * move has already used up. A move that's already covered most of the
 * channel's width has little room left before hitting the other side —
 * chasing it is higher risk than catching a fresh, small move with the
 * whole channel still ahead of it.
 */
export function assessRisk(strengthPct: number, widthPct: number): RiskLevel {
  if (widthPct <= 0) return 'medium';
  const consumed = strengthPct / widthPct;
  if (consumed >= 0.7) return 'high';
  if (consumed >= 0.35) return 'medium';
  return 'low';
}

export interface SignalDetail {
  signal: Signal;
  strengthPct: number | null;
  strengthTier: StrengthTier;
  risk: RiskLevel | null;
}

const BUY_TYPES: Alert['type'][] = ['bounce_support'];
const SELL_TYPES: Alert['type'][] = ['breakdown', 'bounce_resistance'];

/** Full picture for a BUY/SELL result: the call, how strong the move is, and the risk of chasing it. */
export function getSignalDetail(result: ScanResult): SignalDetail {
  const signal = getSignal(result);
  if (signal !== 'buy' && signal !== 'sell') {
    return { signal, strengthPct: null, strengthTier: null, risk: null };
  }

  const relevantTypes = signal === 'buy' ? BUY_TYPES : SELL_TYPES;
  const alert = result.alerts.find((a) => relevantTypes.includes(a.type) && a.strengthPct != null);
  if (!alert || alert.strengthPct == null) {
    return { signal, strengthPct: null, strengthTier: null, risk: null };
  }

  const channel = result.channels.find(
    (c) =>
      Math.abs(c.support.price - alert.levelPrice) < 0.01 * c.support.price ||
      Math.abs(c.resistance.price - alert.levelPrice) < 0.01 * c.resistance.price
  );

  return {
    signal,
    strengthPct: alert.strengthPct,
    strengthTier: classifyStrength(alert.strengthPct),
    risk: channel ? assessRisk(alert.strengthPct, channel.widthPct) : null,
  };
}
