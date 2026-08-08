import { useEffect, useRef, useState } from 'react';
import { fetchCandles } from '../lib/data/fetch';
import { scanSymbol } from '../lib/scan';
import type { ScanResult } from '../lib/types';
import type { SymbolInfo } from '../lib/data/symbols';

export interface ScannerState {
  results: Record<string, ScanResult>;
  loading: boolean;
  scanned: number;
  total: number;
}

const REFRESH_MS = 20 * 60 * 1000;
const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scans symbols in small concurrency-limited batches instead of firing
 * hundreds of requests at once — kinder to Yahoo's unofficial endpoint
 * (less likely to get rate-limited) and lets the UI fill in results as
 * they arrive instead of blocking on the whole universe.
 */
export function useScanner(symbols: SymbolInfo[]): ScannerState {
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

      for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = symbols.slice(i, i + BATCH_SIZE);

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
        setScanned(Math.min(i + BATCH_SIZE, symbols.length));

        if (i + BATCH_SIZE < symbols.length) await sleep(BATCH_DELAY_MS);
      }

      if (!cancelled) setLoading(false);
    }

    run();
    const interval = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  return { results, loading, scanned, total: symbols.length };
}
