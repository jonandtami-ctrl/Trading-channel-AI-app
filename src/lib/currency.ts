import type { SymbolInfo } from './data/symbols';

/**
 * Item 1 — explicit trading currency, derived from exchange rather than
 * stored as a separate field that could drift out of sync with it. TSX
 * listings are CAD; everything else this app scans (S&P 500, crypto) is
 * USD. No FX conversion happens anywhere in the scanner itself — figures
 * are always shown in the symbol's own trading currency, never summed
 * across currencies (see journal/position.ts for the one place that does
 * convert, explicitly, for tax reporting).
 */
export type TradingCurrency = 'USD' | 'CAD';

export function currencyForSymbol(info: Pick<SymbolInfo, 'exchange'>): TradingCurrency {
  return info.exchange === 'TSX' ? 'CAD' : 'USD';
}
