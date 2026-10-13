import type { Candle } from './types';
import { findPivots } from './pivots';
import { dedupeTouchesByTime } from './supportTests';

/**
 * Ascending channel detection (item 5) — rising support AND rising
 * resistance, fit with Theil-Sen regression (the median of all pairwise
 * slopes between touches) rather than ordinary least squares, since a
 * single outlier touch shouldn't be able to swing the whole trendline —
 * this is the "robust trendline fitting" the spec asks for. Projects both
 * lines to the *current* bar rather than reporting the original historical
 * boundaries as though they're still where the channel started.
 */

export interface AscendingChannelResult {
  lookbackDays: number;
  supportSlopePerBar: number;
  resistanceSlopePerBar: number;
  projectedSupport: number;
  projectedResistance: number;
  widthPct: number;
  higherLowCount: number;
  higherHighCount: number;
  upsideToProjectedResistancePct: number;
  qualityScore: number;
}

const MIN_HIGHER_LOWS = 3;
const MIN_HIGHER_HIGHS = 2;
const MIN_TOUCH_GAP_TRADING_DAYS = 5;
const MIN_WIDTH_PCT = 8; // sufficient width to be worth trading, looser than the horizontal-range band since ascending channels are a different shape
// Resistance's slope must sit within this multiple of support's slope (and
// vice versa) to count as "approximately parallel" — too far apart means
// the channel is converging/diverging, not a clean parallel channel.
const PARALLEL_TOLERANCE_RATIO = 2.5;
const MIN_CANDLES_PAD = 15;

interface Point {
  x: number;
  y: number;
}

/** Theil-Sen slope/intercept: median of all pairwise slopes, then median of the resulting per-point intercepts. Robust to a single outlier touch, unlike OLS. */
function theilSen(points: Point[]): { slope: number; intercept: number } {
  const slopes: number[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      if (dx === 0) continue;
      slopes.push((points[j].y - points[i].y) / dx);
    }
  }
  if (slopes.length === 0) return { slope: 0, intercept: points[0]?.y ?? 0 };

  const slope = median(slopes);
  const intercepts = points.map((p) => p.y - slope * p.x);
  return { slope, intercept: median(intercepts) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isNonDecreasingSequence(prices: number[]): boolean {
  for (let i = 1; i < prices.length; i++) if (prices[i] < prices[i - 1]) return false;
  return true;
}

export function detectAscendingChannel(
  candles: Candle[],
  lookbackDays = 90,
  opts: { minWidthPct?: number } = {}
): AscendingChannelResult | null {
  if (candles.length < lookbackDays + MIN_CANDLES_PAD) return null;
  const slice = candles.slice(-lookbackDays);
  const lastIndex = slice.length - 1;
  const currentPrice = slice[lastIndex].close;

  const pivots = findPivots(slice, 5);
  const rawLows = pivots.filter((p) => p.type === 'low');
  const rawHighs = pivots.filter((p) => p.type === 'high');

  const lows = dedupeTouchesByTime(rawLows, MIN_TOUCH_GAP_TRADING_DAYS, 'min');
  const highs = dedupeTouchesByTime(rawHighs, MIN_TOUCH_GAP_TRADING_DAYS, 'max');

  if (lows.length < MIN_HIGHER_LOWS || highs.length < MIN_HIGHER_HIGHS) return null;

  // "At least N higher swing lows/highs" — require the sequence to be
  // genuinely non-decreasing, not just a net rise with wiggles, same bar
  // classifyChannelDirection applies to horizontal/descending classification elsewhere.
  if (!isNonDecreasingSequence(lows.map((p) => p.price))) return null;
  if (!isNonDecreasingSequence(highs.map((p) => p.price))) return null;

  const supportFit = theilSen(lows.map((p) => ({ x: p.index, y: p.price })));
  const resistanceFit = theilSen(highs.map((p) => ({ x: p.index, y: p.price })));

  // Must actually be rising — a flat or negative Theil-Sen slope means the
  // "non-decreasing sequence" check above was satisfied by ties alone, not
  // a real uptrend; reject it here rather than call it ascending.
  if (supportFit.slope <= 0 || resistanceFit.slope <= 0) return null;

  const slopeRatio = supportFit.slope / resistanceFit.slope;
  if (slopeRatio > PARALLEL_TOLERANCE_RATIO || slopeRatio < 1 / PARALLEL_TOLERANCE_RATIO) return null;

  const projectedSupport = supportFit.slope * lastIndex + supportFit.intercept;
  const projectedResistance = resistanceFit.slope * lastIndex + resistanceFit.intercept;
  if (projectedResistance <= projectedSupport || projectedSupport <= 0) return null;

  const widthPct = ((projectedResistance - projectedSupport) / projectedSupport) * 100;
  const minWidthPct = opts.minWidthPct ?? MIN_WIDTH_PCT;
  if (widthPct < minWidthPct) return null;

  // No confirmed breakdown: the current close shouldn't already be well
  // below the projected (today's) support line.
  if (currentPrice < projectedSupport * 0.97) return null;

  const upsideToProjectedResistancePct = ((projectedResistance - currentPrice) / currentPrice) * 100;

  return {
    lookbackDays,
    supportSlopePerBar: supportFit.slope,
    resistanceSlopePerBar: resistanceFit.slope,
    projectedSupport,
    projectedResistance,
    widthPct,
    higherLowCount: lows.length,
    higherHighCount: highs.length,
    upsideToProjectedResistancePct,
    qualityScore: computeQualityScore({ lowCount: lows.length, highCount: highs.length, slopeRatio, widthPct, minWidthPct }),
  };
}

function computeQualityScore(args: { lowCount: number; highCount: number; slopeRatio: number; widthPct: number; minWidthPct: number }): number {
  const touchScore = Math.min(1, (args.lowCount + args.highCount) / 8) * 45;
  // How close the two slopes are to exactly parallel (ratio of 1) — closer is better.
  const parallelCloseness = 1 - Math.min(1, Math.abs(Math.log(args.slopeRatio)) / Math.log(PARALLEL_TOLERANCE_RATIO));
  const parallelScore = parallelCloseness * 30;
  const widthScore = Math.min(1, args.widthPct / (args.minWidthPct * 2)) * 25;
  return Math.round(Math.max(0, Math.min(100, touchScore + parallelScore + widthScore)));
}
