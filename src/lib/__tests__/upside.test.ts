import { describe, expect, it } from 'vitest';
import { computeUpside } from '../upside';

describe('computeUpside', () => {
  it('separates channel width from actual remaining upside (the spec’s own worked example)', () => {
    // Support $20, Resistance $24, current price $21.50 -> width 20%, actual upside 11.63%.
    const result = computeUpside(20, 24, 21.5);
    expect(result.channelWidthPct).toBeCloseTo(20, 5);
    expect(result.actualUpsidePct).toBeCloseTo(11.627906976744185, 5);
    expect(result.channelWidthPct).not.toBeCloseTo(result.actualUpsidePct, 1);
  });

  it('computes upside from a proposed entry price distinct from the current price', () => {
    const result = computeUpside(20, 24, 21.5, 20.5);
    expect(result.upsideFromEntryPct).toBeCloseTo(((24 - 20.5) / 20.5) * 100, 5);
  });

  it('returns null upsideFromEntryPct when no entry price is given', () => {
    const result = computeUpside(20, 24, 21.5);
    expect(result.upsideFromEntryPct).toBeNull();
  });
});
