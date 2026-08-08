import type { Candle } from '../types';
import { findSymbol } from './symbols';
import { fetchBinanceCandles } from './binance';
import { fetchStockCandles } from './stocks';
import { generateDemoCandles } from './demo';
import { DEFAULT_TIMEFRAME, type Timeframe } from '../timeframes';

export interface CandleFetchResult {
  candles: Candle[];
  isLive: boolean;
}

/** Fetches live data for a symbol, falling back to demo data on any failure — never throws. */
export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe = DEFAULT_TIMEFRAME
): Promise<CandleFetchResult> {
  const info = findSymbol(symbol);

  try {
    if (info?.kind === 'crypto' && info.binancePair) {
      const candles = await fetchBinanceCandles(info.binancePair, Math.min(timeframe.days, 1000));
      return { candles, isLive: true };
    }
    if (info?.kind === 'stock') {
      const candles = await fetchStockCandles(symbol, timeframe.yahooRange);
      return { candles, isLive: true };
    }
  } catch {
    // fall through to demo data below
  }

  return { candles: generateDemoCandles(symbol, timeframe.days), isLive: false };
}
