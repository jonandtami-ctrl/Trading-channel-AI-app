import type { ScanResult } from './types';
import type { Category } from '../constants/categories';
import { findSymbol } from './data/symbols';

// A handful of S&P 500 constituents are real but genuinely obscure to
// anyone who isn't following the index professionally — see the
// `notable` doc comment on SymbolInfo. Excluded from every browse/signal
// surface below, but never from the underlying scan itself, so a symbol
// someone has actually pinned or logged a trade against still resolves a
// live price (see pinned.tsx/journal.tsx, which read the raw scan results
// directly and don't go through this function at all).
function isNotable(r: ScanResult): boolean {
  return findSymbol(r.symbol)?.notable !== false;
}

/** Splits the crypto + stock scan results into the dashboard categories. */
export function resultsForCategory(category: Category, cryptoResults: ScanResult[], stockResults: ScanResult[]): ScanResult[] {
  switch (category) {
    case 'crypto':
      return cryptoResults;
    case 'stocks':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange !== 'TSX' && isNotable(r));
    case 'tsx':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'TSX' && isNotable(r));
    case 'stable':
      // A demo-fallback result (delisted ticker, unreachable data source,
      // etc.) can still compute a "stable range" — it's just fabricated
      // from synthetic candles with no relation to a real price.
      return stockResults.filter((r) => !!r.stability && r.isLive && isNotable(r));
  }
}
