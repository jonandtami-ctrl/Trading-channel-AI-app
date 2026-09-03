import type { Candle } from './types';

/**
 * Minimum average daily dollar volume for a symbol to be treated as
 * tradeable liquidity-wise — below this, spreads and slippage tend to make
 * a technically-clean setup impractical to actually fill. Exported so it's
 * a single, obvious place to tune rather than a magic number buried in a
 * filter (see bounceSetup.ts).
 */
export const MIN_LIQUIDITY_USD = 20_000_000;

const LOOKBACK = 20;

/**
 * Average of (close * volume) over the trailing window — a simple, standard
 * proxy for average daily dollar volume. Returns 0 when there's no volume
 * data (e.g. some demo/fallback paths), which reads as "not liquid" rather
 * than silently passing a symbol nobody can actually verify.
 */
export function averageDailyDollarVolume(candles: Candle[], lookback = LOOKBACK): number {
  const window = candles.slice(-lookback).filter((c) => c.volume != null);
  if (window.length === 0) return 0;
  const total = window.reduce((sum, c) => sum + c.close * (c.volume ?? 0), 0);
  return total / window.length;
}

/** True when a symbol's recent average daily dollar volume clears the liquidity floor. */
export function isLiquid(candles: Candle[], minUsd = MIN_LIQUIDITY_USD): boolean {
  return averageDailyDollarVolume(candles) >= minUsd;
}
