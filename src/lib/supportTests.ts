import type { Candle, Level, Pivot } from './types';
import { classifyVolume } from './volumeAnalysis';
import { levelZone } from './levelZone';

/**
 * Per-visit support-test records — the per-stock half of item 6/the
 * "CRITICAL NEW FEATURE" (support test reliability). The cross-stock
 * statistics half (bounce rate by test number, with confidence intervals)
 * lives in supportReliability.ts and is built from arrays of these records.
 */

export type SupportTestOutcome = 'bounce' | 'breakdown' | 'unresolved';

export interface SupportTestRecord {
  testNumber: number;
  index: number;
  /** ISO date (yyyy-mm-dd) of the test candle. */
  date: string;
  time: number;
  supportZoneLow: number;
  supportZoneHigh: number;
  /** The actual low reached during this visit — not necessarily inside the zone band if it slightly undershot. */
  lowestPrice: number;
  /** Best favorable move (high reached) within the observation window, as % of the test low. */
  bounceMagnitudePct: number;
  /** Bars from the test to the window's highest high. */
  bounceDurationBars: number;
  /** Test candle's volume vs its own trailing average. */
  volumeRatio: number;
  maxFavorableExcursionPct: number;
  maxAdverseExcursionPct: number;
  /** True if price closed meaningfully below the zone's floor at any point in the observation window. */
  supportFailed: boolean;
  /** Bars from the test until the first close below the breakdown floor. Null unless supportFailed. */
  barsToBreakdown: number | null;
  outcome: SupportTestOutcome;
}

const DEFAULT_MIN_GAP_TRADING_DAYS = 5;
const DEFAULT_OBSERVATION_WINDOW_DAYS = 20;
const DEFAULT_BREAKDOWN_TOLERANCE_PCT = 2;
const DEFAULT_BOUNCE_THRESHOLD_PCT = 3;

/**
 * Collapses a run of raw pivots down to independent, time-separated tests
 * — see README item 6 / test case 5: "several consecutive support-touch
 * candles" must count as one test, not several. Pivots within
 * minGapTradingDays of the previous accepted test are treated as the same
 * visit; the most extreme price among them (lowest for a support/low
 * series, highest for a resistance/high series) is that visit's
 * representative touch. Neither channels.ts/levels.ts nor the existing
 * bounceSetup.ts apply this deduplication — this is the first place in the
 * codebase that does. Shared by independentSupportTouches (Level-based)
 * and ascendingChannel.ts (works directly on raw swing pivots, since an
 * ascending channel's touches aren't clustered by price).
 */
export function dedupeTouchesByTime(pivots: Pivot[], minGapTradingDays: number, extreme: 'min' | 'max'): Pivot[] {
  const sorted = [...pivots].sort((a, b) => a.index - b.index);
  if (sorted.length === 0) return [];

  const groups: Pivot[][] = [[sorted[0]]];
  for (const p of sorted.slice(1)) {
    const lastGroup = groups[groups.length - 1];
    if (p.index - lastGroup[lastGroup.length - 1].index < minGapTradingDays) {
      lastGroup.push(p);
    } else {
      groups.push([p]);
    }
  }

  const pickExtreme = extreme === 'min' ? (a: Pivot, b: Pivot) => (b.price < a.price ? b : a) : (a: Pivot, b: Pivot) => (b.price > a.price ? b : a);
  return groups.map((g) => g.reduce(pickExtreme));
}

/**
 * Level-aware convenience wrapper around dedupeTouchesByTime — picks the
 * right extreme direction from the Level's own type. Named for support
 * specifically since that's this module's focus, but works identically on
 * a resistance Level — see the `independentLevelTouches` alias used that
 * way in horizontalRange.ts.
 */
export function independentSupportTouches(level: Level, minGapTradingDays = DEFAULT_MIN_GAP_TRADING_DAYS): Pivot[] {
  return dedupeTouchesByTime(level.touches, minGapTradingDays, level.type === 'support' ? 'min' : 'max');
}

/**
 * Builds a full historical record for every independent test of a support
 * zone: bounce magnitude/duration, volume, MFE/MAE, and whether support
 * ultimately failed — all computed only from candles *after* the test (no
 * look-ahead into the test's own formation), matching channels.ts's own
 * convention of a fixed, explicit observation window rather than an
 * open-ended "whatever happened eventually."
 */
export function buildSupportTestRecords(
  candles: Candle[],
  level: Level,
  opts: {
    minGapTradingDays?: number;
    observationWindowDays?: number;
    breakdownTolerancePct?: number;
    bounceThresholdPct?: number;
  } = {}
): SupportTestRecord[] {
  const minGap = opts.minGapTradingDays ?? DEFAULT_MIN_GAP_TRADING_DAYS;
  const windowDays = opts.observationWindowDays ?? DEFAULT_OBSERVATION_WINDOW_DAYS;
  const breakdownTolerancePct = opts.breakdownTolerancePct ?? DEFAULT_BREAKDOWN_TOLERANCE_PCT;
  const bounceThresholdPct = opts.bounceThresholdPct ?? DEFAULT_BOUNCE_THRESHOLD_PCT;

  const touches = independentSupportTouches(level, minGap);
  const zone = levelZone(level);
  const breakdownFloor = zone.low * (1 - breakdownTolerancePct / 100);

  return touches.map((touch, i) => {
    const windowEnd = Math.min(candles.length, touch.index + 1 + windowDays);
    const window = candles.slice(touch.index + 1, windowEnd);

    const volume = classifyVolume(candles, touch.index);
    const maxHigh = window.length ? Math.max(...window.map((c) => c.high)) : touch.price;
    const minLow = window.length ? Math.min(...window.map((c) => c.low)) : touch.price;

    const mfePct = touch.price > 0 ? ((maxHigh - touch.price) / touch.price) * 100 : 0;
    const maePct = touch.price > 0 ? ((touch.price - minLow) / touch.price) * 100 : 0;

    let bounceDurationBars = window.length;
    for (let j = 0; j < window.length; j++) {
      if (window[j].high === maxHigh) {
        bounceDurationBars = j + 1;
        break;
      }
    }

    const supportFailed = window.some((c) => c.close < breakdownFloor);
    let barsToBreakdown: number | null = null;
    if (supportFailed) {
      const failIndex = window.findIndex((c) => c.close < breakdownFloor);
      barsToBreakdown = failIndex + 1;
    }
    // Only resolved once the observation window has actually completed — a
    // test in the last `windowDays` candles of history hasn't had time to
    // play out yet and must read as unresolved, not as a non-bounce.
    const windowComplete = windowEnd === touch.index + 1 + windowDays;

    let outcome: SupportTestOutcome = 'unresolved';
    if (supportFailed) outcome = 'breakdown';
    else if (windowComplete && mfePct >= bounceThresholdPct) outcome = 'bounce';

    return {
      testNumber: i + 1,
      index: touch.index,
      date: new Date(touch.time * 1000).toISOString().slice(0, 10),
      time: touch.time,
      supportZoneLow: zone.low,
      supportZoneHigh: zone.high,
      lowestPrice: touch.price,
      bounceMagnitudePct: mfePct,
      bounceDurationBars,
      volumeRatio: volume.ratio,
      maxFavorableExcursionPct: mfePct,
      maxAdverseExcursionPct: maePct,
      supportFailed,
      barsToBreakdown,
      outcome,
    };
  });
}

/** Same function as independentSupportTouches, exported under a type-neutral name for call sites (e.g. horizontalRange.ts) that apply it to a resistance Level. */
export const independentLevelTouches = independentSupportTouches;
