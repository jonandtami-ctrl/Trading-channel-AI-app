export interface PositionSizeResult {
  shares: number;
  dollarRisk: number;
  riskPerShare: number;
}

/**
 * Position size comes from how much you're willing to lose if the stop is
 * hit, not from the potential gain. Shares = budget (accountSize * riskPct)
 * divided by riskPerShare, rounded down — and since rounding down a share
 * count almost never uses the full budget exactly, `dollarRisk` is
 * recomputed from the actual (floored) share count, not the raw budget, so
 * it always reflects what you're really risking at that size.
 */
export function calculatePositionSize(
  accountSize: number,
  riskPct: number,
  entry: number,
  stop: number
): PositionSizeResult | null {
  const riskPerShare = entry - stop;
  if (!(accountSize > 0) || !(riskPct > 0) || !(riskPerShare > 0)) return null;

  const budget = accountSize * (riskPct / 100);
  const shares = Math.floor(budget / riskPerShare);
  if (shares <= 0) return null;

  return { shares, dollarRisk: shares * riskPerShare, riskPerShare };
}
