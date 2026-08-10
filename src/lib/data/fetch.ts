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

// For the "1D" chart view — daily bars are meaningless at 1-day resolution
// (literally one candle), so that view needs real intraday data instead of
// a slice of the same daily history everything else uses. 5 days of hourly
// bars is short enough to read as "today-ish" but long enough (~35-120
// candles depending on market) for channel detection to actually find a
// pivot, which needs at least 11 candles on either side of the lookback.
const INTRADAY_HOURLY_LIMIT = 120;

/** Fetches recent hourly candles for the 1D chart view — same fallback behavior as fetchCandles. */
export async function fetchIntradayCandles(symbol: string): Promise<CandleFetchResult> {
  const info = findSymbol(symbol);

  try {
    if (info?.kind === 'crypto' && info.binancePair) {
      const candles = await fetchBinanceCandles(info.binancePair, INTRADAY_HOURLY_LIMIT, '1h');
      return { candles, isLive: true };
    }
    if (info?.kind === 'stock') {
      const candles = await fetchStockCandles(symbol, '5d', '60m');
      return { candles, isLive: true };
    }
  } catch {
    // fall through to demo data below
  }

  return { candles: generateDemoCandles(symbol, INTRADAY_HOURLY_LIMIT), isLive: false };
}
