import { useEffect, useRef, useState } from 'react';
import { fetchCandles, fetchStockBatch } from '../lib/data/fetch';
import { scanSymbol } from '../lib/scan';
import { loadScanCache, saveScanCache } from '../lib/scanCache';
import type { ScanResult } from '../lib/types';
import type { SymbolInfo } from '../lib/data/symbols';

export interface ScannerState {
  results: Record<string, ScanResult>;
  loading: boolean;
  scanned: number;
  total: number;
}

const DEFAULT_REFRESH_MS = 20 * 60 * 1000;
const BATCH_SIZE = 30;
const BATCH_DELAY_MS = 100;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Stocks/ETFs are fetched in one Twelve Data batch call (see
 * fetchStockBatch) instead of per-symbol, since Twelve Data's free tier
 * only allows 8 requests/minute — a couple hundred sequential requests
 * would get mostly rate-limited. Crypto still fetches in small
 * concurrency-limited batches directly against Binance, which has no such
 * limit and lets the UI fill in results as they arrive.
 *
 * refreshMs lets callers pick their own cadence — crypto (cheap to refetch)
 * can refresh far more often than a full stock/ETF scan without hammering
 * anything. fetchCandles/fetchStockBatch always analyze a fixed, generous
 * history regardless of what a chart happens to be displaying.
 *
 * cacheKey, when given, persists results to a durable cache after each
 * successful run and reuses them on mount if they're still within
 * refreshMs — without this, every fresh app open/reload starts a brand new
 * scan regardless of how recently one already ran, which for the stock
 * universe (its own daily Twelve Data credit budget, see twelvedata.ts)
 * means a couple of same-day reopens can exhaust the whole day's real-data
 * budget, silently collapsing most stocks to demo fallback for the rest of
 * the day. Omit it for cheap-to-refetch scans (crypto, single-symbol detail)
 * where this isn't a real concern.
 */
export function useScanner(symbols: SymbolInfo[], refreshMs: number = DEFAULT_REFRESH_MS, cacheKey?: string): ScannerState {
  const [results, setResults] = useState<Record<string, ScanResult>>({});
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(0);
  const symbolKey = symbols.map((s) => s.symbol).join(',');
  const resultsRef = useRef<Record<string, ScanResult>>({});

  useEffect(() => {
    let cancelled = false;
    // Reset once when the symbol set actually changes (or on first mount) —
    // NOT inside run() itself. run() re-fires every refreshMs on the same
    // symbol set, and wiping resultsRef/setResults there blanked every
    // card on screen for as long as the re-scan took, symbol by symbol,
    // before anything reappeared. For crypto that's a live ~50-symbol
    // network round-trip every 60 seconds — on a slow or partially
    // unreachable connection that window can run long enough to be the
    // normal state you see, not a rare glitch, and it looks exactly like
    // "nothing here" even though the previous scan's data was perfectly
    // good a second earlier. Keep last-known-good results visible and
    // overlay fresh ones as they land instead.
    resultsRef.current = {};
    setResults({});

    let running = false;
    async function run() {
      // The interval and the visibility catch-up below can now both want to
      // fire around the same time (e.g. the tab regains focus right as the
      // interval was about to tick anyway) — without this guard that's two
      // concurrent stock scans, which for Twelve Data means double-spending
      // real credit budget for nothing.
      if (running) return;
      running = true;
      try {
        setLoading(true);
        setScanned(0);

        const stockSymbols = symbols.filter((s) => s.kind === 'stock');
        const cryptoSymbols = symbols.filter((s) => s.kind !== 'stock');

        if (stockSymbols.length) {
          const batch = await fetchStockBatch(stockSymbols);
          if (cancelled) return;
          for (const info of stockSymbols) {
            const { candles, isLive } = batch[info.symbol];
            resultsRef.current[info.symbol] = scanSymbol(info.symbol, candles, isLive);
          }
          setResults({ ...resultsRef.current });
          setScanned(stockSymbols.length);
        }

        for (let i = 0; i < cryptoSymbols.length; i += BATCH_SIZE) {
          if (cancelled) return;
          const batch = cryptoSymbols.slice(i, i + BATCH_SIZE);

          await Promise.all(
            batch.map(async (info) => {
              try {
                const { candles, isLive } = await fetchCandles(info.symbol);
                resultsRef.current[info.symbol] = scanSymbol(info.symbol, candles, isLive);
              } catch {
                // fetchCandles never throws in practice, but keep the scan resilient regardless
              }
            })
          );

          if (cancelled) return;
          setResults({ ...resultsRef.current });
          setScanned(stockSymbols.length + Math.min(i + BATCH_SIZE, cryptoSymbols.length));

          if (i + BATCH_SIZE < cryptoSymbols.length) await sleep(BATCH_DELAY_MS);
        }

        if (!cancelled) {
          setLoading(false);
          lastRunAt = Date.now();
          if (cacheKey) saveScanCache(cacheKey, resultsRef.current, lastRunAt, symbolKey);
        }
      } finally {
        running = false;
      }
    }

    // A mobile browser tab (especially a backgrounded home-screen web app)
    // can suspend JS timers for hours while the tab stays "open" in the
    // background — setInterval doesn't reliably keep firing on its own
    // schedule through that. Rather than leaving the dashboard showing
    // whatever was last fetched before the app was backgrounded until the
    // full refreshMs happens to elapse (which can take a long time to
    // notice on a suspended tab), catch up immediately whenever the page
    // becomes visible again if a refresh is actually due.
    let lastRunAt = 0;
    function handleVisibility() {
      if (document.visibilityState === 'visible' && Date.now() - lastRunAt >= refreshMs) run();
    }

    let interval: ReturnType<typeof setInterval> | undefined;
    function armInterval() {
      interval = setInterval(run, refreshMs);
      if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);
    }

    async function start() {
      if (cacheKey) {
        const cached = await loadScanCache(cacheKey);
        if (cancelled) return;
        if (cached && cached.symbolKey === symbolKey && Date.now() - cached.fetchedAt < refreshMs) {
          resultsRef.current = cached.results;
          setResults(cached.results);
          setLoading(false);
          setScanned(symbols.length);
          lastRunAt = cached.fetchedAt;
          armInterval();
          return;
        }
      }
      run();
      armInterval();
    }

    start();
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey, refreshMs, cacheKey]);

  return { results, loading, scanned, total: symbols.length };
}
