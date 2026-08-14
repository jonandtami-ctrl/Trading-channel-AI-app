import type { ScanResult } from './types';
import type { Category } from '../constants/categories';

/** Splits the crypto + stock scan results into the dashboard categories. */
export function resultsForCategory(category: Category, cryptoResults: ScanResult[], stockResults: ScanResult[]): ScanResult[] {
  switch (category) {
    case 'crypto':
      return cryptoResults;
    case 'stocks':
      return stockResults;
    case 'stable':
      return stockResults.filter((r) => !!r.stability);
  }
}
