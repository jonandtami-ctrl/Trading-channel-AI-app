import { describe, expect, it } from 'vitest';
import { computeOverallScore, BASE_OVERALL_WEIGHTS } from '../overallScore';

describe('computeOverallScore', () => {
  it('forces a broken range to 0 and ineligible regardless of other inputs', () => {
    const result = computeOverallScore({
      channelQualityScore: 95,
      businessQualityScore: 95,
      entryOpportunityScore: 95,
      breakdownRiskScore: 0,
      rewardRiskRatio: 10,
      isBroken: true,
    });
    expect(result.score).toBe(0);
    expect(result.eligibleForRanking).toBe(false);
  });

  it('renormalizes weights to sum to 100 when business quality is unavailable', () => {
    const result = computeOverallScore({
      channelQualityScore: 80,
      businessQualityScore: null,
      entryOpportunityScore: 80,
      breakdownRiskScore: 10,
      rewardRiskRatio: 3,
      isBroken: false,
    });
    const total = Object.values(result.weightsUsed).reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(100, 5);
    expect(result.weightsUsed.business).toBe(0);
    expect(result.businessQualityAvailable).toBe(false);
  });

  it('keeps the original weights when business quality is available', () => {
    const result = computeOverallScore({
      channelQualityScore: 80,
      businessQualityScore: 70,
      entryOpportunityScore: 80,
      breakdownRiskScore: 10,
      rewardRiskRatio: 3,
      isBroken: false,
    });
    expect(result.weightsUsed).toEqual(BASE_OVERALL_WEIGHTS);
    expect(result.businessQualityAvailable).toBe(true);
  });

  it('a higher breakdown risk always produces a lower or equal overall score, all else equal', () => {
    const base = { channelQualityScore: 80, businessQualityScore: null, entryOpportunityScore: 80, rewardRiskRatio: 3, isBroken: false };
    const lowRisk = computeOverallScore({ ...base, breakdownRiskScore: 10 });
    const highRisk = computeOverallScore({ ...base, breakdownRiskScore: 70 });
    expect(highRisk.score).toBeLessThan(lowRisk.score);
  });

  it('never exceeds 100 or drops below 0 for extreme inputs', () => {
    const extreme = computeOverallScore({
      channelQualityScore: 1000,
      businessQualityScore: 1000,
      entryOpportunityScore: 1000,
      breakdownRiskScore: -50,
      rewardRiskRatio: 50,
      isBroken: false,
    });
    expect(extreme.score).toBeLessThanOrEqual(100);
    expect(extreme.score).toBeGreaterThanOrEqual(0);
  });
});
