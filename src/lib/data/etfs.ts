import type { SymbolInfo } from './symbols';

/**
 * Popular ETFs, weighted toward leveraged/inverse daily-reset products —
 * their amplified daily swings tend to produce cleaner, faster-forming
 * support/resistance channels than the underlying index. A handful of
 * standard broad-market ETFs are included too as a baseline. Curated by
 * hand (not scraped) since there's no single reliable "leveraged ETF
 * list" dataset; ticker/name accuracy checked against known products.
 */
export const ETF_SYMBOLS: SymbolInfo[] = [
  // Leveraged bull / bear — indices
  { symbol: 'TQQQ', name: 'ProShares UltraPro QQQ (3x Nasdaq-100)', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SQQQ', name: 'ProShares UltraPro Short QQQ (-3x Nasdaq-100)', kind: 'stock', exchange: 'ETF' },
  { symbol: 'UPRO', name: 'ProShares UltraPro S&P500 (3x)', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SPXU', name: 'ProShares UltraPro Short S&P500 (-3x)', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SPXL', name: 'Direxion Daily S&P 500 Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SPXS', name: 'Direxion Daily S&P 500 Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'TNA', name: 'Direxion Daily Small Cap Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'TZA', name: 'Direxion Daily Small Cap Bear 3x', kind: 'stock', exchange: 'ETF' },

  // Leveraged — sectors
  { symbol: 'SOXL', name: 'Direxion Daily Semiconductor Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SOXS', name: 'Direxion Daily Semiconductor Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'FAS', name: 'Direxion Daily Financial Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'FAZ', name: 'Direxion Daily Financial Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'TECL', name: 'Direxion Daily Technology Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'TECS', name: 'Direxion Daily Technology Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'LABU', name: 'Direxion Daily S&P Biotech Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'LABD', name: 'Direxion Daily S&P Biotech Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'CURE', name: 'Direxion Daily Healthcare Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'RETL', name: 'Direxion Daily Retail Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'DPST', name: 'Direxion Daily Regional Banks Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'DRN', name: 'Direxion Daily Real Estate Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'DRV', name: 'Direxion Daily Real Estate Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'WEBL', name: 'Direxion Daily Dow Jones Internet Bull 3x', kind: 'stock', exchange: 'ETF' },

  // Leveraged — commodities / metals / energy
  { symbol: 'NUGT', name: 'Direxion Daily Gold Miners Bull 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'DUST', name: 'Direxion Daily Gold Miners Bear 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'JNUG', name: 'Direxion Daily Junior Gold Miners Bull 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'JDST', name: 'Direxion Daily Junior Gold Miners Bear 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'GUSH', name: 'Direxion Daily S&P Oil & Gas E&P Bull 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'DRIP', name: 'Direxion Daily S&P Oil & Gas E&P Bear 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'BOIL', name: 'ProShares Ultra Bloomberg Natural Gas 2x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'KOLD', name: 'ProShares UltraShort Bloomberg Natural Gas -2x', kind: 'stock', exchange: 'ETF' },

  // Leveraged — rates, volatility, international
  { symbol: 'TMF', name: 'Direxion Daily 20+ Yr Treasury Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'TMV', name: 'Direxion Daily 20+ Yr Treasury Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'UVXY', name: 'ProShares Ultra VIX Short-Term Futures', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SVXY', name: 'ProShares Short VIX Short-Term Futures', kind: 'stock', exchange: 'ETF' },
  { symbol: 'YINN', name: 'Direxion Daily FTSE China Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'YANG', name: 'Direxion Daily FTSE China Bear 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'FNGU', name: 'MicroSectors FANG+ Bull 3x', kind: 'stock', exchange: 'ETF' },
  { symbol: 'FNGD', name: 'MicroSectors FANG+ Bear 3x', kind: 'stock', exchange: 'ETF' },

  // Standard (unleveraged) broad-market reference ETFs
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq-100)', kind: 'stock', exchange: 'ETF' },
  { symbol: 'IWM', name: 'iShares Russell 2000', kind: 'stock', exchange: 'ETF' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average', kind: 'stock', exchange: 'ETF' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR', kind: 'stock', exchange: 'ETF' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR', kind: 'stock', exchange: 'ETF' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR', kind: 'stock', exchange: 'ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares', kind: 'stock', exchange: 'ETF' },
  { symbol: 'SLV', name: 'iShares Silver Trust', kind: 'stock', exchange: 'ETF' },
  { symbol: 'USO', name: 'United States Oil Fund', kind: 'stock', exchange: 'ETF' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets', kind: 'stock', exchange: 'ETF' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF', kind: 'stock', exchange: 'ETF' },
];
