import type { Candle } from './types';
import { calculateATR } from './atr';
import { classifyVolume } from './volumeAnalysis';
import type { SupportTestRecord } from './supportTests';

/**
 * Breakdown Risk Score (item 7) — a continuous 0-100 risk read built only
 * from factors this app can actually observe (price/volume history). No
 * "broad market weakness" factor: that needs an index/benchmark series
 * this app doesn't fetch anywhere, so it's left out rather than faked —
 * flagged here so it isn't silently missing from the score with no
 * explanation.
 */

export type RangeHealth = 'healthy' | 'weakening' | 'breakdown_warning' | 'broken';

export const RANGE_HEALTH_LABELS: Record<RangeHealth, string> = {
  healthy: 'HEALTHY RANGE',
  weakening: 'WEAKENING RANGE',
  breakdown_warning: 'BREAKDOWN WARNING',
  broken: 'BROKEN RANGE',
};

export interface BreakdownRiskResult {
  score: number;
  health: RangeHealth;
  factors: string[];
}

export type BreakdownConfirmationRule = 'close_below_then_no_reclaim' | 'atr_based';

export interface BreakdownConfirmationConfig {
  rule: BreakdownConfirmationRule;
  /** For close_below_then_no_reclaim: sessions allowed to reclaim before the breakdown counts as confirmed. */
  reclaimWindowSessions: number;
  /** For atr_based: how many ATRs below the support floor counts as confirmed immediately, no reclaim grace period. */
  atrMultiple: number;
}

export const DEFAULT_BREAKDOWN_CONFIG: BreakdownConfirmationConfig = {
  rule: 'close_below_then_no_reclaim',
  reclaimWindowSessions: 3,
  atrMultiple: 1.5,
};

/**
 * Whether a breakdown is actually CONFIRMED per the configured rule — never
 * inferred from "price looks weak." close_below_then_no_reclaim: the most
 * recent close-below-support event must be at least reclaimWindowSessions
 * old with no close back above support since. atr_based: a single close
 * that far below support in ATR terms confirms immediately (no grace
 * period — a move that large isn't a shakeout candidate).
 */
export function isBreakdownConfirmed(
  candles: Candle[],
  supportZoneLow: number,
  config: BreakdownConfirmationConfig = DEFAULT_BREAKDOWN_CONFIG
): boolean {
  if (candles.length === 0) return false;
  const last = candles[candles.length - 1];

  if (config.rule === 'atr_based') {
    const atrSeries = calculateATR(candles, 14);
    const atr = atrSeries[atrSeries.length - 1];
    if (!atr || Number.isNaN(atr)) return false;
    return (supportZoneLow - last.close) / atr >= config.atrMultiple;
  }

  // close_below_then_no_reclaim: price must be below support *right now* and
  // have stayed there (a continuous run of closes below the zone, ending at
  // the latest candle) for at least reclaimWindowSessions. Using "sessions
  // since the most recent close below support" instead would always read 0
  // while a breakdown is ongoing (today's close is itself below support),
  // so this walks back to find where the current below-support run began.
  if (last.close >= supportZoneLow) return false;

  let episodeStart = candles.length - 1;
  while (episodeStart > 0 && candles[episodeStart - 1].close < supportZoneLow) episodeStart--;
  const sessionsBelow = candles.length - episodeStart;
  return sessionsBelow > config.reclaimWindowSessions;
}

function isDeclining(values: number[]): boolean {
  if (values.length < 2) return false;
  for (let i = 1; i < values.length; i++) if (values[i] >= values[i - 1]) return false;
  return true;
}

function average(values: number[]): number {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

export function computeBreakdownRisk(
  candles: Candle[],
  supportZoneLow: number,
  supportZoneHigh: number,
  testRecords: SupportTestRecord[],
  config: BreakdownConfirmationConfig = DEFAULT_BREAKDOWN_CONFIG
): BreakdownRiskResult {
  const confirmed = isBreakdownConfirmed(candles, supportZoneLow, config);
  if (confirmed) {
    return { score: 100, health: 'broken', factors: ['Confirmed breakdown: a close below support with no reclaim within the configured window.'] };
  }

  const factors: string[] = [];
  let risk = 0;
  const last = candles[candles.length - 1];

  // Successive rally highs off support getting smaller — "support holding, demand weakening."
  const resolvedBounces = testRecords.filter((t) => t.outcome === 'bounce').slice(-3);
  if (resolvedBounces.length >= 2 && isDeclining(resolvedBounces.map((t) => t.bounceMagnitudePct))) {
    risk += 20;
    factors.push('Successive bounces off support have produced smaller rallies each time.');
  }

  // Repeated closes hugging the floor recently.
  const recent = candles.slice(-10);
  const closesNearSupport = recent.filter((c) => Math.abs(c.close - supportZoneLow) / supportZoneLow <= 0.02).length;
  if (closesNearSupport >= 3) {
    risk += 15;
    factors.push(`${closesNearSupport} of the last 10 closes have stayed within 2% of support.`);
  }

  // Recent tests failing to produce a real bounce.
  const recentTests = testRecords.slice(-3);
  const failedRecent = recentTests.filter((t) => t.outcome !== 'bounce').length;
  if (recentTests.length >= 2 && failedRecent >= recentTests.length - 1) {
    risk += 15;
    factors.push('Recent tests of support have failed to produce a confirmed bounce.');
  }

  // Volatility expanding heading into the zone — less orderly than earlier tests.
  const atrSeries = calculateATR(candles, 14);
  const atrNow = atrSeries[atrSeries.length - 1];
  const atrBefore = atrSeries[Math.max(0, atrSeries.length - 11)];
  if (atrNow && atrBefore && !Number.isNaN(atrNow) && !Number.isNaN(atrBefore) && atrNow > atrBefore * 1.25) {
    risk += 15;
    factors.push('Volatility has expanded heading into support compared to two weeks ago.');
  }

  // Elevated selling volume on the latest down candle.
  const lastVol = classifyVolume(candles, candles.length - 1);
  if (last.close < last.open && (lastVol.level === 'elevated' || lastVol.level === 'high')) {
    risk += 15;
    factors.push('Selling volume is elevated on the most recent down candle.');
  }

  // Tight compression right at the floor — can resolve sharply either way.
  const lastFew = candles.slice(-5);
  const rangeNow = lastFew.length ? Math.max(...lastFew.map((c) => c.high)) - Math.min(...lastFew.map((c) => c.low)) : 0;
  const rangePct = last.close > 0 ? (rangeNow / last.close) * 100 : 0;
  if (rangePct < 2 && last.close <= supportZoneHigh * 1.02) {
    risk += 10;
    factors.push('Price has compressed into a tight range right at support.');
  }

  risk = Math.max(0, Math.min(99, risk)); // 100 is reserved for a confirmed breakdown specifically

  let health: RangeHealth;
  if (risk >= 60) health = 'breakdown_warning';
  else if (risk >= 30) health = 'weakening';
  else health = 'healthy';

  if (factors.length === 0) factors.push('No weakening signals detected in the available price/volume history.');

  return { score: risk, health, factors };
}

/**
 * Market-regime context (e.g. a benchmark index trend) is intentionally
 * NOT a factor above — this app has no index/benchmark data source. Any
 * caller surfacing this score should say so explicitly rather than imply
 * it already accounts for broad market conditions.
 */
export const BREAKDOWN_RISK_MISSING_FACTORS = ['Broad market/index weakness is not evaluated — no benchmark data source is available.'];
