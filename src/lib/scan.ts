import { findPivots } from './pivots';
import { clusterLevels } from './levels';
import { detectChannels } from './channels';
import { generateAlerts } from './alerts';
import type { Candle, ScanResult } from './types';

export function scanSymbol(symbol: string, candles: Candle[], isLive: boolean): ScanResult {
  const pivots = findPivots(candles, 5);
  const levels = clusterLevels(pivots);
  const channels = detectChannels(candles, levels);
  const alerts = generateAlerts(symbol, candles, channels);
  return { symbol, candles, channels, alerts, isLive };
}

/** Urgency ranking used to sort the watchlist: breakouts first, then near a level, calm last. */
export function urgencyScore(result: ScanResult): number {
  const hasBreakout = result.alerts.some((a) => a.type === 'breakout' || a.type === 'breakdown');
  if (hasBreakout) return 0;

  const hasApproach = result.alerts.some(
    (a) => a.type === 'approaching_resistance' || a.type === 'approaching_support'
  );
  if (hasApproach) return 1;

  const hasBounce = result.alerts.some((a) => a.type === 'bounce_support' || a.type === 'bounce_resistance');
  if (hasBounce) return 2;

  const hasActiveChannel = result.channels.some((c) => c.status === 'active');
  if (hasActiveChannel) return 3;

  return 4;
}
