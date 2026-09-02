import { findPivots } from './pivots';
import { clusterLevels } from './levels';
import { detectChannels } from './channels';
import { generateAlerts } from './alerts';
import { computeBestTradePlan, type TradePlan } from './tradePlan';
import { findStableChannel } from './stability';
import { countChannelCycles } from './channelCycles';
import { findSymbol } from './data/symbols';
import type { Alert, Candle, ScanResult } from './types';

// A large-cap stock genuinely takes longer to complete a support/resistance
// round-trip than a fast-moving crypto — the ~1-month swing cap below
// excludes almost all of them from ever showing an "active channel,"
// pushing them into the stability check instead (which requires an even
// longer, tighter, already-well-established range). This wider cap —
// roughly a full trading year — sits in between: long enough to match how
// an investor actually thinks about a range for a slow mover, short enough
// to still be a channel worth pointing at rather than "this has gone
// nowhere for years" (that's what the stability check is for). Used for
// the stock universe's "active channel" view (see topActivePicks), not
// swing calls.
const VALUE_MAX_SPAN_CANDLES = 260;

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
  if (plan.channelState === 'support_sweep_reclaim' && plan.finalStatus === 'support_sweep_reclaim_confirmed') return 'buy';
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

// A SELL or WATCH call is about a position you might already hold, or are
// just tracking — price doesn't affect whether it's worth showing. A BUY
// is capital you'd actually put in today, so it's the one signal that
// gets a per-share price ceiling — but it only needs to be high enough to
// rule out truly impractical per-share prices, not to exclude ordinary
// blue-chip/bank stocks (a $200 cap was quietly dropping names like
// CM.TO). TSX names are CAD-priced but use the same raw number — no FX
// conversion, same as the rest of the app.
const MAX_BUY_PRICE_USD = 1000;

/** Filters results down to one signal bucket, nearest-to-actionable first. A 'buy' bucket also excludes anything priced at/above MAX_BUY_PRICE_USD a share. Never surfaces a symbol that fell back to demo data — a fabricated price/channel has no business being called a real trade signal. */
export function bySignal(results: ScanResult[], signal: Signal, cap = Infinity): ScanResult[] {
  return results
    .filter((r) => r.isLive)
    .filter((r) => getSignal(r) === signal)
    .filter((r) => signal !== 'buy' || underMaxBuyPrice(r))
    .sort((a, b) => closestLevelDistance(a) - closestLevelDistance(b))
    .slice(0, cap);
}

/** True for crypto (no per-share price ceiling applies) or a stock/TSX result priced under MAX_BUY_PRICE_USD a share. */
export function underMaxBuyPrice(result: ScanResult): boolean {
  const last = result.candles[result.candles.length - 1];
  if (!last) return false;
  if (findSymbol(result.symbol)?.kind !== 'stock') return true;
  return last.close < MAX_BUY_PRICE_USD;
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

/** Genuine support -> resistance round trips within the last 60 days, for the best channel — see channelCycles.ts. */
function channelCycleScore(result: ScanResult): number {
  const channel = result.channels[0];
  if (!channel) return 0;
  return countChannelCycles(channel, result.candles).supportToResistanceCycles;
}

/**
 * Symbols whose best channel is still active (not broken out) and has
 * bounced back and forth enough times to trust the pattern rather than a
 * channel that only just formed. Ranked by completed support->resistance
 * cycles first — a channel that's actually round-tripped 4 times is a
 * proven pattern in a way raw touch count alone doesn't capture (5 touches
 * all on the same side, never crossing, would pass the touch bar without
 * ever having cycled). Touch count and containment remain as tie-breakers
 * for channels with the same cycle count. Excludes demo-fallback results
 * (see bySignal) — also used by topActivePicks, so this is the one place
 * that needs the isLive check for both.
 */
export function mostReliableChannels(results: ScanResult[], cap = Infinity): ScanResult[] {
  return results
    .filter((r) => r.isLive)
    .filter((r) => r.channels[0]?.status === 'active' && channelReliabilityScore(r) >= MIN_RELIABLE_TOUCHES)
    .sort((a, b) => {
      const byCycles = channelCycleScore(b) - channelCycleScore(a);
      if (byCycles !== 0) return byCycles;
      const byTouches = channelReliabilityScore(b) - channelReliabilityScore(a);
      if (byTouches !== 0) return byTouches;
      return b.channels[0].containmentPct - a.channels[0].containmentPct;
    })
    .slice(0, cap);
}

/**
 * The best of the whole stock universe right now: whichever symbols have
 * a currently active channel on the wider ~1-year window (see
 * VALUE_MAX_SPAN_CANDLES) — the timescale that actually fits how a
 * large-cap stock moves — ranked by the same touch-count-then-containment
 * quality bar as mostReliableChannels. Swaps `channels` for the wider
 * `valueChannels` on the returned copies, and recomputes alerts/tradePlan
 * against that same wide channel — otherwise the BUY/WATCH/SELL badge
 * would keep reading off the original ~1-month swing plan, which rarely
 * fires for a slow-moving large cap and made almost everything here show
 * up as a flat "in channel" instead of the buy/watch zone it's actually
 * sitting in on the window being ranked. No cap by default — every
 * symbol that clears the reliability bar is a genuine option, not just
 * the top handful.
 */
export function topActivePicks(results: ScanResult[], cap = Infinity): ScanResult[] {
  const valueView = results.map((r) => {
    const channels = r.valueChannels ?? r.channels;
    const alerts = generateAlerts(r.symbol, r.candles, channels);
    const tradePlan = computeBestTradePlan(r.symbol, r.candles, channels);
    return { ...r, channels, alerts, tradePlan };
  });
  return mostReliableChannels(valueView, cap);
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
