import { describe, expect, it } from 'vitest';
import { computeTestNumberStats, filterObservations, type SupportTestObservation } from '../supportReliability';
import type { SupportTestRecord } from '../supportTests';

function record(overrides: Partial<SupportTestRecord>): SupportTestRecord {
  return {
    testNumber: 1,
    index: 0,
    date: '2024-01-01',
    time: 0,
    supportZoneLow: 100,
    supportZoneHigh: 101,
    lowestPrice: 100,
    bounceMagnitudePct: 10,
    bounceDurationBars: 5,
    volumeRatio: 1,
    maxFavorableExcursionPct: 10,
    maxAdverseExcursionPct: 1,
    supportFailed: false,
    barsToBreakdown: null,
    outcome: 'bounce',
    ...overrides,
  };
}

function obs(symbol: string, overrides: Partial<SupportTestRecord>, extra: Partial<SupportTestObservation> = {}): SupportTestObservation {
  return { symbol, record: record(overrides), ...extra };
}

describe('computeTestNumberStats', () => {
  it('reports insufficient evidence below the minimum cluster count', () => {
    const observations = [obs('AAA', { testNumber: 1 }), obs('BBB', { testNumber: 1 })];
    const [bucket] = computeTestNumberStats(observations);
    expect(bucket.insufficientEvidence).toBe(true);
    expect(bucket.bounceSuccessRate).toBeNull();
  });

  it('computes a real bounce rate once enough distinct symbols contribute', () => {
    const observations = [
      obs('AAA', { testNumber: 2, outcome: 'bounce' }),
      obs('BBB', { testNumber: 2, outcome: 'bounce' }),
      obs('CCC', { testNumber: 2, outcome: 'breakdown' }),
      obs('DDD', { testNumber: 2, outcome: 'bounce' }),
      obs('EEE', { testNumber: 2, outcome: 'bounce' }),
    ];
    const [bucket] = computeTestNumberStats(observations);
    expect(bucket.insufficientEvidence).toBe(false);
    expect(bucket.sampleSize).toBe(5);
    expect(bucket.clusterCount).toBe(5);
    expect(bucket.bounceSuccessRate).toBeCloseTo(0.8, 5);
    expect(bucket.breakdownRate).toBeCloseTo(0.2, 5);
    expect(bucket.confidenceIntervalLow).toBeGreaterThanOrEqual(0);
    expect(bucket.confidenceIntervalHigh).toBeLessThanOrEqual(1);
    expect(bucket.confidenceIntervalLow!).toBeLessThanOrEqual(bucket.confidenceIntervalHigh!);
  });

  it('excludes unresolved tests from the denominator entirely', () => {
    const observations = [
      obs('AAA', { testNumber: 3, outcome: 'bounce' }),
      obs('BBB', { testNumber: 3, outcome: 'bounce' }),
      obs('CCC', { testNumber: 3, outcome: 'bounce' }),
      obs('DDD', { testNumber: 3, outcome: 'bounce' }),
      obs('EEE', { testNumber: 3, outcome: 'bounce' }),
      obs('FFF', { testNumber: 3, outcome: 'unresolved' }),
    ];
    const [bucket] = computeTestNumberStats(observations);
    expect(bucket.sampleSize).toBe(5);
    expect(bucket.bounceSuccessRate).toBe(1);
  });

  it('does not treat the same symbol appearing many times as many independent clusters', () => {
    // One very active symbol contributes 10 records; 4 other symbols contribute 1 each.
    // Cluster count must be 5 (distinct symbols), not 14 (total records) — and since
    // 5 >= MIN_CLUSTERS the bucket should compute real stats, not "insufficient evidence".
    const observations: SupportTestObservation[] = [];
    for (let i = 0; i < 10; i++) observations.push(obs('NOISY', { testNumber: 4, outcome: i % 2 === 0 ? 'bounce' : 'breakdown' }));
    for (const s of ['BBB', 'CCC', 'DDD', 'EEE']) observations.push(obs(s, { testNumber: 4, outcome: 'bounce' }));

    const [bucket] = computeTestNumberStats(observations);
    expect(bucket.clusterCount).toBe(5);
    expect(bucket.insufficientEvidence).toBe(false);
  });

  it('buckets 6th and later tests together', () => {
    const observations = Array.from({ length: 6 }, (_, i) => obs(`S${i}`, { testNumber: 6 + i, outcome: 'bounce' }));
    const buckets = computeTestNumberStats(observations);
    expect(buckets.map((b) => b.testNumberLabel)).toEqual(['6th+']);
    expect(buckets[0].sampleSize).toBe(6);
  });
});

describe('filterObservations', () => {
  it('narrows by channel type and width band', () => {
    const observations = [
      obs('AAA', {}, { channelType: 'horizontal', widthPct: 18 }),
      obs('BBB', {}, { channelType: 'ascending', widthPct: 18 }),
      obs('CCC', {}, { channelType: 'horizontal', widthPct: 28 }),
    ];
    const result = filterObservations(observations, { channelType: 'horizontal', maxWidthPct: 20 });
    expect(result.map((o) => o.symbol)).toEqual(['AAA']);
  });
});
