import type { Candle } from '../types';

// A day-to-day close ratio outside this band isn't real single-day price
// action for anything in this app's universe (even a 3x leveraged ETF) —
// it's the signature of a stock/reverse split that Yahoo's raw "close"
// series didn't retroactively adjust for. Leveraged and inverse ETFs do
// these routinely to keep a decaying share price off the floor.
const SPLIT_JUMP_RATIO_HIGH = 2.5;
const SPLIT_JUMP_RATIO_LOW = 0.4;

/**
 * Finds the most recent split-sized jump between consecutive closes and
 * drops everything before it. A raw, unadjusted split leaves the history
 * internally inconsistent — the same "channel" would straddle two
 * completely different price scales — so the pre-split side has to go
 * rather than get analyzed alongside the current, correct price regime.
 */
export function trimAtSplitDiscontinuity(candles: Candle[]): Candle[] {
  for (let i = candles.length - 1; i > 0; i--) {
    const ratio = candles[i].close / candles[i - 1].close;
    if (ratio > SPLIT_JUMP_RATIO_HIGH || ratio < SPLIT_JUMP_RATIO_LOW) {
      return candles.slice(i);
    }
  }
  return candles;
}
