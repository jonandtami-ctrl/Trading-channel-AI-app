export interface PositionSizeResult {
  shares: number;
  dollarRisk: number;
  riskPerShare: number;
}

/**
 * Position size comes from how much you're willing to lose if the stop is
 * hit, not from the potential gain. dollarRisk = accountSize * riskPct;
 * shares = dollarRisk / riskPerShare, rounded down so the actual dollar
 * risk never exceeds the target.
 */
export function calculatePositionSize(
  accountSize: number,
  riskPct: number,
  entry: number,
  stop: number
): PositionSizeResult | null {
  const riskPerShare = entry - stop;
  if (!(accountSize > 0) || !(riskPct > 0) || !(riskPerShare > 0)) return null;

  const dollarRisk = accountSize * (riskPct / 100);
  const shares = Math.floor(dollarRisk / riskPerShare);
  return { shares, dollarRisk, riskPerShare };
}
