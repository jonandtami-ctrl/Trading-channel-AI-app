import type { Candle } from './types';

/**
 * Wilder's Relative Strength Index — the standard 0-100 momentum
 * oscillator, used here to judge whether a stock sitting near support is
 * still falling or already flattening/turning (see bounceSetup.ts).
 * Returns one value per candle; the first `period` entries are NaN (not
 * enough history yet to seed the average).
 */
export function calculateRSI(candles: Candle[], period = 14): number[] {
  const rsi = new Array<number>(candles.length).fill(NaN);
  if (candles.length <= period) return rsi;

  const gains: number[] = new Array(candles.length).fill(0);
  const losses: number[] = new Array(candles.length).fill(0);
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    gains[i] = Math.max(0, change);
    losses[i] = Math.max(0, -change);
  }

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  rsi[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsi[i] = rsiFromAverages(avgGain, avgLoss);
  }

  return rsi;
}

function rsiFromAverages(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}
