import { describe, expect, it } from 'vitest';
import { classifyTrend, trendFavorsLong, trendScore } from '../trend';
import type { Pivot } from '../types';

function pivot(index: number, type: Pivot['type'], price: number): Pivot {
  return { index, time: index, price, type };
}

describe('classifyTrend', () => {
  it('calls it a strong uptrend with 3+ consecutive higher highs and higher lows', () => {
    const pivots: Pivot[] = [
      pivot(0, 'low', 10),
      pivot(1, 'high', 15),
      pivot(2, 'low', 12),
      pivot(3, 'high', 18),
      pivot(4, 'low', 14),
      pivot(5, 'high', 21),
    ];
    expect(classifyTrend(pivots).direction).toBe('strong_uptrend');
  });

  it('calls it a strong downtrend with 3+ consecutive lower highs and lower lows', () => {
    const pivots: Pivot[] = [
      pivot(0, 'high', 21),
      pivot(1, 'low', 14),
      pivot(2, 'high', 18),
      pivot(3, 'low', 12),
      pivot(4, 'high', 15),
      pivot(5, 'low', 10),
    ];
    expect(classifyTrend(pivots).direction).toBe('strong_downtrend');
  });

  it('calls it sideways when highs and lows disagree', () => {
    const pivots: Pivot[] = [
      pivot(0, 'low', 10),
      pivot(1, 'high', 20),
      pivot(2, 'low', 11),
      pivot(3, 'high', 19),
    ];
    expect(classifyTrend(pivots).direction).toBe('sideways');
  });

  it('calls it sideways with too few pivots to judge', () => {
    expect(classifyTrend([pivot(0, 'low', 10), pivot(1, 'high', 15)]).direction).toBe('sideways');
    expect(classifyTrend([]).direction).toBe('sideways');
  });
});

describe('trendFavorsLong / trendScore', () => {
  it('favors longs only in uptrends', () => {
    expect(trendFavorsLong('strong_uptrend')).toBe(true);
    expect(trendFavorsLong('uptrend')).toBe(true);
    expect(trendFavorsLong('sideways')).toBe(false);
    expect(trendFavorsLong('downtrend')).toBe(false);
    expect(trendFavorsLong('strong_downtrend')).toBe(false);
  });

  it('scores strong uptrend highest and strong downtrend lowest', () => {
    expect(trendScore('strong_uptrend')).toBeGreaterThan(trendScore('uptrend'));
    expect(trendScore('uptrend')).toBeGreaterThan(trendScore('sideways'));
    expect(trendScore('sideways')).toBeGreaterThan(trendScore('downtrend'));
    expect(trendScore('downtrend')).toBeGreaterThan(trendScore('strong_downtrend'));
  });
});
