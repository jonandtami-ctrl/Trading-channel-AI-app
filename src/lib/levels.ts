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
