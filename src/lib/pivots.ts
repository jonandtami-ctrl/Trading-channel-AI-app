import type { Candle, Pivot } from './types';

/**
 * Finds swing highs/lows: a candle whose high (or low) is the most extreme
 * within a symmetric window of neighboring candles on both sides.
 */
export function findPivots(candles: Candle[], window = 5): Pivot[] {
  const pivots: Pivot[] = [];

  for (let i = window; i < candles.length - window; i++) {
    const start = i - window;
    const end = i + window + 1;
    let isHigh = true;
    let isLow = true;

    for (let j = start; j < end; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }

    if (isHigh) {
      pivots.push({ index: i, time: candles[i].time, price: candles[i].high, type: 'high' });
    }
    if (isLow) {
      pivots.push({ index: i, time: candles[i].time, price: candles[i].low, type: 'low' });
    }
  }

  return pivots;
}
