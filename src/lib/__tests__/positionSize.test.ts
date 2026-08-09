import { describe, expect, it } from 'vitest';
import { calculatePositionSize } from '../positionSize';

describe('calculatePositionSize', () => {
  it('matches the spec worked example: $10k account, 1% risk, $40 entry, $39.50 stop -> 200 shares', () => {
    const result = calculatePositionSize(10000, 1, 40, 39.5);
    expect(result).not.toBeNull();
    expect(result?.riskPerShare).toBeCloseTo(0.5, 5);
    expect(result?.dollarRisk).toBeCloseTo(100, 5);
    expect(result?.shares).toBe(200);
  });

  it('rounds down so actual dollar risk never exceeds the target', () => {
    // $100 risk / $0.60 per share = 166.67 -> floors to 166 shares.
    const result = calculatePositionSize(10000, 1, 40, 39.4);
    expect(result?.shares).toBe(166);
  });

  it('returns null when the stop is not below the entry (no risk defined)', () => {
    expect(calculatePositionSize(10000, 1, 40, 40)).toBeNull();
    expect(calculatePositionSize(10000, 1, 40, 40.5)).toBeNull();
  });

  it('returns null for a non-positive account size or risk percentage', () => {
    expect(calculatePositionSize(0, 1, 40, 39.5)).toBeNull();
    expect(calculatePositionSize(10000, 0, 40, 39.5)).toBeNull();
  });
});
