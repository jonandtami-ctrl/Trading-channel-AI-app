import type { Candle } from './types';

/**
 * Wilder's Average True Range — the standard measure of how much a symbol
 * genuinely moves candle-to-candle, used here to size how far below support
 * a "sweep" is allowed to go before it reads as a real breakdown instead of
 * a shakeout (see supportSweepReclaim.ts). Returns one value per candle;
 * the first `period - 1` entries are NaN (not enough history yet).
 */
export function calculateATR(candles: Candle[], period = 14): number[] {
  const atr = new Array<number>(candles.length).fill(NaN);
  if (candles.length === 0) return atr;

  const trueRanges: number[] = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prevClose = candles[i - 1].close;
    return Math.max(c.high - c.low, Math.abs(c.high - prevClose), Math.abs(c.low - prevClose));
  });

  if (candles.length < period) return atr;

  let seed = 0;
  for (let i = 0; i < period; i++) seed += trueRanges[i];
  atr[period - 1] = seed / period;

  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period;
  }

  return atr;
}
