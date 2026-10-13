import type { SupportTestRecord } from './supportTests';

/**
 * Cross-stock Support Reliability statistics — the part of item 6 that
 * asks "does a 4th test behave differently from a 2nd test, across real
 * history?" This is deliberately separate from supportTests.ts (which only
 * builds per-stock records): computing real rates needs many stocks' tests
 * pooled together, and — per the spec's explicit warning — overlapping
 * tests from the same stock are NOT independent observations. Each
 * SYMBOL is treated as one cluster; a bucket's confidence interval comes
 * from the variance *between* clusters' own success rates, not from
 * treating every individual test as an independent coin flip. This is a
 * real, standard technique for clustered binary data (not a from-scratch
 * invention), just computed by hand here rather than via a stats package.
 */

export interface SupportTestObservation {
  symbol: string;
  record: SupportTestRecord;
  channelType?: 'horizontal' | 'ascending';
  widthPct?: number;
  atrPct?: number;
  /** Whether price reached the opposite range boundary within the observation window — optional, only set when the caller knows the resistance context. */
  reachedOppositeBoundary?: boolean;
}

export interface TestNumberBucketStats {
  testNumberLabel: string;
  sampleSize: number;
  clusterCount: number;
  bounceSuccessRate: number | null;
  breakdownRate: number | null;
  avgBouncePct: number | null;
  medianBouncePct: number | null;
  avgBarsToBounce: number | null;
  avgBarsToBreakdown: number | null;
  pctReachingOppositeBoundary: number | null;
  /** 95% CI on bounceSuccessRate, cluster-adjusted (see module docstring). Null when insufficientEvidence. */
  confidenceIntervalLow: number | null;
  confidenceIntervalHigh: number | null;
  insufficientEvidence: boolean;
}

// Below this many distinct stocks contributing to a bucket, don't report a
// rate at all — "insufficient historical evidence," not a shaky guess.
const MIN_CLUSTERS = 5;

// Two-tailed 95% Student's t critical values, df 1-29; converges to the
// normal approximation (1.96) from df=30 on. Standard textbook values.
const T_TABLE_95: Record<number, number> = {
  1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
  11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131, 16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
  21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060, 26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045,
};

function tCritical95(df: number): number {
  if (df >= 30) return 1.96;
  return T_TABLE_95[Math.max(1, Math.round(df))] ?? 1.96;
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function sampleVariance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = average(values);
  return values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
}

const BUCKET_ORDER = ['1st', '2nd', '3rd', '4th', '5th', '6th+'];

function bucketLabel(testNumber: number): string {
  if (testNumber >= 6) return '6th+';
  return BUCKET_ORDER[testNumber - 1];
}

/**
 * Buckets observations by test sequence number (1st, 2nd, ... 6th+) and
 * computes real historical statistics for each bucket — never a
 * hardcoded/illustrative number. Only resolved tests (bounce or breakdown)
 * count toward rates; 'unresolved' tests (too recent to have played out)
 * are excluded from the denominator entirely rather than silently counted
 * as failures or successes.
 */
export function computeTestNumberStats(observations: SupportTestObservation[]): TestNumberBucketStats[] {
  const resolved = observations.filter((o) => o.record.outcome !== 'unresolved');

  const byBucket = new Map<string, SupportTestObservation[]>();
  for (const obs of resolved) {
    const label = bucketLabel(obs.record.testNumber);
    if (!byBucket.has(label)) byBucket.set(label, []);
    byBucket.get(label)!.push(obs);
  }

  return BUCKET_ORDER.filter((label) => byBucket.has(label)).map((label) => computeBucketStats(label, byBucket.get(label)!));
}

function computeBucketStats(label: string, obs: SupportTestObservation[]): TestNumberBucketStats {
  const sampleSize = obs.length;

  const bySymbol = new Map<string, SupportTestObservation[]>();
  for (const o of obs) {
    if (!bySymbol.has(o.symbol)) bySymbol.set(o.symbol, []);
    bySymbol.get(o.symbol)!.push(o);
  }
  const clusterCount = bySymbol.size;

  if (clusterCount < MIN_CLUSTERS) {
    return {
      testNumberLabel: label,
      sampleSize,
      clusterCount,
      bounceSuccessRate: null,
      breakdownRate: null,
      avgBouncePct: null,
      medianBouncePct: null,
      avgBarsToBounce: null,
      avgBarsToBreakdown: null,
      pctReachingOppositeBoundary: null,
      confidenceIntervalLow: null,
      confidenceIntervalHigh: null,
      insufficientEvidence: true,
    };
  }

  const bounces = obs.filter((o) => o.record.outcome === 'bounce');
  const breakdowns = obs.filter((o) => o.record.outcome === 'breakdown');

  const bounceSuccessRate = bounces.length / sampleSize;
  const breakdownRate = breakdowns.length / sampleSize;

  const boundaryObs = obs.filter((o) => o.reachedOppositeBoundary != null);
  const pctReachingOppositeBoundary = boundaryObs.length
    ? boundaryObs.filter((o) => o.reachedOppositeBoundary).length / boundaryObs.length
    : null;

  // Cluster-level bounce rate per symbol — the unit the confidence interval is actually built on.
  const clusterRates = Array.from(bySymbol.values()).map(
    (symbolObs) => symbolObs.filter((o) => o.record.outcome === 'bounce').length / symbolObs.length
  );
  const clusterMean = average(clusterRates);
  const clusterVar = sampleVariance(clusterRates);
  const standardError = Math.sqrt(clusterVar / clusterCount);
  const tCrit = tCritical95(clusterCount - 1);

  const ciLow = Math.max(0, clusterMean - tCrit * standardError);
  const ciHigh = Math.min(1, clusterMean + tCrit * standardError);

  return {
    testNumberLabel: label,
    sampleSize,
    clusterCount,
    bounceSuccessRate,
    breakdownRate,
    avgBouncePct: bounces.length ? average(bounces.map((o) => o.record.bounceMagnitudePct)) : null,
    medianBouncePct: bounces.length ? median(bounces.map((o) => o.record.bounceMagnitudePct)) : null,
    avgBarsToBounce: bounces.length ? average(bounces.map((o) => o.record.bounceDurationBars)) : null,
    avgBarsToBreakdown: breakdowns.length
      ? average(breakdowns.filter((o) => o.record.barsToBreakdown != null).map((o) => o.record.barsToBreakdown as number))
      : null,
    pctReachingOppositeBoundary,
    confidenceIntervalLow: ciLow,
    confidenceIntervalHigh: ciHigh,
    insufficientEvidence: false,
  };
}

/**
 * Narrows a set of observations to one stratification slice (e.g. only
 * horizontal ranges, or only the 20-25% width bucket) before handing them
 * to computeTestNumberStats — this is the practical, honest stand-in for
 * "control for X": slice the data and look at the same statistic within
 * the slice, rather than claiming a multivariate causal model this
 * codebase doesn't have the data (sector, market regime) to actually fit.
 */
export function filterObservations(
  observations: SupportTestObservation[],
  filter: { channelType?: 'horizontal' | 'ascending'; minWidthPct?: number; maxWidthPct?: number; minAtrPct?: number; maxAtrPct?: number }
): SupportTestObservation[] {
  return observations.filter((o) => {
    if (filter.channelType != null && o.channelType !== filter.channelType) return false;
    if (filter.minWidthPct != null && (o.widthPct == null || o.widthPct < filter.minWidthPct)) return false;
    if (filter.maxWidthPct != null && (o.widthPct == null || o.widthPct > filter.maxWidthPct)) return false;
    if (filter.minAtrPct != null && (o.atrPct == null || o.atrPct < filter.minAtrPct)) return false;
    if (filter.maxAtrPct != null && (o.atrPct == null || o.atrPct > filter.maxAtrPct)) return false;
    return true;
  });
}
