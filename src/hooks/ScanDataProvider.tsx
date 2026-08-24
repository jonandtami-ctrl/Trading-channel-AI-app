import { createContext, useContext, type ReactNode } from 'react';
import { useScanner, type ScannerState } from './useScanner';
import { CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '../lib/data/symbols';

const CRYPTO_REFRESH_MS = 60 * 1000;
// Twelve Data's free tier caps out at 800 credits/day (our own safety cap
// is 750 — see MAX_CREDITS_PER_DAY in twelvedata.ts), and the full stock
// universe — S&P 500 + TSX (~380 symbols) — costs ~380 credits per scan.
// This used to run every 12 hours, but two scans a day (760 credits)
// already exceeded that 750 cap on its own, before a single symbol-detail
// visit. The batch call's credit check is all-or-nothing, so that second
// scan didn't degrade gracefully — it failed outright, and the ~380
// symbols it covers all fell back to individual per-symbol retries at
// once, which is far more requests than the 8/minute Twelve Data rate
// limit allows; almost all of them got rate-limited within the same
// second and cascaded to Yahoo (or demo, if that was struggling under
// the same burst too). That's what made dashboard prices intermittently
// wrong for the whole stock/TSX universe while a single symbol's detail
// page — one on-demand fetch, never part of a stampede — stayed correct.
// Once a day comfortably fits the real budget with plenty of room left
// over for on-demand symbol-detail visits.
const STOCK_REFRESH_MS = 24 * 60 * 60 * 1000;

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
