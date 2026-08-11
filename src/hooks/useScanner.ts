import { useEffect, useRef, useState } from 'react';
import { fetchCandles, fetchStockBatch } from '../lib/data/fetch';
import { scanSymbol } from '../lib/scan';
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
 */
export function useScanner(symbols: SymbolInfo[], refreshMs: number = DEFAULT_REFRESH_MS): ScannerState {
  const [results, setResults] = useState<Record<string, ScanResult>>({});
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(0);
  const symbolKey = symbols.map((s) => s.symbol).join(',');
  const resultsRef = useRef<Record<string, ScanResult>>({});

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setScanned(0);
      resultsRef.current = {};
      setResults({});

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

      if (!cancelled) setLoading(false);
    }

    run();
    const interval = setInterval(run, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey, refreshMs]);

  return { results, loading, scanned, total: symbols.length };
}
