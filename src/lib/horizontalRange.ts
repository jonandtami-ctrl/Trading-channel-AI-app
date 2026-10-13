import type { Candle, Channel } from './types';
import { findPivots } from './pivots';
import { clusterLevels } from './levels';
import { detectChannels } from './channels';
import { calculateATR } from './atr';
import { levelZone } from './levelZone';
import { independentSupportTouches, independentLevelTouches } from './supportTests';

/**
 * Wide horizontal range detection (item 4) — deliberately a separate
 * detector from channels.ts's default swing-channel pass (1-15% wide, ~1
 * month span), which is tuned for a different purpose. This one targets
 * the user's actual preferred setup: a 15-30%-wide, multi-week/month
 * range with several proven touches on each side.
 */

export type RangeLookbackDays = 30 | 60 | 90;

export interface HorizontalRangeResult {
  lookbackDays: RangeLookbackDays;
  support: number;
  supportZoneLow: number;
  supportZoneHigh: number;
  resistance: number;
  resistanceZoneLow: number;
  resistanceZoneHigh: number;
  /** (resistance - support) / support * 100 — see upside.ts for why this is NOT the same as remaining upside. */
  widthPct: number;
  supportTouches: number;
  resistanceTouches: number;
  containmentPct: number;
  status: Channel['status'];
  qualityScore: number;
  /** The underlying detected channel (and the exact candle slice it was detected from) — needed downstream to build per-test support records; indices in channel.support/resistance.touches are positions into this slice, not the original full candle array. */
  channel: Channel;
  slice: Candle[];
}

const DEFAULT_MIN_WIDTH_PCT = 15;
const DEFAULT_MAX_WIDTH_PCT = 30;
const MIN_SUPPORT_TOUCHES = 3;
const MIN_RESISTANCE_TOUCHES = 2;
const MIN_TOUCH_GAP_TRADING_DAYS = 5;
// Clustering tolerance scales with how much the stock actually moves day to
// day (ATR%) rather than a fixed percent — a quiet utility and a volatile
// small-cap shouldn't use the same tolerance band for "is this the same
// touch." Bounded so an extremely calm or extremely volatile name doesn't
// produce a degenerate (too tight / too loose) tolerance.
const ATR_TOLERANCE_MULTIPLIER = 0.6;
const MIN_TOLERANCE_PCT = 1.0;
const MAX_TOLERANCE_PCT = 4.0;
const MIN_CANDLES_PAD = 15;

/**
 * Finds the single best qualifying wide horizontal range over the given
 * lookback, or null if none qualifies. "Best" = most combined independent
 * touches (richest, most-proven range) among candidates that clear the
 * touch-count and width gates.
 */
export function detectHorizontalRange(
  candles: Candle[],
  lookbackDays: RangeLookbackDays = 60,
  opts: { minWidthPct?: number; maxWidthPct?: number } = {}
): HorizontalRangeResult | null {
  if (candles.length < lookbackDays + MIN_CANDLES_PAD) return null;
  const slice = candles.slice(-lookbackDays);

  const tolerancePct = atrAwareTolerancePct(slice);
  const pivots = findPivots(slice, 5);
  const levels = clusterLevels(pivots, tolerancePct);
  const channels = detectChannels(slice, levels, {
    maxSpanCandles: lookbackDays,
    minWidthPct: opts.minWidthPct ?? DEFAULT_MIN_WIDTH_PCT,
    maxWidthPct: opts.maxWidthPct ?? DEFAULT_MAX_WIDTH_PCT,
  });

  let best: { channel: Channel; supportTouches: number; resistanceTouches: number } | null = null;
  for (const channel of channels) {
    const supportTouches = independentSupportTouches(channel.support, MIN_TOUCH_GAP_TRADING_DAYS).length;
    const resistanceTouches = independentLevelTouches(channel.resistance, MIN_TOUCH_GAP_TRADING_DAYS).length;
    if (supportTouches < MIN_SUPPORT_TOUCHES || resistanceTouches < MIN_RESISTANCE_TOUCHES) continue;
    if (!best || supportTouches + resistanceTouches > best.supportTouches + best.resistanceTouches) {
      best = { channel, supportTouches, resistanceTouches };
    }
  }
  if (!best) return null;

  const { channel, supportTouches, resistanceTouches } = best;
  const supportZone = levelZone(channel.support);
  const resistanceZone = levelZone(channel.resistance);

  return {
    lookbackDays,
    support: channel.support.price,
    supportZoneLow: supportZone.low,
    supportZoneHigh: supportZone.high,
    resistance: channel.resistance.price,
    resistanceZoneLow: resistanceZone.low,
    resistanceZoneHigh: resistanceZone.high,
    widthPct: channel.widthPct,
    supportTouches,
    resistanceTouches,
    containmentPct: channel.containmentPct,
    status: channel.status,
    qualityScore: computeChannelQualityScore({
      supportTouches,
      resistanceTouches,
      containmentPct: channel.containmentPct,
      widthPct: channel.widthPct,
      minWidthPct: opts.minWidthPct ?? DEFAULT_MIN_WIDTH_PCT,
      maxWidthPct: opts.maxWidthPct ?? DEFAULT_MAX_WIDTH_PCT,
    }),
    channel,
    slice,
  };
}

function atrAwareTolerancePct(slice: Candle[]): number {
  const atrSeries = calculateATR(slice, 14);
  const lastAtr = atrSeries[atrSeries.length - 1];
  const lastClose = slice[slice.length - 1]?.close ?? 0;
  const atrPct = lastAtr && lastClose > 0 && !Number.isNaN(lastAtr) ? (lastAtr / lastClose) * 100 : 1.5;
  return Math.min(MAX_TOLERANCE_PCT, Math.max(MIN_TOLERANCE_PCT, atrPct * ATR_TOLERANCE_MULTIPLIER)) / 100;
}

/**
 * Channel Quality Score (0-100): touch richness (how many proven,
 * independent touches on both sides), containment (how much of the time
 * price actually stayed inside the range), and how centered the width is
 * within the requested band (a 22%-wide range is a cleaner fit for "15-30%
 * preferred" than one barely scraping in at 15.1% or 29.9%).
 */
function computeChannelQualityScore(args: {
  supportTouches: number;
  resistanceTouches: number;
  containmentPct: number;
  widthPct: number;
  minWidthPct: number;
  maxWidthPct: number;
}): number {
  const touchScore = Math.min(1, (args.supportTouches + args.resistanceTouches) / 10) * 40;
  const containmentScore = (args.containmentPct / 100) * 35;
  const mid = (args.minWidthPct + args.maxWidthPct) / 2;
  const halfBand = (args.maxWidthPct - args.minWidthPct) / 2 || 1;
  const widthScore = (1 - Math.min(1, Math.abs(args.widthPct - mid) / halfBand)) * 25;
  return Math.round(Math.max(0, Math.min(100, touchScore + containmentScore + widthScore)));
}
