import type { Channel } from './types';

export type ChannelDirection = 'horizontal' | 'ascending' | 'descending';

const SLOPE_THRESHOLD_PCT = 1.5; // touch prices must move at least this much end-to-end to count as sloped

/**
 * Classifies a channel's slope by comparing each side's earliest touch to
 * its most recent one. Both support and resistance have to agree on
 * direction to call it ascending/descending; anything else (including one
 * side sloping while the other doesn't) is horizontal.
 */
export function classifyChannelDirection(channel: Channel): ChannelDirection {
  const supportSlope = touchSlopePct(channel.support.touches.map((t) => t.price));
  const resistanceSlope = touchSlopePct(channel.resistance.touches.map((t) => t.price));

  if (supportSlope > SLOPE_THRESHOLD_PCT && resistanceSlope > SLOPE_THRESHOLD_PCT) return 'ascending';
  if (supportSlope < -SLOPE_THRESHOLD_PCT && resistanceSlope < -SLOPE_THRESHOLD_PCT) return 'descending';
  return 'horizontal';
}

/** Descending channels deserve an explicit caution for long trades. */
export function channelDirectionWarning(direction: ChannelDirection): string | null {
  return direction === 'descending' ? 'Descending channel — increased risk for long trades.' : null;
}

function touchSlopePct(prices: number[]): number {
  if (prices.length < 2) return 0;
  const first = prices[0];
  const last = prices[prices.length - 1];
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}
