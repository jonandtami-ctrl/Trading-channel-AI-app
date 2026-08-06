import type { Candle } from '../types';
import { findSymbol } from './symbols';
import { fetchBinanceCandles } from './binance';
import { fetchStockCandles } from './stocks';
import { generateDemoCandles } from './demo';

export interface CandleFetchResult {
  candles: Candle[];
  isLive: boolean;
}

/** Fetches live data for a symbol, falling back to demo data on any failure — never throws. */
export async function fetchCandles(symbol: string): Promise<CandleFetchResult> {
  const info = findSymbol(symbol);

  try {
    if (info?.kind === 'crypto' && info.binancePair) {
      const candles = await fetchBinanceCandles(info.binancePair);
      return { candles, isLive: true };
    }
    if (info?.kind === 'stock') {
      const candles = await fetchStockCandles(symbol);
      return { candles, isLive: true };
    }
  } catch {
    // fall through to demo data below
  }

  return { candles: generateDemoCandles(symbol), isLive: false };
}
