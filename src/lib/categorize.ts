import type { ScanResult } from './types';
import type { Category } from '../constants/categories';
import { findSymbol } from './data/symbols';

/** Splits the crypto + stock/ETF scan results into the dashboard categories. */
export function resultsForCategory(category: Category, cryptoResults: ScanResult[], stockResults: ScanResult[]): ScanResult[] {
  switch (category) {
    case 'crypto':
      return cryptoResults;
    case 'stocks':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'Blue Chip');
    case 'canada':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'TSX');
    case 'etfs':
      return stockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'ETF');
    case 'stable':
      return stockResults.filter((r) => !!r.stability);
  }
}
