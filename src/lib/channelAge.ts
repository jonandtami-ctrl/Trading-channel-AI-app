import type { Candle, Channel } from './types';

/**
 * How long a channel has actually persisted, in days — from its very
 * first touch (support or resistance, whichever came first) through the
 * most recent candle, not just the span between the first and last touch.
 * That distinction matters: a channel's last bounce can be weeks old while
 * the range is still holding today, and "time it's been there" should
 * reflect that it's still standing now, not just when it was last tested.
 */
export function channelAgeDays(channel: Channel, candles: Candle[]): number {
  const firstTouchTime = Math.min(channel.support.touches[0].time, channel.resistance.touches[0].time);
  const lastCandleTime = candles[candles.length - 1]?.time ?? firstTouchTime;
  return Math.max(0, Math.round((lastCandleTime - firstTouchTime) / 86400));
}

/** Formats a day count into a short, human label — days under a month, months under a year, years beyond that. */
export function formatChannelAge(days: number): string {
  if (days < 30) return days === 1 ? '1 day' : `${days} days`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30.44));
    return months === 1 ? '1 month' : `${months} months`;
  }
  const years = days / 365.25;
  return `${years.toFixed(1)} years`;
}
