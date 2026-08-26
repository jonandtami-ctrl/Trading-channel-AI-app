import type { Candle, Channel } from './types';
import { calculateATR } from './atr';

/**
 * SUPPORT_SWEEP_RECLAIM — a distinct, deliberately stricter setup than the
 * plain "price touched support and closed a bit higher" bounce everywhere
 * else in this app. The whole point is to NOT buy the first touch: price
 * has to actually trade below the support zone (a real sweep, not a wick a
 * millimeter under the line), fail to keep falling, close back above
 * support (reclaim), and then get one more candle of follow-through before
 * this fires — an entry shortly *after* the reclaim is confirmed, not at
 * the moment it happens.
 */
export interface SweepReclaimSignal {
  /** Index into the candles array of the swing low that broke below support. */
  sweepIndex: number;
  sweepLow: number;
  /** How many ATRs below support the sweep low reached — the "how far below" check. */
  sweepDepthAtr: number;
  /** Index of the first candle to close back above support after the sweep. */
  reclaimIndex: number;
  /** Index of the bullish follow-through candle after the reclaim — this is what makes the setup "confirmed". */
  confirmationIndex: number;
  /** Fraction of the channel's total width still remaining between current price and resistance (0-1). */
  roomToResistanceFraction: number;
}

const ATR_PERIOD = 14;
// How far back from "now" a sweep is still eligible to be treated as
// current. Past this, the setup isn't "shortly after" anymore — it's old
// news and should just read as a normal active channel.
const SWEEP_LOOKBACK_CANDLES = 10;
// A sweep has to actually go meaningfully below support to count as one —
// otherwise this degenerates into the exact "touched support, call it a
// buy" behavior this setup exists to avoid. 0.15 ATR is a small but real
// undershoot, not noise.
const MIN_SWEEP_DEPTH_ATR = 0.15;
// Deeper than this and the move isn't a shakeout anymore — it's a real
// breakdown, and treating it as a buyable sweep would be exactly the
// "channel clearly invalidated" case the setup is supposed to exclude.
const MAX_SWEEP_DEPTH_ATR = 2.5;
// Once price dips below support, how many candles it's allowed to keep
// making lower lows before this stops counting as "sellers failing to
// continue" for that particular sweep attempt.
const MAX_CANDLES_TO_RECLAIM = 4;
// How many candles after the reclaim we'll wait for the bullish
// follow-through that actually confirms the setup.
const MAX_CANDLES_TO_CONFIRM = 4;
// The confirmation itself has to still be recent enough to act on —
// "shortly after," not "confirmed two weeks ago."
const CONFIRMATION_FRESHNESS_CANDLES = 2;
// There has to be real room left to the target, not a sweep-and-reclaim
// that's already most of the way back to resistance.
const MIN_ROOM_TO_RESISTANCE_FRACTION = 0.35;

/**
 * Looks for a completed sweep-below-support -> reclaim -> bullish
 * confirmation sequence that's still fresh as of the last candle. Returns
 * null if the channel isn't active, there isn't enough history, or no
 * qualifying sequence is found — this never fires on the first touch of
 * support and never fires the instant price dips below it.
 */
export function detectSupportSweepReclaim(candles: Candle[], channel: Channel): SweepReclaimSignal | null {
  if (channel.status !== 'active') return null;

  const support = channel.support.price;
  const resistance = channel.resistance.price;
  const channelWidth = resistance - support;
  if (channelWidth <= 0) return null;

  const lastIndex = candles.length - 1;
  const minCandles = ATR_PERIOD + SWEEP_LOOKBACK_CANDLES + MAX_CANDLES_TO_RECLAIM + MAX_CANDLES_TO_CONFIRM;
  if (lastIndex < minCandles) return null;

  const atr = calculateATR(candles, ATR_PERIOD);
  const searchFrom = Math.max(ATR_PERIOD, lastIndex - SWEEP_LOOKBACK_CANDLES);
  const searchTo = lastIndex - 1; // a sweep needs at least a reclaim candle after it

  // Walk backward from "now" so the most recent qualifying sweep wins —
  // if price swept, wobbled, swept again lower, then finally reclaimed,
  // it's the last (deepest/most recent) attempt that's actually relevant.
  for (let sweepIndex = searchTo; sweepIndex >= searchFrom; sweepIndex--) {
    const sweepCandle = candles[sweepIndex];
    // The ATR from the candle *before* the sweep — normal volatility going
    // into the move — not the value at the sweep candle itself, which
    // would already be inflated by that same abnormal candle's own range
    // and understate how unusual the move actually was.
    const atrAtSweep = atr[sweepIndex - 1];
    if (!atrAtSweep || sweepCandle.low >= support) continue;

    const sweepDepthAtr = (support - sweepCandle.low) / atrAtSweep;
    if (sweepDepthAtr < MIN_SWEEP_DEPTH_ATR || sweepDepthAtr > MAX_SWEEP_DEPTH_ATR) continue;

    const reclaimIndex = findReclaim(candles, sweepIndex, support, sweepCandle.low, atrAtSweep);
    if (reclaimIndex == null) continue;

    const confirmationIndex = findConfirmation(candles, reclaimIndex);
    if (confirmationIndex == null) continue;
    if (lastIndex - confirmationIndex > CONFIRMATION_FRESHNESS_CANDLES) continue;

    const currentPrice = candles[lastIndex].close;
    const roomToResistanceFraction = (resistance - currentPrice) / channelWidth;
    if (roomToResistanceFraction < MIN_ROOM_TO_RESISTANCE_FRACTION) continue;

    return {
      sweepIndex,
      sweepLow: sweepCandle.low,
      sweepDepthAtr,
      reclaimIndex,
      confirmationIndex,
      roomToResistanceFraction,
    };
  }

  return null;
}

/**
 * First candle at/after the sweep that closes back above support — but
 * only if sellers didn't keep pushing to a materially lower low first
 * ("sellers fail to continue pushing price lower"). A small buffer (10% of
 * that ATR) allows ordinary noise without letting a genuine second leg
 * down count as a reclaim of the first attempt.
 */
function findReclaim(candles: Candle[], sweepIndex: number, support: number, sweepLow: number, atrAtSweep: number): number | null {
  const limit = Math.min(sweepIndex + MAX_CANDLES_TO_RECLAIM, candles.length - 1);
  for (let i = sweepIndex; i <= limit; i++) {
    if (i > sweepIndex && candles[i].low < sweepLow - atrAtSweep * 0.1) return null;
    if (candles[i].close > support) return i;
  }
  return null;
}

/** A later candle that both closes higher than the reclaim candle and is itself bullish — the follow-through that separates this from a one-bar fakeout. */
function findConfirmation(candles: Candle[], reclaimIndex: number): number | null {
  const reclaimClose = candles[reclaimIndex].close;
  const limit = Math.min(reclaimIndex + MAX_CANDLES_TO_CONFIRM, candles.length - 1);
  for (let i = reclaimIndex + 1; i <= limit; i++) {
    const c = candles[i];
    if (c.close > reclaimClose && c.close > c.open) return i;
  }
  return null;
}
