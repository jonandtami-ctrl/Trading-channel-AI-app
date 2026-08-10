import type { Level, Pivot } from './types';

/**
 * Groups nearby pivots into price levels. Pivots are sorted by price and
 * merged into a running cluster whenever they fall within tolerancePct of
 * the cluster's current average — this keeps clusters from drifting across
 * a wide price range one small step at a time.
 */
export function clusterLevels(pivots: Pivot[], tolerancePct = 0.015): Level[] {
  const highs = pivots.filter((p) => p.type === 'high');
  const lows = pivots.filter((p) => p.type === 'low');

  return [...buildClusters(lows, 'support', tolerancePct), ...buildClusters(highs, 'resistance', tolerancePct)];
}

function buildClusters(pivots: Pivot[], type: Level['type'], tolerancePct: number): Level[] {
  const sorted = [...pivots].sort((a, b) => a.price - b.price);
  const clusters: Pivot[][] = [];

  for (const pivot of sorted) {
    const current = clusters[clusters.length - 1];
    if (current) {
      const clusterAvg = average(current);
      if (Math.abs(pivot.price - clusterAvg) / clusterAvg <= tolerancePct) {
        current.push(pivot);
        continue;
      }
    }
    clusters.push([pivot]);
  }

  return clusters.map((touches) => ({
    price: average(touches),
    type,
    touches: touches.sort((a, b) => a.index - b.index),
  }));
}

function average(pivots: Pivot[]): number {
  return pivots.reduce((sum, p) => sum + p.price, 0) / pivots.length;
}

const RECENT_LEVEL_CANDLES = 60; // ~3 months of daily bars — matches the channel recency cutoff
const MIN_LEVEL_TOUCHES = 2;
const MAX_DISPLAY_LEVELS = 6;

/**
 * Every well-touched, recently-relevant support/resistance level — including
 * ones that never paired into a fully-formed channel (only one side has
 * enough touches yet, or the pair failed the width/containment checks).
 * Used to show levels "forming" on a chart even when there's no qualifying
 * channel to call a trade plan on.
 */
export function recentLevels(levels: Level[], totalCandles: number): Level[] {
  const cutoff = Math.max(0, totalCandles - RECENT_LEVEL_CANDLES);
  return levels
    .filter((l) => l.touches.length >= MIN_LEVEL_TOUCHES)
    .filter((l) => l.touches[l.touches.length - 1].index >= cutoff)
    .sort((a, b) => b.touches.length - a.touches.length)
    .slice(0, MAX_DISPLAY_LEVELS);
}
