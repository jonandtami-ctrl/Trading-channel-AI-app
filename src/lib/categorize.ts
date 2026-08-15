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
      return stockResults.filter((r) => !!r.stability);
  }
}
