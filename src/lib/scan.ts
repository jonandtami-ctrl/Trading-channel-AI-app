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

export type Signal = 'buy' | 'sell' | 'watch_support' | 'watch_resistance' | null;

/**
 * Turns a result's alerts into a single trade call: a confirmed breakout
 * or a bounce off support is a BUY; a confirmed breakdown or a bounce off
 * (rejection at) resistance is a SELL. Merely approaching a level isn't a
 * confirmed reversal yet, so it's a WATCH, not a firm call.
 */
export function getSignal(result: ScanResult): Signal {
  if (result.alerts.some((a) => a.type === 'breakout' || a.type === 'bounce_support')) return 'buy';
  if (result.alerts.some((a) => a.type === 'breakdown' || a.type === 'bounce_resistance')) return 'sell';
  if (result.alerts.some((a) => a.type === 'approaching_support')) return 'watch_support';
  if (result.alerts.some((a) => a.type === 'approaching_resistance')) return 'watch_resistance';
  return null;
}

/** Smallest current distance (as a fraction of price) from the last close to any alert's level. */
export function closestLevelDistance(result: ScanResult): number {
  const last = result.candles[result.candles.length - 1];
  if (!last || result.alerts.length === 0) return Infinity;
  return Math.min(...result.alerts.map((a) => Math.abs(last.close - a.levelPrice) / last.close));
}
