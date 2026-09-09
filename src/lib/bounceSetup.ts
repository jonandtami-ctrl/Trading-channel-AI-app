import type { Candle, Channel, ScanResult } from './types';
import { findPivots } from './pivots';
import { clusterLevels } from './levels';
import { detectChannels } from './channels';
import { classifyTrend } from './trend';
import { classifyChannelDirection } from './channelDirection';
import { channelAgeDays } from './channelAge';
import { countChannelCycles } from './channelCycles';
import { calculateRSI } from './rsi';
import { averageDailyDollarVolume, isLiquid, MIN_LIQUIDITY_USD } from './liquidity';
import type { ChannelSnapshot } from './position';

export type BounceStatus = 'early_bounce' | 'near_support' | 'in_channel' | 'breaking';

export interface BounceSetupCandidate {
  symbol: string;
  currentPrice: number;
  support: number;
  resistance: number;
  /** (resistance - support) / support * 100 — total channel width. */
  widthPct: number;
  /** Upside from current price to resistance, as a percent of current price. */
  roomToResistancePct: number;
  /** (currentPrice - support) / support * 100 — the primary "how close to the floor" measure, independent of channel height. */
  distanceFromSupportPct: number;
  /** 0 = sitting at support, 100 = sitting at resistance. Can fall outside 0-100 if price has briefly traded past either line. */
  positionInChannelPct: number;
  channelAgeDays: number;
  supportTouches: number;
  resistanceTouches: number;
  /** Null when there isn't enough history yet to seed RSI(14). */
  rsi: number | null;
  status: BounceStatus;
  liquidityUsd: number;
  /** Composite 0-100ish ranking/display score — higher is a better bounce candidate. Shown to the user as "Setup Score". */
  rankScore: number;
  /** "Is there a consistent pattern to trade?" — reliability of the support/resistance structure itself (touches + completed cycles). */
  patternScore: number;
  /** "Is institutional money involved?" — dollar-volume based participation. */
  institutionalScore: number;
  /** "What is the price of the chart showing me?" — nearness to support plus live bounce evidence, net of penalties. */
  priceActionScore: number;
  /** Plain-language signs this is (or isn't) a genuine bounce in progress, e.g. "Holding support", "Reclaimed support after a brief break". */
  evidence: string[];
  /** Plain-language reasons the score was marked down, e.g. "Price already 6.2% above support". */
  penalties: string[];
  /** One-sentence, human-readable summary of why this candidate scored the way it did. */
  reason: string;
}

// Rule 1: minimum total channel width — a range this narrow can't realistically offer a 2%+ target.
export const MIN_CHANNEL_WIDTH_PCT = 3;
// Rule 2: only the bottom quarter of the channel counts as "close enough to support" to matter for a bounce entry.
export const MAX_POSITION_PCT = 25;
// Rule 3: bare-minimum reliability bar — well-formed channels already require 2 touches a side (see channels.ts),
// this just adds the age floor so a channel that only just formed doesn't count as "established."
export const MIN_TOUCHES = 2;
export const MIN_CHANNEL_AGE_DAYS = 30;

// ~3 months of trading days is the primary lookback for support/resistance/channel detection; ~6 months is
// used only as a secondary confirmation pass when the 3-month view doesn't turn up a qualifying channel, to
// catch larger, slower-forming levels a shorter window would miss.
const PRIMARY_LOOKBACK_CANDLES = 63;
const SECONDARY_LOOKBACK_CANDLES = 126;

/**
 * The same descriptive channel numbers evaluateBounceSetup computes, but
 * without any of its qualification gates — used to snapshot "what did this
 * channel look like right now" onto a journal entry when a trade is opened
 * (see item H, channel-trade review), regardless of whether the channel
 * happens to clear the bounce-setup bar at that exact moment.
 */
export function channelSnapshotFor(candles: Candle[], channel: Channel): ChannelSnapshot {
  const last = candles[candles.length - 1];
  const currentPrice = last?.close ?? channel.support.price;
  const channelHeight = channel.resistance.price - channel.support.price;
  const positionInChannelPct = channelHeight > 0 ? ((currentPrice - channel.support.price) / channelHeight) * 100 : 50;
  const roomToResistancePct = currentPrice > 0 ? ((channel.resistance.price - currentPrice) / currentPrice) * 100 : 0;
  const rsiSeries = calculateRSI(candles);
  const rsiLast = rsiSeries[rsiSeries.length - 1];

  return {
    support: channel.support.price,
    resistance: channel.resistance.price,
    widthPct: channel.widthPct,
    positionInChannelPct,
    roomToResistancePct,
    channelAgeDays: channelAgeDays(channel, candles),
    supportTouches: channel.support.touches.length,
    resistanceTouches: channel.resistance.touches.length,
    rsi: Number.isNaN(rsiLast) ? null : rsiLast,
  };
}

/**
 * Evaluates one symbol's channel against the bounce-trading rules (see the
 * BEST_BOUNCE_SETUPS spec): width, reliability, trend, and liquidity are
 * hard gates — a candidate failing any of them isn't a bounce setup at all,
 * not just a low-ranked one. Returns null when the channel doesn't qualify.
 * `candles` must be the same array the channel's levels were detected from
 * (touch indices are positional), which for the mass scan is a 3- or
 * 6-month tail slice, not the full history — see evaluateAllBounceSetups.
 */
export function evaluateBounceSetup(symbol: string, candles: Candle[], channel: Channel): BounceSetupCandidate | null {
  if (candles.length === 0) return null;
  // A channel that's already broken down isn't "established sideways" any
  // more — channels.ts already recomputes this fresh every scan, so
  // "active" here means genuinely active right now, not stale.
  if (channel.status !== 'active') return null;

  const widthPct = channel.widthPct;
  if (widthPct < MIN_CHANNEL_WIDTH_PCT) return null;

  const supportTouches = channel.support.touches.length;
  const resistanceTouches = channel.resistance.touches.length;
  if (supportTouches < MIN_TOUCHES || resistanceTouches < MIN_TOUCHES) return null;

  const ageDays = channelAgeDays(channel, candles);
  if (ageDays < MIN_CHANNEL_AGE_DAYS) return null;

  // Rule 4: reject a sustained downtrend or a channel whose lines are
  // themselves sloping down — "oversold" alone should never be enough.
  const pivots = findPivots(candles, 5);
  const trend = classifyTrend(pivots);
  if (trend.direction === 'downtrend' || trend.direction === 'strong_downtrend') return null;
  if (classifyChannelDirection(channel) === 'descending') return null;

  // Rule 7: liquidity floor.
  const liquidityUsd = averageDailyDollarVolume(candles);
  if (!isLiquid(candles)) return null;

  const last = candles[candles.length - 1];
  const currentPrice = last.close;
  const channelHeight = channel.resistance.price - channel.support.price;
  const positionInChannelPct = channelHeight > 0 ? ((currentPrice - channel.support.price) / channelHeight) * 100 : 50;
  const roomToResistancePct = currentPrice > 0 ? ((channel.resistance.price - currentPrice) / currentPrice) * 100 : 0;
  const distanceFromSupportPct = channel.support.price > 0 ? ((currentPrice - channel.support.price) / channel.support.price) * 100 : 0;

  const rsiSeries = calculateRSI(candles);
  const rsiLast = rsiSeries[rsiSeries.length - 1];
  const rsi = Number.isNaN(rsiLast) ? null : rsiLast;

  const evidence = detectBounceEvidence(candles, channel.support.price, distanceFromSupportPct);
  const status = determineBounceStatus(currentPrice, channel.support.price, positionInChannelPct, evidence.length);
  const cycles = countChannelCycles(channel, candles).supportToResistanceCycles;

  const penalties = detectPenalties({ distanceFromSupportPct, roomToResistancePct, supportTouches, rsi });
  const scores = computeScores({
    distanceFromSupportPct,
    roomToResistancePct,
    supportTouches,
    resistanceTouches,
    cycles,
    liquidityUsd,
    evidenceCount: evidence.length,
    penaltyTotal: penalties.total,
  });

  const reason = buildReason({ distanceFromSupportPct, roomToResistancePct, supportTouches, rsi, evidence, penalties: penalties.labels });

  return {
    symbol,
    currentPrice,
    support: channel.support.price,
    resistance: channel.resistance.price,
    widthPct,
    roomToResistancePct,
    distanceFromSupportPct,
    positionInChannelPct,
    channelAgeDays: ageDays,
    supportTouches,
    resistanceTouches,
    rsi,
    status,
    liquidityUsd,
    rankScore: scores.total,
    patternScore: scores.patternScore,
    institutionalScore: scores.institutionalScore,
    priceActionScore: scores.priceActionScore,
    evidence,
    penalties: penalties.labels,
    reason,
  };
}

/**
 * Rule 6/7: status is driven by actual bounce evidence rather than RSI or
 * momentum alone (rule 8) — a single up-close or a high RSI reading isn't
 * enough on its own to call something an EARLY BOUNCE, it takes at least
 * two independent, corroborating signs (see detectBounceEvidence). BREAKING
 * is a support that's visibly failing even if channels.ts's own (looser)
 * break tolerance hasn't flipped channel.status yet — an early warning, not
 * just an after-the-fact label.
 */
function determineBounceStatus(currentPrice: number, support: number, positionInChannelPct: number, evidenceCount: number): BounceStatus {
  if (currentPrice < support * 0.99) return 'breaking';
  if (positionInChannelPct > MAX_POSITION_PCT) return 'in_channel';
  return evidenceCount >= 2 ? 'early_bounce' : 'near_support';
}

/**
 * Rule 7's five named signs of a genuine bounce in progress: holding
 * support, reclaiming it after a brief break, a higher low forming near it,
 * a bullish confirmation candle, and improving volume. Each is independent
 * — a candidate can show anywhere from zero to all five — so status and
 * score both reward corroboration rather than any single signal.
 */
function detectBounceEvidence(candles: Candle[], support: number, distanceFromSupportPct: number): string[] {
  const evidence: string[] = [];
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  if (!last) return evidence;

  const recentWindow = candles.slice(-5);
  const holdingSupport = recentWindow.length > 0 && recentWindow.every((c) => c.close >= support * 0.99);
  if (holdingSupport && distanceFromSupportPct <= 5) evidence.push('Holding support');

  const priorWindow = candles.slice(-10, -1);
  const dippedBelow = priorWindow.some((c) => c.close < support * 0.99);
  if (dippedBelow && last.close >= support) evidence.push('Reclaimed support after a brief break');

  const recentPivots = findPivots(candles.slice(-40), 3);
  const lows = recentPivots.filter((p) => p.type === 'low').slice(-2);
  if (lows.length === 2 && lows[1].price > lows[0].price && lows[1].price <= support * 1.05) {
    evidence.push('Higher low forming near support');
  }

  const turningUp = prev != null && last.close > prev.close;
  const bullishBody = last.close > last.open;
  if (turningUp || bullishBody) evidence.push('Bullish candle confirmation');

  const volumeWindow = candles.slice(-20).filter((c) => c.volume != null);
  const avgVolume = volumeWindow.length > 0 ? volumeWindow.reduce((sum, c) => sum + (c.volume ?? 0), 0) / volumeWindow.length : 0;
  const recentVolumeWindow = candles.slice(-3).filter((c) => c.volume != null);
  const recentVolume = recentVolumeWindow.length > 0 ? recentVolumeWindow.reduce((sum, c) => sum + (c.volume ?? 0), 0) / recentVolumeWindow.length : 0;
  if (avgVolume > 0 && recentVolume > avgVolume * 1.1) evidence.push('Improving volume');

  return evidence;
}

/**
 * Rules 5, 8 and 9's named score deductions — an early-bounce setup should
 * lose points (not just fail a binary cutoff) the further it drifts from
 * "fresh," whether that's price already extended off support, momentum
 * that's overheated relative to how far price still has to travel, thin
 * proof the support level even holds, or too little room left before
 * resistance to matter.
 */
function detectPenalties(args: {
  distanceFromSupportPct: number;
  roomToResistancePct: number;
  supportTouches: number;
  rsi: number | null;
}): { total: number; labels: string[] } {
  let total = 0;
  const labels: string[] = [];

  if (args.distanceFromSupportPct > 5) {
    const excess = Math.min(args.distanceFromSupportPct - 5, 15);
    total += excess * 1.5;
    labels.push(`Price is already ${args.distanceFromSupportPct.toFixed(1)}% above support — an extended move, not a fresh bounce`);
  }

  if (args.rsi != null && args.rsi >= 70 && args.distanceFromSupportPct > 3) {
    total += 15;
    labels.push(`RSI is elevated at ${args.rsi.toFixed(0)} while price is already away from support`);
  } else if (args.rsi != null && args.rsi >= 80) {
    total += 8;
    labels.push(`RSI is very high at ${args.rsi.toFixed(0)}`);
  }

  if (args.supportTouches < 3) {
    total += 6;
    labels.push('Support has only the minimum touches so far — still relatively untested');
  }

  if (args.roomToResistancePct < 3) {
    total += 10;
    labels.push(`Only ${args.roomToResistancePct.toFixed(1)}% of room left before resistance`);
  }

  return { total, labels };
}

// Weights sum to 100 before penalties: nearness to support is the single biggest factor (rule 4), evidence
// and pattern reliability ("is there a consistent pattern to trade?") come next, then institutional
// participation ("is institutional money involved?") and remaining room to resistance.
const WEIGHTS = { nearness: 35, evidence: 15, pattern: 20, institutional: 15, room: 15 };
const NEARNESS_CAP_PCT = 10; // distance-from-support beyond this contributes nothing further to nearness
const ROOM_CAP_PCT = 20; // room beyond this doesn't add further ranking value
const LIQUIDITY_CAP_MULTIPLE = 5; // dollar volume beyond 5x the floor doesn't add further ranking value

function computeScores(args: {
  distanceFromSupportPct: number;
  roomToResistancePct: number;
  supportTouches: number;
  resistanceTouches: number;
  cycles: number;
  liquidityUsd: number;
  evidenceCount: number;
  penaltyTotal: number;
}): { total: number; patternScore: number; institutionalScore: number; priceActionScore: number } {
  const clampedDistance = Math.max(0, Math.min(args.distanceFromSupportPct, NEARNESS_CAP_PCT));
  const nearnessScore = (1 - clampedDistance / NEARNESS_CAP_PCT) * WEIGHTS.nearness;

  const evidenceScore = Math.min(args.evidenceCount / 5, 1) * WEIGHTS.evidence;

  // "Is there a consistent pattern to trade?" — how well-proven the range itself is.
  const touchesNormalized = Math.min((args.supportTouches + args.resistanceTouches) / 8, 1);
  const cyclesNormalized = Math.min(args.cycles / 3, 1);
  const patternScore = (touchesNormalized * 0.6 + cyclesNormalized * 0.4) * WEIGHTS.pattern;

  // "Is institutional money involved?" — a simple, standard proxy: sustained dollar volume.
  const institutionalScore = Math.min(args.liquidityUsd / (MIN_LIQUIDITY_USD * LIQUIDITY_CAP_MULTIPLE), 1) * WEIGHTS.institutional;

  const roomScore = (Math.min(args.roomToResistancePct, ROOM_CAP_PCT) / ROOM_CAP_PCT) * WEIGHTS.room;

  const rawTotal = nearnessScore + evidenceScore + patternScore + institutionalScore + roomScore;
  const total = Math.max(0, rawTotal - args.penaltyTotal);

  // "What is the price of the chart showing me?" — nearness plus live evidence, net of any price-action penalties.
  const priceActionScore = Math.max(0, nearnessScore + evidenceScore - args.penaltyTotal);

  return { total, patternScore, institutionalScore, priceActionScore };
}

function buildReason(args: {
  distanceFromSupportPct: number;
  roomToResistancePct: number;
  supportTouches: number;
  rsi: number | null;
  evidence: string[];
  penalties: string[];
}): string {
  const parts: string[] = [];

  if (args.penalties.length > 0) {
    parts.push(args.penalties[0]);
  } else if (args.distanceFromSupportPct <= 2) {
    parts.push(`Price is within ${Math.max(args.distanceFromSupportPct, 0).toFixed(1)}% of support`);
  } else {
    parts.push(`Price is ${args.distanceFromSupportPct.toFixed(1)}% above support`);
  }

  parts.push(`${args.supportTouches} support touch${args.supportTouches === 1 ? '' : 'es'}`);

  if (args.evidence.length > 0) {
    parts.push(args.evidence[0].toLowerCase());
  }

  if (args.rsi != null) {
    parts.push(`RSI ${args.rsi.toFixed(0)}`);
  }

  parts.push(`${args.roomToResistancePct.toFixed(1)}% upside to resistance`);

  const sentence = parts.join(', ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

/**
 * The three dashboard sections, all built from the same evaluated pool:
 * Best Bounce Setups is the curated, ranked "act on this" list; Wide
 * Channels is every established >=3% range regardless of where price sits
 * in it (browsing); Near Channel Floor is everything sitting low in its
 * range, ranked purely by distance from support rather than the full
 * weighted score, so it reads as "what's approaching an entry" even before
 * any bounce evidence shows up. None of the three surface a channel whose
 * support is actively failing (status 'breaking') — that's not a bounce
 * opportunity.
 */
export interface BounceSetupSections {
  bestBounceSetups: BounceSetupCandidate[];
  wideChannels: BounceSetupCandidate[];
  nearChannelFloor: BounceSetupCandidate[];
}

/**
 * Runs findPivots -> clusterLevels -> detectChannels fresh on a tail slice
 * of a symbol's candles, instead of reusing whatever channels.ts/scan.ts
 * already computed for the swing/value views — the bounce-setup rules need
 * their own 3-month-primary/6-month-secondary lookback (rules 1-2), not the
 * ~1-month swing span or ~1-year value span those other views use.
 */
function detectLookbackChannels(candles: Candle[], lookbackCandles: number): { slice: Candle[]; channels: Channel[] } {
  const slice = candles.slice(-lookbackCandles);
  const pivots = findPivots(slice, 5);
  const levels = clusterLevels(pivots);
  const channels = detectChannels(slice, levels, { maxSpanCandles: lookbackCandles });
  return { slice, channels };
}

/**
 * Evaluates one symbol's full candle history against the bounce-setup
 * rules: 3 months of history is the primary lookback for support,
 * resistance, and channel detection; 6 months is checked only as a
 * secondary confirmation pass when the 3-month view doesn't turn up a
 * qualifying channel, to catch larger levels a shorter window would miss.
 * Every channel a lookback finds is tried (best-contained first, per
 * channels.ts's own sort) until one clears every gate in
 * evaluateBounceSetup, or the pass comes up empty.
 */
export function evaluateBounceSetupFromHistory(symbol: string, candles: Candle[]): BounceSetupCandidate | null {
  for (const lookback of [PRIMARY_LOOKBACK_CANDLES, SECONDARY_LOOKBACK_CANDLES]) {
    const { slice, channels } = detectLookbackChannels(candles, lookback);
    for (const channel of channels) {
      const candidate = evaluateBounceSetup(symbol, slice, channel);
      if (candidate) return candidate;
    }
  }
  return null;
}

/**
 * Evaluates every live-scanned symbol against the bounce-setup rules.
 * Demo-fallback results are excluded — a fabricated price/channel has no
 * business being called a real bounce setup, same discipline as every
 * other signal in this app.
 */
export function evaluateAllBounceSetups(results: ScanResult[]): BounceSetupCandidate[] {
  const candidates: BounceSetupCandidate[] = [];
  for (const result of results) {
    if (!result.isLive) continue;
    const candidate = evaluateBounceSetupFromHistory(result.symbol, result.candles);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

export function bounceSetupSections(candidates: BounceSetupCandidate[], cap = Infinity): BounceSetupSections {
  const viable = candidates.filter((c) => c.status !== 'breaking');

  const bestBounceSetups = viable
    .filter((c) => c.positionInChannelPct <= MAX_POSITION_PCT)
    .sort((a, b) => b.rankScore - a.rankScore)
    .slice(0, cap);

  const wideChannels = [...viable].sort((a, b) => b.widthPct - a.widthPct);

  const nearChannelFloor = viable
    .filter((c) => c.positionInChannelPct <= MAX_POSITION_PCT)
    .sort((a, b) => a.distanceFromSupportPct - b.distanceFromSupportPct);

  return { bestBounceSetups, wideChannels, nearChannelFloor };
}
