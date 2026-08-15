import type { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export type Category = 'crypto' | 'stocks' | 'tsx' | 'stable';

export interface CategoryMeta {
  key: Category;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { key: 'crypto', title: 'Crypto', subtitle: '166 coins · Binance', icon: 'logo-bitcoin', color: colors.purple },
  { key: 'stocks', title: 'Stocks', subtitle: 'S&P 500 · Yahoo Finance / Twelve Data', icon: 'business-outline', color: colors.amber },
  { key: 'tsx', title: 'TSX (Canada)', subtitle: '96 companies · CAD, no FX fees', icon: 'flag-outline', color: colors.blue },
  { key: 'stable', title: 'Stable Ranges', subtitle: 'Long-term, low-volatility, going-nowhere', icon: 'shield-checkmark-outline', color: colors.green },
];

export function getCategoryMeta(key: string): CategoryMeta | undefined {
  return CATEGORIES.find((c) => c.key === key);
}
