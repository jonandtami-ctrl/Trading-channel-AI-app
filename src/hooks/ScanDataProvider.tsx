import { createContext, useContext, type ReactNode } from 'react';
import { useScanner, type ScannerState } from './useScanner';
import { CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '../lib/data/symbols';

const CRYPTO_REFRESH_MS = 60 * 1000;

interface ScanDataContextValue {
  crypto: ScannerState;
  stocks: ScannerState;
}

const ScanDataContext = createContext<ScanDataContextValue | null>(null);

/**
 * Runs the crypto and ETF scans exactly once at the app root and shares
 * the results everywhere they're needed (dashboard, per-category
 * drill-down screens). Without this, navigating into a category screen
 * would either re-scan the ETF universe from scratch or need results
 * threaded through route params, neither of which works for data this
 * size.
 */
export function ScanDataProvider({ children }: { children: ReactNode }) {
  const crypto = useScanner(CRYPTO_SYMBOLS, CRYPTO_REFRESH_MS);
  const stocks = useScanner(STOCK_SYMBOLS);
  return <ScanDataContext.Provider value={{ crypto, stocks }}>{children}</ScanDataContext.Provider>;
}

export function useScanData(): ScanDataContextValue {
  const ctx = useContext(ScanDataContext);
  if (!ctx) throw new Error('useScanData must be used within a ScanDataProvider');
  return ctx;
}
