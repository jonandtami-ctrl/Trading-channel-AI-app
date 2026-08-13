import { findPivots } from './pivots';
import { clusterLevels } from './levels';
import { detectChannels } from './channels';
import { generateAlerts } from './alerts';
import { computeBestTradePlan, type TradePlan } from './tradePlan';
import { findStableChannel } from './stability';
import type { Alert, Candle, ScanResult } from './types';

// A blue-chip stock genuinely takes longer to complete a support/resistance
// round-trip than a fast-moving crypto or leveraged ETF — the ~1-month swing
// cap below excludes almost all of them from ever showing an "active
// channel," pushing them into the stability check instead (which requires
// an even longer, tighter, already-well-established range). This wider cap
// — roughly 6 months of trading days — sits in between: long enough for a
// slow blue-chip mover to actually complete a range, short enough to still
// be a channel worth watching rather than "this stock has gone nowhere for
// years." Used only for the Buffett-style value view, not swing calls.
const VALUE_MAX_SPAN_CANDLES = 130;

export function scanSymbol(symbol: string, candles: Candle[], isLive: boolean): ScanResult {
  const pivots = findPivots(candles, 5);
  const levels = clusterLevels(pivots);
  // Swing-tradable channels only — span capped to roughly a month, so every
  // BUY/SELL/WATCH call and chart annotation reflects a range that can
  // realistically resolve within a day-to-month holding period.
  const channels = detectChannels(candles, levels);
  const alerts = generateAlerts(symbol, candles, channels);
  const tradePlan = computeBestTradePlan(symbol, candles, channels);
  // Stability is deliberately the opposite of a swing call — a long-established,
  // going-nowhere range — so it looks at channels without the swing span cap.
  const longTermChannels = detectChannels(candles, levels, { maxSpanCandles: Infinity });
  const stability = findStableChannel(candles, longTermChannels);
  const valueChannels = detectChannels(candles, levels, { maxSpanCandles: VALUE_MAX_SPAN_CANDLES });
  return { symbol, candles, channels, levels, alerts, isLive, tradePlan, stability, valueChannels };
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

/**
 * How many times price has touched a symbol's best channel (support +
 * resistance touches combined) — a rough "how consistently is this
 * bouncing" measure. channels[0] is already detectChannels' pick for
 * tightest/most-contained, so this scores that one rather than picking
 * favorably among all candidates.
 */
export function channelReliabilityScore(result: ScanResult): number {
  const channel = result.channels[0];
  if (!channel) return 0;
  return channel.support.touches.length + channel.resistance.touches.length;
}

// detectChannels only requires 2 touches per side to qualify a channel at
// all — "consistently hitting" should mean well past that bare minimum,
// not just barely qualified.
const MIN_RELIABLE_TOUCHES = 5;

/**
 * Symbols whose best channel is still active (not broken out) and has
 * bounced back and forth enough times to trust the pattern rather than a
 * channel that only just formed. Sorted most-touched first, ties broken by
 * containment (how cleanly price has stayed inside the band).
 */
export function mostReliableChannels(results: ScanResult[], cap = Infinity): ScanResult[] {
  return results
    .filter((r) => r.channels[0]?.status === 'active' && channelReliabilityScore(r) >= MIN_RELIABLE_TOUCHES)
    .sort((a, b) => {
      const byTouches = channelReliabilityScore(b) - channelReliabilityScore(a);
      if (byTouches !== 0) return byTouches;
      return b.channels[0].containmentPct - a.channels[0].containmentPct;
    })
    .slice(0, cap);
}

/**
 * Filters to the curated Buffett-style value whitelist (see
 * buffettStyle.ts) and sorts so names with a currently active channel —
 * something actually tradeable right now — come first, ties broken by how
 * consistently that channel has been touched. Unlike bySignal/
 * mostReliableChannels, this doesn't hide a company just because it has
 * no channel at all right now — the point is to always show these
 * particular businesses, with active setups surfaced at the top rather
 * than filtered to only the setups.
 */
export function buffettStyleResults(results: ScanResult[], symbols: string[]): ScanResult[] {
  return results
    .filter((r) => symbols.includes(r.symbol))
    // Swap in the wider-span value channels as `channels` — the mini
    // chart, the active/broken color, and the reliability score all read
    // from `channels`, and a swing-tuned channel is usually just absent
    // for a slow-moving blue chip. This only affects the copies returned
    // here for this one section; the original swing `channels` used
    // everywhere else in the app (trade plans, alerts, signals) is untouched.
    .map((r) => ({ ...r, channels: r.valueChannels ?? r.channels }))
    .sort((a, b) => {
      const aActive = a.channels[0]?.status === 'active' ? 1 : 0;
      const bActive = b.channels[0]?.status === 'active' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return channelReliabilityScore(b) - channelReliabilityScore(a);
    });
}

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
