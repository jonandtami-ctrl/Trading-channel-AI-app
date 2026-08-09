import type { Pivot } from './types';

export type TrendDirection = 'strong_uptrend' | 'uptrend' | 'sideways' | 'downtrend' | 'strong_downtrend';

export interface TrendResult {
  direction: TrendDirection;
  label: string;
}

const LOOKBACK = 3; // how many recent swing highs/lows to compare

/**
 * Classifies the broader trend from the sequence of recent swing
 * highs/lows: higher highs + higher lows is an uptrend (strong once there
 * are enough consecutive confirmations); lower highs + lower lows is a
 * downtrend; anything mixed is sideways. Feeds the trade quality score and
 * the "descending channel, increased risk for longs" warning.
 */
export function classifyTrend(pivots: Pivot[]): TrendResult {
  const highs = pivots
    .filter((p) => p.type === 'high')
    .sort((a, b) => a.index - b.index)
    .slice(-LOOKBACK);
  const lows = pivots
    .filter((p) => p.type === 'low')
    .sort((a, b) => a.index - b.index)
    .slice(-LOOKBACK);

  if (highs.length < 2 || lows.length < 2) {
    return { direction: 'sideways', label: 'Sideways' };
  }

  const highPrices = highs.map((p) => p.price);
  const lowPrices = lows.map((p) => p.price);
  const strongEvidence = highs.length >= LOOKBACK && lows.length >= LOOKBACK;

  if (isRising(highPrices) && isRising(lowPrices)) {
    return strongEvidence ? { direction: 'strong_uptrend', label: 'Strong Uptrend' } : { direction: 'uptrend', label: 'Uptrend' };
  }
  if (isFalling(highPrices) && isFalling(lowPrices)) {
    return strongEvidence
      ? { direction: 'strong_downtrend', label: 'Strong Downtrend' }
      : { direction: 'downtrend', label: 'Downtrend' };
  }
  return { direction: 'sideways', label: 'Sideways' };
}

/** Whether a trend direction favors long (buy-side) trades. */
export function trendFavorsLong(direction: TrendDirection): boolean {
  return direction === 'uptrend' || direction === 'strong_uptrend';
}

/** 0-10 point contribution to the trade quality score. */
export function trendScore(direction: TrendDirection): number {
  switch (direction) {
    case 'strong_uptrend':
      return 10;
    case 'uptrend':
      return 7;
    case 'sideways':
      return 4;
    case 'downtrend':
      return 1;
    case 'strong_downtrend':
      return 0;
  }
}

function isRising(prices: number[]): boolean {
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] <= prices[i - 1]) return false;
  }
  return true;
}

function isFalling(prices: number[]): boolean {
  for (let i = 1; i < prices.length; i++) {
    if (prices[i] >= prices[i - 1]) return false;
  }
  return true;
}
