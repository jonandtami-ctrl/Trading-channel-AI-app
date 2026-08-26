import type { Candle, Channel } from './types';

export interface ChannelCycles {
  /** Times price bounced off support and reached resistance within the window — the actionable "buy support, sell resistance" round trip this app's strategies trade. */
  supportToResistanceCycles: number;
  /** The mirror image — bounced off resistance down to support — kept for completeness even though the app's setups don't currently trade this direction. */
  resistanceToSupportCycles: number;
  windowDays: number;
}

const DEFAULT_WINDOW_DAYS = 60;

/**
 * Counts genuine round trips, not just raw touches — a channel touched 5
 * times on the same side without ever crossing to the other one is two
 * lines that happen to fit the chart, not a proven channel. Each time the
 * touch history alternates from a support touch to a (later) resistance
 * touch counts as one completed support -> resistance cycle, and vice
 * versa for the mirror count.
 */
export function countChannelCycles(channel: Channel, candles: Candle[], windowDays = DEFAULT_WINDOW_DAYS): ChannelCycles {
  if (candles.length === 0) return { supportToResistanceCycles: 0, resistanceToSupportCycles: 0, windowDays };

  const cutoff = candles[candles.length - 1].time - windowDays * 86400;
  const touches = [
    ...channel.support.touches.map((t) => ({ time: t.time, side: 'support' as const })),
    ...channel.resistance.touches.map((t) => ({ time: t.time, side: 'resistance' as const })),
  ]
    .filter((t) => t.time >= cutoff)
    .sort((a, b) => a.time - b.time);

  let supportToResistanceCycles = 0;
  let resistanceToSupportCycles = 0;
  for (let i = 1; i < touches.length; i++) {
    if (touches[i - 1].side === touches[i].side) continue;
    if (touches[i - 1].side === 'support') supportToResistanceCycles++;
    else resistanceToSupportCycles++;
  }

  return { supportToResistanceCycles, resistanceToSupportCycles, windowDays };
}
