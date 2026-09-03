import type { Candle, Channel, ScanResult } from './types';
import { findPivots } from './pivots';
import { classifyTrend } from './trend';
import { classifyChannelDirection } from './channelDirection';
import { channelAgeDays } from './channelAge';
import { countChannelCycles } from './channelCycles';
import { calculateRSI } from './rsi';
import { averageDailyDollarVolume, isLiquid, MIN_LIQUIDITY_USD } from './liquidity';

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
  /** 0 = sitting at support, 100 = sitting at resistance. Can fall outside 0-100 if price has briefly traded past either line. */
  positionInChannelPct: number;
  channelAgeDays: number;
  supportTouches: number;
  resistanceTouches: number;
  /** Null when there isn't enough history yet to seed RSI(14). */
  rsi: number | null;
  status: BounceStatus;
  liquidityUsd: number;
  /** Composite ranking score (see computeRankScore) — higher is a better bounce candidate. Not meant to be displayed, only sorted on. */
  rankScore: number;
}

// Rule 1: minimum total channel width — a range this narrow can't realistically offer a 2%+ target.
export const MIN_CHANNEL_WIDTH_PCT = 3;
// Rule 2: only the bottom quarter of the channel counts as "close enough to support" to matter for a bounce entry.
export const MAX_POSITION_PCT = 25;
// Rule 3: bare-minimum reliability bar — well-formed channels already require 2 touches a side (see channels.ts),
// this just adds the age floor so a channel that only just formed doesn't count as "established."
export const MIN_TOUCHES = 2;
export const MIN_CHANNEL_AGE_DAYS = 30;

/**
 * Evaluates one symbol's channel against the bounce-trading rules (see the
 * BEST_BOUNCE_SETUPS spec): width, reliability, trend, and liquidity are
 * hard gates — a candidate failing any of them isn't a bounce setup at all,
 * not just a low-ranked one. Returns null when the channel doesn't qualify.
 * Callers pick which of the three dashboard sections a qualifying candidate
 * belongs in based on positionInChannelPct/status (see bounceSetupSections
 * below) — this function always returns the full picture regardless of
 * which section will end up showing it.
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

  const rsiSeries = calculateRSI(candles);
  const rsiLast = rsiSeries[rsiSeries.length - 1];
  const rsi = Number.isNaN(rsiLast) ? null : rsiLast;

  const status = determineBounceStatus(channel, candles, positionInChannelPct, rsiSeries);
  const cycles = countChannelCycles(channel, candles).supportToResistanceCycles;

  const rankScore = computeRankScore({
    positionInChannelPct,
    roomToResistancePct,
    supportTouches,
    resistanceTouches,
    cycles,
    status,
    liquidityUsd,
  });

  return {
    symbol,
    currentPrice,
    support: channel.support.price,
    resistance: channel.resistance.price,
    widthPct,
    roomToResistancePct,
    positionInChannelPct,
    channelAgeDays: ageDays,
    supportTouches,
    resistanceTouches,
    rsi,
    status,
    liquidityUsd,
    rankScore,
  };
}

/**
 * Rule 6: GREEN requires being in the bottom quarter of the channel with
 * price beginning to turn up and RSI not still falling — deliberately
 * lenient (a single up-close, RSI not dropping further), since the spec
 * explicitly says not to require perfect confirmation. RED is a support
 * that's visibly failing even if channels.ts's own (looser) break
 * tolerance hasn't flipped channel.status yet — an early warning, not just
 * an after-the-fact label.
 */
function determineBounceStatus(channel: Channel, candles: Candle[], positionInChannelPct: number, rsiSeries: number[]): BounceStatus {
  const last = candles[candles.length - 1];
  if (last.close < channel.support.price * 0.99) return 'breaking';
  if (positionInChannelPct > MAX_POSITION_PCT) return 'in_channel';

  const prev = candles[candles.length - 2];
  const turningUp = prev != null && last.close > prev.close;

  // Compares against the immediately prior reading, not several candles
  // back — a genuine turn shows up as the most recent step ticking up even
  // right after a decline; comparing further back would still see the
  // overall dip and miss that it just started reversing.
  const rsiLast = rsiSeries[rsiSeries.length - 1];
  const rsiPrior = rsiSeries[rsiSeries.length - 2];
  const rsiNotFalling = Number.isNaN(rsiLast) || Number.isNaN(rsiPrior) ? true : rsiLast >= rsiPrior - 1;

  return turningUp && rsiNotFalling ? 'early_bounce' : 'near_support';
}

// Rule 9's priority order (nearness > room > reliability > early-bounce
// evidence > liquidity) implemented as descending weights on a single
// composite score, rather than a strict lexicographic sort — a strict
// lexicographic sort would let an infinitesimal nearness difference always
// beat a huge reliability difference, which isn't what "primarily by"
// means in practice.
const RANK_WEIGHTS = { nearness: 40, room: 25, reliability: 15, earlyBounce: 12, liquidity: 8 };
const ROOM_CAP_PCT = 20; // room beyond this doesn't add further ranking value
const LIQUIDITY_CAP_MULTIPLE = 5; // dollar volume beyond 5x the floor doesn't add further ranking value

function computeRankScore(args: {
  positionInChannelPct: number;
  roomToResistancePct: number;
  supportTouches: number;
  resistanceTouches: number;
  cycles: number;
  status: BounceStatus;
  liquidityUsd: number;
}): number {
  const clampedPosition = Math.max(0, Math.min(100, args.positionInChannelPct));
  const nearnessScore = (1 - clampedPosition / 100) * RANK_WEIGHTS.nearness;

  const roomScore = Math.min(args.roomToResistancePct, ROOM_CAP_PCT) / ROOM_CAP_PCT * RANK_WEIGHTS.room;

  const touchesNormalized = Math.min((args.supportTouches + args.resistanceTouches) / 8, 1);
  const cyclesNormalized = Math.min(args.cycles / 3, 1);
  const reliabilityScore = (touchesNormalized * 0.6 + cyclesNormalized * 0.4) * RANK_WEIGHTS.reliability;

  const earlyBounceScore = args.status === 'early_bounce' ? RANK_WEIGHTS.earlyBounce : args.status === 'near_support' ? RANK_WEIGHTS.earlyBounce * 0.5 : 0;

  const liquidityScore = Math.min(args.liquidityUsd / (MIN_LIQUIDITY_USD * LIQUIDITY_CAP_MULTIPLE), 1) * RANK_WEIGHTS.liquidity;

  return nearnessScore + roomScore + reliabilityScore + earlyBounceScore + liquidityScore;
}

/**
 * The three dashboard sections, all built from the same evaluated pool:
 * Best Bounce Setups is the curated, ranked "act on this" list; Wide
 * Channels is every established >=3% range regardless of where price sits
 * in it (browsing); Near Channel Floor is everything sitting low in its
 * range, ranked purely by nearness rather than the full weighted score, so
 * it reads as "what's approaching an entry" even before any bounce
 * evidence shows up. None of the three surface a channel whose support is
 * actively failing (status 'breaking') — that's not a bounce opportunity.
 */
export interface BounceSetupSections {
  bestBounceSetups: BounceSetupCandidate[];
  wideChannels: BounceSetupCandidate[];
  nearChannelFloor: BounceSetupCandidate[];
}

/**
 * Evaluates a scanned symbol against the bounce-setup rules using its wide
 * (~1-year) valueChannels rather than the tight ~1-month swing channels —
 * an established, multi-month sideways range like the spec's ZTS example
 * won't even exist in the swing-capped span. Only the best (first)
 * detected channel is considered, matching the convention the rest of
 * scan.ts already uses (see channelReliabilityScore). Demo-fallback
 * results are excluded — a fabricated price/channel has no business being
 * called a real bounce setup, same discipline as every other signal in
 * this app.
 */
export function evaluateAllBounceSetups(results: ScanResult[]): BounceSetupCandidate[] {
  const candidates: BounceSetupCandidate[] = [];
  for (const result of results) {
    if (!result.isLive) continue;
    const channel = (result.valueChannels ?? result.channels)[0];
    if (!channel) continue;
    const candidate = evaluateBounceSetup(result.symbol, result.candles, channel);
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
    .sort((a, b) => a.positionInChannelPct - b.positionInChannelPct);

  return { bestBounceSetups, wideChannels, nearChannelFloor };
}
