import type { SymbolInfo } from './symbols';

/**
 * TSX-listed leveraged/inverse ETFs (Horizons BetaPro's 2x Daily Bull/Bear
 * lineup), priced and settled in CAD — buyable directly from a Canadian
 * brokerage without the FX conversion or US-market access a ticker like
 * TQQQ requires. Canadian regulations cap these at 2x (vs. the US line's
 * 3x), so amplitude runs a bit lower than their US counterparts, but the
 * same "amplified daily swings -> cleaner channels" logic applies. Curated
 * by hand to the long-standing, liquid pairs; ticker accuracy checked
 * against known Horizons BetaPro products. Yahoo Finance addresses TSX
 * tickers with a ".TO" suffix.
 */
export const TSX_ETF_SYMBOLS: SymbolInfo[] = [
  { symbol: 'HQU.TO', name: 'Horizons BetaPro NASDAQ-100 2x Bull', kind: 'stock' },
  { symbol: 'HQD.TO', name: 'Horizons BetaPro NASDAQ-100 2x Bear', kind: 'stock' },
  { symbol: 'HSU.TO', name: 'Horizons BetaPro S&P 500 2x Bull', kind: 'stock' },
  { symbol: 'HSD.TO', name: 'Horizons BetaPro S&P 500 2x Bear', kind: 'stock' },
  { symbol: 'HXU.TO', name: 'Horizons BetaPro S&P/TSX 60 2x Bull', kind: 'stock' },
  { symbol: 'HXD.TO', name: 'Horizons BetaPro S&P/TSX 60 2x Bear', kind: 'stock' },
  { symbol: 'HGU.TO', name: 'Horizons BetaPro Global Gold 2x Bull', kind: 'stock' },
  { symbol: 'HGD.TO', name: 'Horizons BetaPro Global Gold 2x Bear', kind: 'stock' },
  { symbol: 'HOU.TO', name: 'Horizons BetaPro Crude Oil 2x Bull', kind: 'stock' },
  { symbol: 'HOD.TO', name: 'Horizons BetaPro Crude Oil 2x Bear', kind: 'stock' },
  { symbol: 'HNU.TO', name: 'Horizons BetaPro Natural Gas 2x Bull', kind: 'stock' },
  { symbol: 'HND.TO', name: 'Horizons BetaPro Natural Gas 2x Bear', kind: 'stock' },

  // Standard (unleveraged) baseline reference
  { symbol: 'XIU.TO', name: 'iShares S&P/TSX 60 Index ETF', kind: 'stock' },
];
