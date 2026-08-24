import type { Candle } from '../types';
import { findSymbol, type SymbolInfo } from './symbols';
import { fetchBinanceCandles } from './binance';
import { fetchStockCandles } from './stocks';
import { fetchTwelveDataDaily, fetchTwelveDataDailyBatch, fetchTwelveDataIntraday } from './twelvedata';
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

/**
 * Fetches live data for a symbol, falling back to demo data on any failure
 * — never throws. Stocks/ETFs try Twelve Data first (the accurate,
 * purpose-built source) and only fall back to the Yahoo-proxy chain if it's
 * unconfigured, rate-limited, or errors out.
 */
export async function fetchCandles(symbol: string): Promise<CandleFetchResult> {
  const info = findSymbol(symbol);

  if (info?.kind === 'crypto' && info.binancePair) {
    try {
      const candles = await fetchBinanceCandles(info.binancePair, Math.min(ANCHOR_DAYS, 1000));
      return { candles, isLive: true };
    } catch {
      return { candles: generateDemoCandles(symbol, ANCHOR_DAYS), isLive: false };
    }
  }

  if (info?.kind === 'stock') {
    try {
      const candles = await fetchTwelveDataDaily(info);
      return { candles, isLive: true };
    } catch {
      // Twelve Data unavailable/unconfigured/budget exhausted — fall back to the Yahoo-proxy chain.
    }
    return fetchStockViaYahooOrDemo(symbol);
  }

  return { candles: generateDemoCandles(symbol, ANCHOR_DAYS), isLive: false };
}

async function fetchStockViaYahooOrDemo(symbol: string): Promise<CandleFetchResult> {
  try {
    const candles = await fetchStockCandles(symbol, ANCHOR_YAHOO_RANGE);
    return { candles, isLive: true };
  } catch {
    return { candles: generateDemoCandles(symbol, ANCHOR_DAYS), isLive: false };
  }
}

// If the primary batch call fails outright (network blip, budget
// exhausted, worker cold start — anything), every symbol in the universe
// falls through to this per-symbol fallback at once. Firing all ~380 of
// those concurrently would blow straight through Twelve Data's
// 8-requests/minute limit — the exact thing this whole batched function
// exists to avoid in the first place — so only the first handful would
// ever get a real Twelve Data retry; the rest would instantly rate-limit
// and cascade to Yahoo (or demo, if that's struggling under the same
// burst too), making the whole dashboard look wrong at once even though
// each symbol individually still has a working fallback chain. Chunking
// this fallback the same way the crypto scanner already does keeps each
// wave small enough to actually succeed.
const FALLBACK_CHUNK_SIZE = 25;
const FALLBACK_CHUNK_DELAY_MS = 150;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Batch-fetches daily candles for many stock symbols in as few Twelve Data
 * calls as possible, then fills in any symbol Twelve Data didn't return —
 * whether the whole call failed or just that one symbol did — with the
 * same per-symbol fallback chain fetchCandles uses. The scanner uses this
 * instead of calling fetchCandles once per symbol, since 100+ sequential
 * Twelve Data requests would blow through its 8-requests/minute free-tier
 * limit almost instantly.
 */
export async function fetchStockBatch(infos: SymbolInfo[]): Promise<Record<string, CandleFetchResult>> {
  const result: Record<string, CandleFetchResult> = {};

  let batch: Record<string, Candle[]> = {};
  let wholeBatchFailed = false;
  try {
    batch = await fetchTwelveDataDailyBatch(infos);
  } catch {
    // whole batch failed (unconfigured, network, budget exhausted) — every symbol falls through below
    wholeBatchFailed = true;
  }

  const missing = infos.filter((info) => {
    const candles = batch[info.symbol];
    if (candles?.length) {
      result[info.symbol] = { candles, isLive: true };
      return false;
    }
    return true;
  });

  // A handful of symbols missing from an otherwise-successful batch is
  // cheap to retry individually against Twelve Data first (fetchCandles) —
  // that's not enough concurrent requests to hit the rate limit. But if
  // the whole batch call failed, `missing` is the entire universe, and
  // retrying Twelve Data individually for all of them is both pointless
  // (the 8/minute limiter will reject nearly all of them anyway) and
  // harmful (see note above) — go straight to Yahoo instead.
  const fetchMissing = wholeBatchFailed ? fetchStockViaYahooOrDemo : fetchCandles;

  for (let i = 0; i < missing.length; i += FALLBACK_CHUNK_SIZE) {
    const chunk = missing.slice(i, i + FALLBACK_CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (info) => {
        result[info.symbol] = await fetchMissing(info.symbol);
      })
    );
    if (i + FALLBACK_CHUNK_SIZE < missing.length) await sleep(FALLBACK_CHUNK_DELAY_MS);
  }

  return result;
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

  if (info?.kind === 'crypto' && info.binancePair) {
    try {
      const candles = await fetchBinanceCandles(info.binancePair, INTRADAY_HOURLY_LIMIT, '1h');
      return { candles, isLive: true };
    } catch {
      return { candles: generateDemoCandles(symbol, INTRADAY_HOURLY_LIMIT), isLive: false };
    }
  }

  if (info?.kind === 'stock') {
    try {
      const candles = await fetchTwelveDataIntraday(info, INTRADAY_HOURLY_LIMIT);
      return { candles, isLive: true };
    } catch {
      // fall through to Yahoo
    }
    try {
      const candles = await fetchStockCandles(symbol, '5d', '60m');
      return { candles, isLive: true };
    } catch {
      // fall through to demo data below
    }
  }

  return { candles: generateDemoCandles(symbol, INTRADAY_HOURLY_LIMIT), isLive: false };
}
