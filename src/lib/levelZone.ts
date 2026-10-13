import type { Level } from './types';

export interface LevelZone {
  /** Average touch price — same value as Level.price, exposed here for readability at call sites. */
  center: number;
  /** Lowest touch price — the zone's floor. */
  low: number;
  /** Highest touch price — the zone's ceiling. */
  high: number;
}

/**
 * A Level's `price` is already the average of its clustered touches (see
 * levels.ts), but several features need the zone's actual low/high band —
 * e.g. "Support Zone: $8.10-$8.40" — rather than a single number. Derived
 * on demand instead of widening the Level type everywhere, since most
 * existing callers only ever needed the center price.
 */
export function levelZone(level: Level): LevelZone {
  const prices = level.touches.map((t) => t.price);
  return {
    center: level.price,
    low: prices.length ? Math.min(...prices) : level.price,
    high: prices.length ? Math.max(...prices) : level.price,
  };
}
