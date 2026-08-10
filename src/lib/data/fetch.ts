import type { Candle } from '../types';
import { findSymbol } from './symbols';
import { fetchBinanceCandles } from './binance';
import { fetchStockCandles } from './stocks';
import { generateDemoCandles } from './demo';

export interface CandleFetchResult {
  candles: Candle[];
  isLive: boolean;
}

// Always analyze a fixed, generous amount of history — 2 years of daily
// bars — no matter how much of it a chart is currently displaying.
// Channel/pivot detection needs real depth to find genuine touches; a
// fetch scoped down to "1 week" would almost never find anything.
// Timeframe selection is purely a chart display/zoom concern, handled by
// slicing this same data client-side (see symbol/[symbol].tsx).
const ANCHOR_DAYS = 730;
const ANCHOR_YAHOO_RANGE = '2y';

/** Fetches live data for a symbol, falling back to demo data on any failure — never throws. */
export async function fetchCandles(symbol: string): Promise<CandleFetchResult> {
  const info = findSymbol(symbol);

  try {
    if (info?.kind === 'crypto' && info.binancePair) {
      const candles = await fetchBinanceCandles(info.binancePair, Math.min(ANCHOR_DAYS, 1000));
      return { candles, isLive: true };
    }
    if (info?.kind === 'stock') {
      const candles = await fetchStockCandles(symbol, ANCHOR_YAHOO_RANGE);
      return { candles, isLive: true };
    }
  } catch {
    // fall through to demo data below
  }

  return { candles: generateDemoCandles(symbol, ANCHOR_DAYS), isLive: false };
}
