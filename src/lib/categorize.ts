import type { ScanResult } from './types';
import type { Category } from '../constants/categories';
import { findSymbol } from './data/symbols';

/** Splits the crypto + stock scan results into the dashboard categories. */
export function resultsForCategory(category: Category, cryptoResults: ScanResult[], stockResults: ScanResult[]): ScanResult[] {
  switch (category) {
    case 'crypto':
      return cryptoResults;
    case 'stocks':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange !== 'TSX');
    case 'tsx':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'TSX');
    case 'stable':
      // A demo-fallback result (delisted ticker, unreachable data source,
      // etc.) can still compute a "stable range" — it's just fabricated
      // from synthetic candles with no relation to a real price.
      return stockResults.filter((r) => !!r.stability && r.isLive);
  }
}
