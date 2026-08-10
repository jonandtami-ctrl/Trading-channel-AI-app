import type { SymbolInfo } from './symbols';

/**
 * TSX-listed leveraged/inverse ETFs (BetaPro's 2x Daily Bull/Bear lineup,
 * issued by Global X Investments Canada — the 2022 rebrand of Horizons
 * ETFs), priced and settled in CAD — buyable directly from a Canadian
 * brokerage without the FX conversion or US-market access a ticker like
 * TQQQ requires. Canadian regulations cap these at 2x (vs. the US line's
 * 3x), so amplitude runs a bit lower than their US counterparts, but the
 * same "amplified daily swings -> cleaner channels" logic applies.
 *
 * IMPORTANT: Global X renamed several of these tickers effective Jan 20,
 * 2025 (old H-prefixed symbol -> new symbol) — the fund itself didn't
 * change, just the ticker. Verified against betapro.ca's live product
 * pages and Yahoo Finance's current listings before fixing this file:
 * HQU -> QQU, HQD -> QQD, HGU -> GDXU, HGD -> GDXD. HXU/HXD (S&P/TSX 60)
 * and HSU/HSD (S&P 500) were NOT part of that renaming and still resolve
 * under their original tickers. If a price here ever looks wrong, that's
 * the first thing to check — Global X could rename more of these later.
 */
export const TSX_ETF_SYMBOLS: SymbolInfo[] = [
  { symbol: 'QQU.TO', name: 'BetaPro NASDAQ-100 2x Daily Bull', kind: 'stock' },
  { symbol: 'QQD.TO', name: 'BetaPro NASDAQ-100 -2x Daily Bear', kind: 'stock' },
  { symbol: 'HSU.TO', name: 'BetaPro S&P 500 2x Daily Bull', kind: 'stock' },
  { symbol: 'HSD.TO', name: 'BetaPro S&P 500 -2x Daily Bear', kind: 'stock' },
  { symbol: 'HXU.TO', name: 'BetaPro S&P/TSX 60 2x Daily Bull', kind: 'stock' },
  { symbol: 'HXD.TO', name: 'BetaPro S&P/TSX 60 -2x Daily Bear', kind: 'stock' },
  { symbol: 'GDXU.TO', name: 'BetaPro Canadian Gold Miners 2x Daily Bull', kind: 'stock' },
  { symbol: 'GDXD.TO', name: 'BetaPro Canadian Gold Miners -2x Daily Bear', kind: 'stock' },
  { symbol: 'HOU.TO', name: 'BetaPro Crude Oil Leveraged Daily Bull', kind: 'stock' },
  { symbol: 'HOD.TO', name: 'BetaPro Crude Oil Inverse Leveraged Daily Bear', kind: 'stock' },
  { symbol: 'HNU.TO', name: 'BetaPro Natural Gas Leveraged Daily Bull', kind: 'stock' },
  { symbol: 'HND.TO', name: 'BetaPro Natural Gas Inverse Leveraged Daily Bear', kind: 'stock' },

  // Standard (unleveraged) baseline reference — iShares, not Global X, unaffected by the rename
  { symbol: 'XIU.TO', name: 'iShares S&P/TSX 60 Index ETF', kind: 'stock' },
];
