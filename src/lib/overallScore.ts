/**
 * Overall Setup Score (item 12) — combines channel quality, business
 * quality (currently always unavailable — see the audit notes), entry
 * opportunity, breakdown safety (the inverse of breakdown risk), and
 * reward:risk quality. Weights are explicitly starting assumptions, not
 * empirically validated — see weightsUsed on the result for exactly what
 * was applied to a given score, and businessQualityAvailable for whether
 * the business-quality slice was real or renormalized away.
 *
 * Eligibility gate: a confirmed-broken range is forced to 0 and marked
 * ineligible for ranking, full stop — no combination of the other factors
 * can rank a broken setup highly.
 */

export interface OverallScoreWeights {
  channel: number;
  business: number;
  entry: number;
  breakdownSafety: number;
  rewardRisk: number;
}

export const BASE_OVERALL_WEIGHTS: OverallScoreWeights = {
  channel: 30,
  business: 25,
  entry: 20,
  breakdownSafety: 15,
  rewardRisk: 10,
};

export interface OverallScoreInputs {
  channelQualityScore: number;
  /** Null when fundamentals data isn't available — see audit notes; never fabricated. */
  businessQualityScore: number | null;
  entryOpportunityScore: number;
  /** 0-100, higher = more risk — the output of breakdownRisk.ts. */
  breakdownRiskScore: number;
  rewardRiskRatio: number | null;
  isBroken: boolean;
}

export interface OverallScoreResult {
  score: number;
  breakdownSafetyScore: number;
  rewardRiskScore: number;
  businessQualityAvailable: boolean;
  weightsUsed: OverallScoreWeights;
  eligibleForRanking: boolean;
}

function rewardRiskToScore(rr: number | null): number {
  if (rr == null) return 0;
  if (rr >= 5) return 100;
  if (rr >= 3) return 80;
  if (rr >= 2) return 55;
  if (rr >= 1) return 25;
  return 0;
}

/** Scales the non-business weights up so they still sum to 100 when business quality is unavailable, rather than silently scoring out of 75. */
function renormalizeWithoutBusiness(weights: OverallScoreWeights): OverallScoreWeights {
  const remaining = 100 - weights.business;
  const scale = remaining > 0 ? 100 / remaining : 1;
  return {
    channel: weights.channel * scale,
    business: 0,
    entry: weights.entry * scale,
    breakdownSafety: weights.breakdownSafety * scale,
    rewardRisk: weights.rewardRisk * scale,
  };
}

export function computeOverallScore(inputs: OverallScoreInputs, baseWeights: OverallScoreWeights = BASE_OVERALL_WEIGHTS): OverallScoreResult {
  if (inputs.isBroken) {
    return {
      score: 0,
      breakdownSafetyScore: 0,
      rewardRiskScore: 0,
      businessQualityAvailable: inputs.businessQualityScore != null,
      weightsUsed: { channel: 0, business: 0, entry: 0, breakdownSafety: 0, rewardRisk: 0 },
      eligibleForRanking: false,
    };
  }

  const breakdownSafetyScore = 100 - inputs.breakdownRiskScore;
  const rewardRiskScore = rewardRiskToScore(inputs.rewardRiskRatio);
  const hasBusiness = inputs.businessQualityScore != null;
  const weights = hasBusiness ? baseWeights : renormalizeWithoutBusiness(baseWeights);

  const score =
    (inputs.channelQualityScore * weights.channel +
      (inputs.businessQualityScore ?? 0) * weights.business +
      inputs.entryOpportunityScore * weights.entry +
      breakdownSafetyScore * weights.breakdownSafety +
      rewardRiskScore * weights.rewardRisk) /
    100;

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    breakdownSafetyScore,
    rewardRiskScore,
    businessQualityAvailable: hasBusiness,
    weightsUsed: weights,
    eligibleForRanking: true,
  };
}
