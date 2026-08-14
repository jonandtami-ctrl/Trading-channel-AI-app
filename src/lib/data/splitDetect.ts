import type { Candle } from '../types';

// A day-to-day close ratio outside this band isn't real single-day price
// action for anything in this app's universe (even a 3x leveraged ETF) —
// it's the signature of a stock/reverse split that Yahoo's raw "close"
// series didn't retroactively adjust for. Leveraged and inverse ETFs do
// these routinely to keep a decaying share price off the floor.
const SPLIT_JUMP_RATIO_HIGH = 2.5;
const SPLIT_JUMP_RATIO_LOW = 0.4;

// A genuine split is a permanent regime change, so it's still there on the
// next trading day too. A single bad tick from the feed (a bad print, a
// stale/partial "today" bar, a proxy hiccup) looks identical to a split by
// ratio alone but is, by definition, unconfirmed — nothing has happened
// *after* it yet to show the new level actually held. Trusting an
// unconfirmed jump is what turned one bad data point into "drop 2 years of
// real history and report this single number as the current price."
const SPLIT_CONFIRM_CANDLES = 2;
const SPLIT_CONFIRM_TOLERANCE = 0.3; // stays within +/-30% of the jump candle to count as "held"

/**
 * Finds the most recent split-sized jump between consecutive closes,
 * confirms the new price level actually holds for the next couple of
 * candles (not just a one-candle blip), and drops everything before it. A
 * raw, unadjusted split leaves the history internally inconsistent — the
 * same "channel" would straddle two completely different price scales —
 * so the pre-split side has to go rather than get analyzed alongside the
 * current, correct price regime.
 */
export function trimAtSplitDiscontinuity(candles: Candle[]): Candle[] {
  for (let i = candles.length - 1; i > 0; i--) {
    const ratio = candles[i].close / candles[i - 1].close;
    if (ratio > SPLIT_JUMP_RATIO_HIGH || ratio < SPLIT_JUMP_RATIO_LOW) {
      if (!newLevelHolds(candles, i)) continue;
      return candles.slice(i);
    }
  }
  return candles;
}

function newLevelHolds(candles: Candle[], jumpIndex: number): boolean {
  const window = candles.slice(jumpIndex, jumpIndex + SPLIT_CONFIRM_CANDLES);
  if (window.length < SPLIT_CONFIRM_CANDLES) return false;
  const anchor = candles[jumpIndex].close;
  return window.every((c) => {
    const r = c.close / anchor;
    return r > 1 - SPLIT_CONFIRM_TOLERANCE && r < 1 + SPLIT_CONFIRM_TOLERANCE;
  });
}
