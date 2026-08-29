import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ScanResult } from './types';

const KEY_PREFIX = 'channel-scanner-scan-cache:';

// Caching every scanned symbol's full candle history would run ~19MB of
// JSON (500 daily candles x ~380 symbols) — comfortably past a web
// browser's localStorage quota (typically 5-10MB), so a raw cache write
// would just silently fail every time and never actually help. Two cuts
// keep it well under quota: only symbols with something actually worth
// showing get cached at all (a boring "no channel found" majority isn't
// what a same-day reopen needs to recover — a real buy/watch candidate
// is), and candle history is trimmed to just enough for a card's mini
// chart, since detail pages fetch their own full history independently on
// demand and never read from this cache.
const CACHE_CANDLE_TAIL = 60;

interface CacheEntry {
  fetchedAt: number;
  /** The scanned symbol list's key at write time — lets a stale cache from before a symbol-list change (e.g. a new deploy) get ignored instead of silently missing/keeping the wrong symbols. */
  symbolKey: string;
  results: Record<string, ScanResult>;
}

function isCacheWorthy(r: ScanResult): boolean {
  return r.channels.length > 0 || !!r.tradePlan || !!r.stability || r.alerts.length > 0 || !!r.valueChannels?.length;
}

function trimForCache(results: Record<string, ScanResult>): Record<string, ScanResult> {
  const trimmed: Record<string, ScanResult> = {};
  for (const [symbol, r] of Object.entries(results)) {
    if (!isCacheWorthy(r)) continue;
    trimmed[symbol] = { ...r, levels: [], candles: r.candles.slice(-CACHE_CANDLE_TAIL) };
  }
  return trimmed;
}

/** Returns null on any failure (nothing cached yet, corrupt data, storage unavailable) — callers should just fall back to a real scan. */
export async function loadScanCache(key: string): Promise<CacheEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

/** Never throws — a quota-exceeded or unavailable-storage failure just means this reopen doesn't get a cached head start, not a crash. */
export async function saveScanCache(
  key: string,
  results: Record<string, ScanResult>,
  fetchedAt: number,
  symbolKey: string
): Promise<void> {
  try {
    const entry: CacheEntry = { fetchedAt, symbolKey, results: trimForCache(results) };
    await AsyncStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded or unavailable — caching is a nice-to-have, not required for correctness.
  }
}
