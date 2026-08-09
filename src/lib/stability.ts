import type { Candle, Channel } from './types';
import { findPivots } from './pivots';
import { classifyTrend } from './trend';
import { classifyChannelDirection } from './channelDirection';

export interface StabilityInfo {
  support: number;
  resistance: number;
  widthPct: number;
  touchCount: number;
  candleCount: number;
}

const MAX_WIDTH_PCT = 9; // channel must stay tight, not just "active"
const MIN_TOUCHES_PER_SIDE = 2;
const MIN_TOTAL_TOUCHES = 5;
const MIN_HISTORY_CANDLES = 90; // enough history to call it "long term", not a lucky recent squeeze

/**
 * Picks out symbols that are genuinely range-bound over a long history —
 * tight, well-touched, sideways, horizontal channel — rather than the
 * confirmation/momentum read tradePlan.ts looks for. This is deliberately
 * not a trade call: "going nowhere" is the point, a candidate for a quiet,
 * low-drama range rather than an active buy/sell setup.
 */
export function findStableChannel(candles: Candle[], channels: Channel[]): StabilityInfo | null {
  if (candles.length < MIN_HISTORY_CANDLES) return null;

  const trend = classifyTrend(findPivots(candles, 5));
  if (trend.direction !== 'sideways') return null;

  let best: Channel | null = null;
  for (const channel of channels) {
    if (channel.status !== 'active') continue;
    if (classifyChannelDirection(channel) !== 'horizontal') continue;
    if (channel.widthPct > MAX_WIDTH_PCT) continue;
    if (channel.support.touches.length < MIN_TOUCHES_PER_SIDE) continue;
    if (channel.resistance.touches.length < MIN_TOUCHES_PER_SIDE) continue;
    const touchCount = channel.support.touches.length + channel.resistance.touches.length;
    if (touchCount < MIN_TOTAL_TOUCHES) continue;
    if (!best || channel.containmentPct > best.containmentPct) best = channel;
  }

  if (!best) return null;
  return {
    support: best.support.price,
    resistance: best.resistance.price,
    widthPct: best.widthPct,
    touchCount: best.support.touches.length + best.resistance.touches.length,
    candleCount: candles.length,
  };
}
