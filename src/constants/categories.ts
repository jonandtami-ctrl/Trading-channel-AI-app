import type { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export type Category = 'crypto' | 'stocks' | 'etfs' | 'stable';

export interface CategoryMeta {
  key: Category;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'crypto', title: 'Crypto', subtitle: 'Top 50 by market cap · Binance', icon: 'logo-bitcoin', color: colors.purple },
  { key: 'stocks', title: 'Stocks', subtitle: 'S&P 500 · Yahoo Finance', icon: 'business-outline', color: colors.blue },
  { key: 'etfs', title: 'ETFs', subtitle: 'Leveraged & inverse funds · Yahoo Finance', icon: 'layers-outline', color: colors.accent },
  { key: 'stable', title: 'Stable Ranges', subtitle: 'Long-term, low-volatility, going-nowhere', icon: 'shield-checkmark-outline', color: colors.green },
];

export function getCategoryMeta(key: string): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
