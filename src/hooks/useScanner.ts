import { useEffect, useState } from 'react';
import { fetchCandles } from '../lib/data/fetch';
import { scanSymbol } from '../lib/scan';
import type { ScanResult } from '../lib/types';
import type { SymbolInfo } from '../lib/data/symbols';

export interface ScannerState {
  results: Record<string, ScanResult>;
  loading: boolean;
}

const REFRESH_MS = 5 * 60 * 1000;

export function useScanner(symbols: SymbolInfo[]): ScannerState {
  const [results, setResults] = useState<Record<string, ScanResult>>({});
  const [loading, setLoading] = useState(true);
  const symbolKey = symbols.map((s) => s.symbol).join(',');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      const next: Record<string, ScanResult> = {};
      await Promise.all(
        symbols.map(async (info) => {
          try {
            const { candles, isLive } = await fetchCandles(info.symbol);
            next[info.symbol] = scanSymbol(info.symbol, candles, isLive);
          } catch {
            // fetchCandles never throws in practice, but keep the UI resilient regardless
          }
        })
      );
      if (!cancelled) {
        setResults(next);
        setLoading(false);
      }
    }

    run();
    const interval = setInterval(run, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolKey]);

  return { results, loading };
}
