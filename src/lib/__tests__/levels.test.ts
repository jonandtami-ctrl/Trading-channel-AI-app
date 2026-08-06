import { describe, expect, it } from 'vitest';
import { clusterLevels } from '../levels';
import type { Pivot } from '../types';

function pivot(index: number, price: number, type: 'high' | 'low'): Pivot {
  return { index, time: index, price, type };
}

describe('clusterLevels', () => {
  it('groups nearby lows into a single support level', () => {
    const pivots: Pivot[] = [pivot(0, 100, 'low'), pivot(5, 100.5, 'low'), pivot(10, 99.7, 'low')];
    const levels = clusterLevels(pivots);
    expect(levels).toHaveLength(1);
    expect(levels[0].type).toBe('support');
    expect(levels[0].touches).toHaveLength(3);
  });

  it('keeps far-apart pivots as separate levels', () => {
    const pivots: Pivot[] = [pivot(0, 100, 'low'), pivot(5, 150, 'low')];
    const levels = clusterLevels(pivots);
    expect(levels).toHaveLength(2);
  });

  it('separates support and resistance clusters even at the same price', () => {
    const pivots: Pivot[] = [pivot(0, 100, 'low'), pivot(5, 100, 'high')];
    const levels = clusterLevels(pivots);
    expect(levels).toHaveLength(2);
    expect(levels.map((l) => l.type).sort()).toEqual(['resistance', 'support']);
  });
});
