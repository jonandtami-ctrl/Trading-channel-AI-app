import { createContext, useContext, type ReactNode } from 'react';
import { useScanner, type ScannerState } from './useScanner';
import { CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '../lib/data/symbols';

const CRYPTO_REFRESH_MS = 60 * 1000;
// Twelve Data's free tier caps out at 800 credits/day, and the full S&P
// 500 stock universe (~285 symbols) costs ~285 credits per scan — at 20
// minutes like crypto that's gone in under an hour. Every 12 hours keeps
// the day's total (2 scans x 285 = 570 credits) comfortably under budget
// with real headroom left for symbol-detail visits.
const STOCK_REFRESH_MS = 12 * 60 * 60 * 1000;

interface ScanDataContextValue {
  crypto: ScannerState;
  stocks: ScannerState;
}

const ScanDataContext = createContext<ScanDataContextValue | null>(null);

/**
 * Runs the crypto and stock scans exactly once at the app root and shares
 * the results everywhere they're needed (dashboard, per-category
 * drill-down screens). Without this, navigating into a category screen
 * would either re-scan the whole S&P 500 universe from scratch or need
 * results threaded through route params, neither of which works for data
 * this size.
 */
export function ScanDataProvider({ children }: { children: ReactNode }) {
  const crypto = useScanner(CRYPTO_SYMBOLS, CRYPTO_REFRESH_MS);
  const stocks = useScanner(STOCK_SYMBOLS, STOCK_REFRESH_MS);
  return <ScanDataContext.Provider value={{ crypto, stocks }}>{children}</ScanDataContext.Provider>;
}

export function useScanData(): ScanDataContextValue {
  const ctx = useContext(ScanDataContext);
  if (!ctx) throw new Error('useScanData must be used within a ScanDataProvider');
  return ctx;
}
