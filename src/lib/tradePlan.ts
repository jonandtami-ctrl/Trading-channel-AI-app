import type { Candle, Channel } from './types';
import { findPivots } from './pivots';
import { classifyTrend, trendScore, type TrendDirection } from './trend';
import { classifyChannelDirection, channelDirectionWarning, type ChannelDirection } from './channelDirection';
import { classifyVolume, volumeScore, type VolumeLevel } from './volumeAnalysis';
import { detectSupportSweepReclaim, type SweepReclaimSignal } from './supportSweepReclaim';

/**
 * Disciplined channel-trading analysis. Given a candidate channel, works
 * out where price actually is in the structure (not just "active" or
 * "broken" the way channels.ts sees it), whether any bounce/breakout is
 * confirmed or just an attempt, a stop/target/risk-reward plan, a 0-100
 * quality score, and a final plain-language status — following the
 * discipline: structure -> location -> confirmation -> risk -> reward ->
 * entry, never "price moved, buy now."
 */

export type ChannelState =
  | 'at_support'
  | 'bouncing_from_support'
  | 'support_sweep_reclaim'
  | 'mid_channel'
  | 'approaching_resistance'
  | 'testing_resistance'
  | 'breakout_attempt'
  | 'confirmed_breakout'
  | 'breakout_retest'
  | 'false_breakout'
  | 'channel_breakdown'
  | 'trending_above_channel'
  | 'trending_below_channel';

export type EntryQuality = 'excellent' | 'good' | 'acceptable' | 'late' | 'poor';

export type FinalStatus =
  | 'high_quality_setup'
  | 'confirmed_setup'
  | 'support_sweep_reclaim_confirmed'
  | 'watch'
  | 'wait_for_confirmation'
  | 'breakout_attempt'
  | 'wait_for_retest'
  | 'late_entry'
  | 'poor_risk_reward'
  | 'channel_breakdown'
  | 'invalidated_setup'
  | 'no_trade';

export const FINAL_STATUS_META: Record<FinalStatus, { emoji: string; label: string }> = {
  high_quality_setup: { emoji: '🟢', label: 'HIGH-QUALITY SETUP' },
  confirmed_setup: { emoji: '🟢', label: 'CONFIRMED SETUP' },
  support_sweep_reclaim_confirmed: { emoji: '🟢', label: 'SUPPORT SWEEP RECLAIM' },
  watch: { emoji: '🟡', label: 'WATCH' },
  wait_for_confirmation: { emoji: '🟡', label: 'WAIT FOR CONFIRMATION' },
  breakout_attempt: { emoji: '🟡', label: 'BREAKOUT ATTEMPT' },
  wait_for_retest: { emoji: '🟡', label: 'WAIT FOR RETEST' },
  late_entry: { emoji: '🔴', label: 'LATE ENTRY' },
  poor_risk_reward: { emoji: '🔴', label: 'POOR RISK/REWARD' },
  channel_breakdown: { emoji: '🔴', label: 'CHANNEL BREAKDOWN' },
  invalidated_setup: { emoji: '🔴', label: 'INVALIDATED SETUP' },
  no_trade: { emoji: '⚪', label: 'NO TRADE' },
};

export interface TradePlan {
  symbol: string;
  currentPrice: number;
  trend: TrendDirection;
  trendLabel: string;
  channelDirection: ChannelDirection;
  support: number;
  resistance: number;
  /** Days between the most recent candle and this channel's last support/resistance touch — how current the levels actually are. */
  lastTouchDaysAgo: number;
  channelState: ChannelState;
  channelStateLabel: string;
  setupType: string;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  confirmationNeeded: string | null;
  stopLoss: number | null;
  stopPct: number | null;
  target1: number | null;
  target2: number | null;
  potentialGainPct: number | null;
  riskRewardRatio: number | null;
  volumeLevel: VolumeLevel;
  volumeRatio: number;
  qualityScore: number;
  entryQuality: EntryQuality | null;
  warnings: string[];
  finalStatus: FinalStatus;
  finalStatusLabel: string;
  reason: string;
}

const APPROACH_PCT = 1.5;
const BREAK_TOLERANCE_PCT = 1;
// A breakout-family stop is anchored to the resistance level, not to
// current price. If price has since run far away from that anchor (e.g.
// trending_above_channel, or a breakout_retest that kept climbing), the
// resulting stop distance can balloon into an unusable, misleadingly huge
// "risk" — and the target can even fall below where price already is. Past
// this cap, there's no sane structural stop from here; the plan should say
// so instead of showing a distorted number.
const MAX_STOP_DISTANCE_PCT = 10;
const CHANNEL_STATE_LABELS: Record<ChannelState, string> = {
  at_support: 'At Support',
  bouncing_from_support: 'Bouncing From Support',
  support_sweep_reclaim: 'Support Sweep Reclaim',
  mid_channel: 'Mid Channel',
  approaching_resistance: 'Approaching Resistance',
  testing_resistance: 'Testing Resistance',
  breakout_attempt: 'Breakout Attempt',
  confirmed_breakout: 'Confirmed Breakout',
  breakout_retest: 'Breakout Retest',
  false_breakout: 'False Breakout',
  channel_breakdown: 'Channel Breakdown',
  trending_above_channel: 'Trending Above Channel',
  trending_below_channel: 'Trending Below Channel',
};

export function computeTradePlan(symbol: string, candles: Candle[], channel: Channel): TradePlan {
  const last = candles[candles.length - 1];
  const currentPrice = last.close;
  const { support, resistance } = channel;

  const pivots = findPivots(candles, 5);
  const trend = classifyTrend(pivots);
  const channelDirection = classifyChannelDirection(channel);
  const volume = classifyVolume(candles, candles.length - 1);

  const channelState = determineChannelState(candles, channel);
  const lastTouchCandle = candles[Math.max(0, Math.min(channel.lastTouchIndex, candles.length - 1))];
  const lastTouchDaysAgo = Math.round((last.time - lastTouchCandle.time) / 86400);
  const width = resistance.price - support.price;
  const positionFromSupport = width > 0 ? (currentPrice - support.price) / width : 0.5;

  const entryQuality = isActionableState(channelState) ? classifyEntryQuality(positionFromSupport) : null;
  const plan = buildEntryPlan(channelState, support.price, resistance.price, currentPrice);
  const riskRewardRatio = computeRiskReward(plan.entry, plan.stopLoss, plan.target1);

  const qualityScore = computeQualityScore({
    channel,
    channelState,
    positionFromSupport,
    volumeLevel: volume.level,
    trend: trend.direction,
    riskRewardRatio,
    currentPrice,
    resistancePrice: resistance.price,
  });

  const warnings = buildWarnings({
    channelDirection,
    positionFromSupport,
    entryQuality,
    riskRewardRatio,
    volumeLevel: volume.level,
    channelState,
  });

  const { finalStatus, reason } = computeFinalStatus({
    channelState,
    entryQuality,
    riskRewardRatio,
    qualityScore,
  });

  const stopPct =
    plan.stopLoss != null ? ((plan.stopLoss - currentPrice) / currentPrice) * 100 : null;
  const potentialGainPct =
    plan.target1 != null ? ((plan.target1 - currentPrice) / currentPrice) * 100 : null;

  return {
    symbol,
    currentPrice,
    trend: trend.direction,
    trendLabel: trend.label,
    channelDirection,
    support: support.price,
    resistance: resistance.price,
    lastTouchDaysAgo,
    channelState,
    channelStateLabel: CHANNEL_STATE_LABELS[channelState],
    setupType: plan.setupType,
    entryZoneLow: plan.entryZoneLow,
    entryZoneHigh: plan.entryZoneHigh,
    confirmationNeeded: plan.confirmationNeeded,
    stopLoss: plan.stopLoss,
    stopPct,
    target1: plan.target1,
    target2: plan.target2,
    potentialGainPct,
    riskRewardRatio,
    volumeLevel: volume.level,
    volumeRatio: volume.ratio,
    qualityScore,
    entryQuality,
    warnings,
    finalStatus,
    finalStatusLabel: `${FINAL_STATUS_META[finalStatus].emoji} ${FINAL_STATUS_META[finalStatus].label}`,
    reason,
  };
}

function isActionableState(state: ChannelState): boolean {
  return (
    state === 'bouncing_from_support' ||
    state === 'confirmed_breakout' ||
    state === 'breakout_retest' ||
    state === 'trending_above_channel'
  );
}

/**
 * Walks the candle history to figure out exactly where price is in the
 * structure right now: never call a breakout (or a bounce) before there's
 * real evidence, and distinguish an attempt from a confirmation from a
 * retest from a failure.
 */
function determineChannelState(candles: Candle[], channel: Channel): ChannelState {
  const { support, resistance } = channel;
  const last = candles[candles.length - 1];
  const resistanceBreak = resistance.price * (1 + BREAK_TOLERANCE_PCT / 100);
  const supportBreak = support.price * (1 - BREAK_TOLERANCE_PCT / 100);

  if (channel.status === 'broken' && channel.brokenDirection === 'up') {
    return classifyBreakoutState(candles, resistance.price);
  }
  if (channel.status === 'broken' && channel.brokenDirection === 'down') {
    return classifyBreakdownState(candles, support.price);
  }

  // Channel still reads as "active" by channels.ts's current-close check, but
  // if a recent candle closed above the break line and price has since come
  // back inside, that's a failed breakout, not a normal approach/test.
  const priorCandles = candles.slice(-6, -1);
  if (priorCandles.some((c) => c.close > resistanceBreak) && last.close <= resistance.price) {
    return 'false_breakout';
  }

  const nearSupport = last.close <= support.price * (1 + APPROACH_PCT / 100);
  const nearResistance = last.close >= resistance.price * (1 - APPROACH_PCT / 100);

  if (nearSupport) {
    return isConfirmedBounce(candles, support.price, 'support') ? 'bouncing_from_support' : 'at_support';
  }
  if (nearResistance) {
    // A wick that reached resistance but closed back under it is a "test";
    // just drifting up toward the zone without touching it yet is "approaching".
    const recentHigh = Math.max(...candles.slice(-3).map((c) => c.high));
    return recentHigh >= resistance.price * (1 - APPROACH_PCT / 200) ? 'testing_resistance' : 'approaching_resistance';
  }
  return 'mid_channel';
}

/**
 * Only called once channels.ts has already confirmed the last close is
 * above resistance, so "is it still holding" is the only open question —
 * a genuine false breakout (price back below resistance) can't happen in
 * this branch, that's handled separately in determineChannelState above.
 *
 * Finds the most recent below->above crossing, then checks whether price
 * was *ever* above resistance before that crossing: if so, this crossing
 * is a recovery after a dip (a retest), not the original break. Because
 * it's the *most recent* crossing and we already know the last close is
 * above resistance, everything from this crossing onward is guaranteed to
 * have stayed above it (any dip afterward would require another, more
 * recent crossing, contradicting "most recent").
 */
function classifyBreakoutState(candles: Candle[], resistancePrice: number): ChannelState {
  const crossingIndex = findMostRecentUpwardCrossing(candles, resistancePrice);
  const since = crossingIndex == null ? candles : candles.slice(crossingIndex);

  if (since.length <= 1) return 'breakout_attempt';

  const hadPriorExcursion =
    crossingIndex != null && candles.slice(0, crossingIndex).some((c) => c.close > resistancePrice);
  if (hadPriorExcursion) return 'breakout_retest';

  const lastClose = candles[candles.length - 1].close;
  return since.length >= 10 && lastClose > resistancePrice * 1.05 ? 'trending_above_channel' : 'confirmed_breakout';
}

function findMostRecentUpwardCrossing(candles: Candle[], level: number): number | null {
  for (let i = candles.length - 1; i > 0; i--) {
    if (candles[i - 1].close <= level && candles[i].close > level) return i;
  }
  return null;
}

function classifyBreakdownState(candles: Candle[], supportPrice: number): ChannelState {
  const lastAboveIndex = findLastIndexAtOrAbove(candles, supportPrice);
  const since = lastAboveIndex == null ? candles : candles.slice(lastAboveIndex + 1);

  if (since.length <= 1) return 'channel_breakdown';

  const lastClose = candles[candles.length - 1].close;
  return since.length >= 10 && lastClose < supportPrice * 0.95 ? 'trending_below_channel' : 'channel_breakdown';
}

function findLastIndexAtOrAbove(candles: Candle[], level: number): number | null {
  for (let i = candles.length - 1; i >= 0; i--) {
    if (candles[i].close >= level) return i;
  }
  return null;
}

/** Same idea as alerts.ts's detectBounce, kept local so tradePlan.ts's state machine is self-contained. */
function isConfirmedBounce(candles: Candle[], levelPrice: number, side: 'support' | 'resistance'): boolean {
  const lookback = 3;
  if (candles.length < lookback + 1) return false;
  const recent = candles.slice(-(lookback + 1));
  const first = recent[0];
  const last = recent[recent.length - 1];

  if (side === 'support') {
    const touched = recent.some((c) => c.low <= levelPrice * 1.005);
    return touched && last.close > first.close;
  }
  const touched = recent.some((c) => c.high >= levelPrice * 0.995);
  return touched && last.close < first.close && last.close <= levelPrice * 1.005;
}

function classifyEntryQuality(positionFromSupport: number): EntryQuality {
  const p = Math.max(0, Math.min(1, positionFromSupport));
  if (p <= 0.15) return 'excellent';
  if (p <= 0.35) return 'good';
  if (p <= 0.6) return 'acceptable';
  if (p <= 0.85) return 'late';
  return 'poor';
}

interface EntryPlan {
  setupType: string;
  entry: number;
  entryZoneLow: number | null;
  entryZoneHigh: number | null;
  confirmationNeeded: string | null;
  stopLoss: number | null;
  target1: number | null;
  target2: number | null;
}

/** True once a resistance-anchored stop is far enough from current price that it's no longer a sane, usable risk figure. */
function stopTooFar(currentPrice: number, stopLoss: number): boolean {
  return ((currentPrice - stopLoss) / currentPrice) * 100 > MAX_STOP_DISTANCE_PCT;
}

/** Same shape as the no-clean-entry fallback: price has moved too far from the structural level to say anything useful about risk from here. */
function extendedNoTradePlan(currentPrice: number): EntryPlan {
  return {
    setupType: 'None',
    entry: currentPrice,
    entryZoneLow: null,
    entryZoneHigh: null,
    confirmationNeeded: 'Price has moved too far from the breakout level for a sane stop-loss from here — wait for a pullback or a fresh setup closer to the current price.',
    stopLoss: null,
    target1: null,
    target2: null,
  };
}

/** Stop below invalidation, target at/beyond the channel's opposite edge. */
function buildEntryPlan(state: ChannelState, support: number, resistance: number, currentPrice: number): EntryPlan {
  const channelHeight = resistance - support;

  switch (state) {
    case 'bouncing_from_support':
      return {
        setupType: 'Channel bounce',
        entry: currentPrice,
        entryZoneLow: support * 0.995,
        entryZoneHigh: support * 1.015,
        confirmationNeeded: null,
        stopLoss: support * 0.98,
        target1: resistance,
        target2: resistance + channelHeight * 0.25,
      };
    case 'at_support':
      return {
        setupType: 'Channel bounce (unconfirmed)',
        entry: currentPrice,
        entryZoneLow: support * 0.995,
        entryZoneHigh: support * 1.015,
        confirmationNeeded: 'Wait for a bullish confirmation candle off support before entering.',
        stopLoss: support * 0.98,
        target1: resistance,
        target2: resistance + channelHeight * 0.25,
      };
    case 'confirmed_breakout':
    case 'trending_above_channel': {
      const stopLoss = resistance * 0.985;
      if (stopTooFar(currentPrice, stopLoss)) return extendedNoTradePlan(currentPrice);
      return {
        setupType: 'Breakout',
        entry: currentPrice,
        entryZoneLow: resistance * 0.995,
        entryZoneHigh: resistance * 1.03,
        confirmationNeeded: null,
        stopLoss,
        target1: resistance + channelHeight,
        target2: resistance + channelHeight * 1.5,
      };
    }
    case 'breakout_retest': {
      const stopLoss = resistance * 0.98;
      if (stopTooFar(currentPrice, stopLoss)) return extendedNoTradePlan(currentPrice);
      return {
        setupType: 'Breakout retest',
        entry: currentPrice,
        entryZoneLow: resistance * 0.995,
        entryZoneHigh: resistance * 1.02,
        confirmationNeeded: null,
        stopLoss,
        target1: resistance + channelHeight,
        target2: resistance + channelHeight * 1.5,
      };
    }
    case 'breakout_attempt':
      return {
        setupType: 'Breakout (unconfirmed)',
        entry: currentPrice,
        entryZoneLow: resistance,
        entryZoneHigh: resistance * 1.03,
        confirmationNeeded: 'Wait for a candle close to hold above resistance before treating this as confirmed.',
        stopLoss: resistance * 0.985,
        target1: resistance + channelHeight,
        target2: resistance + channelHeight * 1.5,
      };
    case 'testing_resistance':
      return {
        setupType: 'None',
        entry: currentPrice,
        entryZoneLow: null,
        entryZoneHigh: null,
        confirmationNeeded: 'Wait for either a confirmed breakout or a pullback toward support.',
        stopLoss: null,
        target1: null,
        target2: null,
      };
    case 'false_breakout':
      return {
        setupType: 'None',
        entry: currentPrice,
        entryZoneLow: null,
        entryZoneHigh: null,
        confirmationNeeded: 'Price failed to hold above resistance — wait for a fresh setup, not a chase back in.',
        stopLoss: null,
        target1: null,
        target2: null,
      };
    case 'channel_breakdown':
    case 'trending_below_channel':
      return {
        setupType: 'None',
        entry: currentPrice,
        entryZoneLow: null,
        entryZoneHigh: null,
        confirmationNeeded: 'Support has failed — this is no longer a normal bounce setup.',
        stopLoss: null,
        target1: null,
        target2: null,
      };
    case 'approaching_resistance':
    case 'mid_channel':
    default:
      return {
        setupType: 'None',
        entry: currentPrice,
        entryZoneLow: null,
        entryZoneHigh: null,
        confirmationNeeded: 'No high-quality entry present right now.',
        stopLoss: null,
        target1: null,
        target2: null,
      };
  }
}

function computeRiskReward(entry: number, stop: number | null, target: number | null): number | null {
  if (stop == null || target == null) return null;
  const risk = entry - stop;
  const reward = target - entry;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

function channelQualityScore(channel: Channel): number {
  const touches = channel.support.touches.length + channel.resistance.touches.length;
  const touchScore = Math.min(1, touches / 8) * 12;
  const containmentScore = (channel.containmentPct / 100) * 8;
  return touchScore + containmentScore;
}

function entryLocationScore(positionFromSupport: number): number {
  const closeness = 1 - Math.min(1, Math.max(0, positionFromSupport));
  return closeness * 15;
}

function confirmationScore(state: ChannelState): number {
  if (state === 'bouncing_from_support' || state === 'confirmed_breakout' || state === 'breakout_retest') return 15;
  if (state === 'testing_resistance' || state === 'breakout_attempt') return 7;
  return 0;
}

function riskRewardScore(rr: number | null): number {
  if (rr == null) return 0;
  if (rr >= 3) return 15;
  if (rr >= 2) return 11;
  if (rr >= 1) return 5;
  return 0;
}

function marketStructureScore(currentPrice: number, resistancePrice: number): number {
  const roomPct = ((resistancePrice - currentPrice) / currentPrice) * 100;
  if (roomPct >= 5) return 10;
  if (roomPct >= 2) return 6;
  if (roomPct >= 0.5) return 3;
  return 0;
}

function computeQualityScore(args: {
  channel: Channel;
  channelState: ChannelState;
  positionFromSupport: number;
  volumeLevel: VolumeLevel;
  trend: TrendDirection;
  riskRewardRatio: number | null;
  currentPrice: number;
  resistancePrice: number;
}): number {
  const total =
    channelQualityScore(args.channel) +
    entryLocationScore(args.positionFromSupport) +
    confirmationScore(args.channelState) +
    volumeScore(args.volumeLevel) +
    trendScore(args.trend) +
    riskRewardScore(args.riskRewardRatio) +
    marketStructureScore(args.currentPrice, args.resistancePrice);
  return Math.round(Math.max(0, Math.min(100, total)));
}

function buildWarnings(args: {
  channelDirection: ChannelDirection;
  positionFromSupport: number;
  entryQuality: EntryQuality | null;
  riskRewardRatio: number | null;
  volumeLevel: VolumeLevel;
  channelState: ChannelState;
}): string[] {
  const warnings: string[] = [];
  const directionWarning = channelDirectionWarning(args.channelDirection);
  if (directionWarning) warnings.push(directionWarning);

  if (args.entryQuality === 'late' || args.entryQuality === 'poor') {
    warnings.push('Late channel entry — limited upside remaining before resistance.');
  }
  if (args.positionFromSupport > 0.5 && (args.channelState === 'mid_channel' || args.channelState === 'approaching_resistance')) {
    warnings.push(
      `Price has already moved ${(args.positionFromSupport * 100).toFixed(0)}% through the channel from support — waiting for a pullback or new setup may offer better risk/reward.`
    );
  }
  if (args.riskRewardRatio != null && args.riskRewardRatio < 2) {
    warnings.push('Risk/reward does not meet preferred criteria (below 1:2).');
  }
  if (
    (args.channelState === 'breakout_attempt' || args.channelState === 'confirmed_breakout') &&
    args.volumeLevel === 'low'
  ) {
    warnings.push('Breakout detected, but volume confirmation is weak.');
  }
  return warnings;
}

function computeFinalStatus(args: {
  channelState: ChannelState;
  entryQuality: EntryQuality | null;
  riskRewardRatio: number | null;
  qualityScore: number;
}): { finalStatus: FinalStatus; reason: string } {
  const { channelState, entryQuality, riskRewardRatio, qualityScore } = args;

  if (channelState === 'channel_breakdown' || channelState === 'trending_below_channel') {
    return {
      finalStatus: 'channel_breakdown',
      reason: 'Price closed below support with the breakdown holding — this is no longer a normal support-bounce setup.',
    };
  }
  if (channelState === 'false_breakout') {
    return {
      finalStatus: 'invalidated_setup',
      reason: 'Price moved above resistance but failed to hold the breakout and fell back inside the channel.',
    };
  }
  if (channelState === 'mid_channel') {
    return { finalStatus: 'no_trade', reason: 'Price is sitting mid-channel — no high-quality entry is present.' };
  }
  if (channelState === 'at_support' || channelState === 'approaching_resistance') {
    return {
      finalStatus: 'watch',
      reason:
        channelState === 'at_support'
          ? 'Price has reached support but a bullish reversal hasn’t been confirmed yet.'
          : 'Price is approaching resistance — not yet a testing or breakout situation.',
    };
  }
  if (channelState === 'testing_resistance') {
    return {
      finalStatus: 'wait_for_confirmation',
      reason: 'Price has reached resistance but hasn’t closed above it — wait for a confirmed breakout or a pullback.',
    };
  }
  if (channelState === 'breakout_attempt') {
    return {
      finalStatus: 'breakout_attempt',
      reason: 'Price is trading above resistance, but the close hasn’t confirmed yet — don’t call this a confirmed breakout.',
    };
  }

  // Remaining states all have real confirmation: bouncing_from_support,
  // confirmed_breakout, breakout_retest, trending_above_channel.
  if (entryQuality === 'late' || entryQuality === 'poor') {
    return {
      finalStatus: channelState === 'confirmed_breakout' ? 'wait_for_retest' : 'late_entry',
      reason:
        channelState === 'confirmed_breakout'
          ? 'The breakout is confirmed but price has already extended — waiting for a pullback/retest may offer a safer entry than chasing.'
          : 'Confirmation is present, but price has already moved well through the channel — limited room left before resistance.',
    };
  }
  if (riskRewardRatio != null && riskRewardRatio < 1.5) {
    return {
      finalStatus: 'poor_risk_reward',
      reason: `Confirmed setup, but the risk/reward (${riskRewardRatio.toFixed(1)}:1) falls short of the preferred 1:2 minimum.`,
    };
  }
  if (qualityScore >= 85) {
    return {
      finalStatus: 'high_quality_setup',
      reason: 'Clean channel, confirmed reversal, supportive volume, and favorable risk/reward all line up.',
    };
  }
  return {
    finalStatus: 'confirmed_setup',
    reason: 'Price reached the level, a reversal confirmed, and the trade offers reasonable risk/reward toward the opposite side of the channel.',
  };
}

// A confirmed sweep-reclaim is a stricter, more selective pattern than a
// plain support touch (it demands proof the breakdown attempt failed, not
// just a bounce) — worth a small bonus over the generic bounce's
// confirmation score, on top of everything else the shared scoring
// components already capture.
const SWEEP_RECLAIM_CONFIRMATION_BONUS = 20;

/**
 * Builds a full TradePlan for a confirmed SUPPORT_SWEEP_RECLAIM setup
 * directly from the already-fully-diagnosed signal, instead of running it
 * back through determineChannelState/buildEntryPlan — that state machine
 * is tuned for "touched support, closed a bit higher," which is exactly
 * the pattern this setup is designed to NOT trigger on, and by the time a
 * sweep has reclaimed and confirmed, price may already have moved far
 * enough from support that the generic machine would misread it as
 * mid_channel/no_trade instead of recognizing the setup that just played out.
 */
function computeSupportSweepReclaimPlan(
  symbol: string,
  candles: Candle[],
  channel: Channel,
  sweep: SweepReclaimSignal
): TradePlan {
  const last = candles[candles.length - 1];
  const currentPrice = last.close;
  const { support, resistance } = channel;
  const channelHeight = resistance.price - support.price;

  const pivots = findPivots(candles, 5);
  const trend = classifyTrend(pivots);
  const channelDirection = classifyChannelDirection(channel);
  const volume = classifyVolume(candles, candles.length - 1);

  const lastTouchCandle = candles[Math.max(0, Math.min(channel.lastTouchIndex, candles.length - 1))];
  const lastTouchDaysAgo = Math.round((last.time - lastTouchCandle.time) / 86400);
  const positionFromSupport = channelHeight > 0 ? (currentPrice - support.price) / channelHeight : 0.5;
  const entryQuality = classifyEntryQuality(positionFromSupport);

  // Stop sits just under the actual swept low, not a flat percentage off
  // support — we know exactly where sellers were rejected, so that's the
  // real invalidation point for this specific setup.
  const stopLoss = sweep.sweepLow * 0.995;
  const target1 = resistance.price;
  const target2 = resistance.price + channelHeight * 0.25;
  const riskRewardRatio = computeRiskReward(currentPrice, stopLoss, target1);

  const qualityScore = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        channelQualityScore(channel) +
          entryLocationScore(positionFromSupport) +
          SWEEP_RECLAIM_CONFIRMATION_BONUS +
          volumeScore(volume.level) +
          trendScore(trend.direction) +
          riskRewardScore(riskRewardRatio) +
          marketStructureScore(currentPrice, resistance.price)
      )
    )
  );

  const warnings: string[] = [];
  const directionWarning = channelDirectionWarning(channelDirection);
  if (directionWarning) warnings.push(directionWarning);
  if (riskRewardRatio != null && riskRewardRatio < 2) {
    warnings.push('Risk/reward does not meet preferred criteria (below 1:2).');
  }

  const poorRiskReward = riskRewardRatio != null && riskRewardRatio < 1.5;
  const finalStatus: FinalStatus = poorRiskReward ? 'poor_risk_reward' : 'support_sweep_reclaim_confirmed';
  const reason = poorRiskReward
    ? `Support swept and reclaimed with a confirmed bounce, but the risk/reward (${riskRewardRatio!.toFixed(1)}:1) falls short of the preferred 1:2 minimum.`
    : `Price swept below support (${sweep.sweepDepthAtr.toFixed(2)} ATR below the line), failed to hold the breakdown, reclaimed the zone, and printed a bullish follow-through candle — buyers took control after sellers failed.`;

  const stopPct = ((stopLoss - currentPrice) / currentPrice) * 100;
  const potentialGainPct = ((target1 - currentPrice) / currentPrice) * 100;

  return {
    symbol,
    currentPrice,
    trend: trend.direction,
    trendLabel: trend.label,
    channelDirection,
    support: support.price,
    resistance: resistance.price,
    lastTouchDaysAgo,
    channelState: 'support_sweep_reclaim',
    channelStateLabel: CHANNEL_STATE_LABELS.support_sweep_reclaim,
    setupType: 'Support sweep reclaim',
    entryZoneLow: support.price * 0.995,
    entryZoneHigh: currentPrice,
    confirmationNeeded: null,
    stopLoss,
    stopPct,
    target1,
    target2,
    potentialGainPct,
    riskRewardRatio,
    volumeLevel: volume.level,
    volumeRatio: volume.ratio,
    qualityScore,
    entryQuality,
    warnings,
    finalStatus,
    finalStatusLabel: `${FINAL_STATUS_META[finalStatus].emoji} ${FINAL_STATUS_META[finalStatus].label}`,
    reason,
  };
}

/**
 * The single entry point for "what's the plan for this channel" — checks
 * for a confirmed SUPPORT_SWEEP_RECLAIM first and only falls back to the
 * generic determineChannelState/buildEntryPlan machine when there isn't
 * one. Used both for the best-of-all-channels dashboard classification
 * below and directly by the symbol detail screen (which renders a plan per
 * channel, not just the single best one) — a channel showing a confirmed
 * sweep-reclaim needs to read the same way in both places.
 */
export function computeTradePlanForChannel(symbol: string, candles: Candle[], channel: Channel): TradePlan {
  const sweep = detectSupportSweepReclaim(candles, channel);
  return sweep ? computeSupportSweepReclaimPlan(symbol, candles, channel, sweep) : computeTradePlan(symbol, candles, channel);
}

/**
 * A symbol can have multiple channels detected at once; for dashboard-level
 * classification we want whichever one currently represents the best
 * opportunity, not just the first one channels.ts happened to return.
 */
export function computeBestTradePlan(symbol: string, candles: Candle[], channels: Channel[]): TradePlan | null {
  if (channels.length === 0) return null;
  const plans = channels.map((channel) => computeTradePlanForChannel(symbol, candles, channel));
  return plans.reduce((best, plan) => (plan.qualityScore > best.qualityScore ? plan : best));
}
