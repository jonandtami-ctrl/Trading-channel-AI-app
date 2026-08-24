import type { SymbolInfo } from './symbols';

/**
 * Major TSX (Toronto Stock Exchange)-listed Canadian companies — real,
 * currently publicly traded, single-class tickers only (dot/class-share
 * tickers like TECK.B or RCI.B need extra symbol-format handling for
 * Yahoo/Twelve Data that isn't worth the risk of getting wrong without a
 * way to test it live). Priced and settled in CAD, buyable directly from
 * a Canadian brokerage without the FX conversion a US ticker requires —
 * that's the whole point of a separate TSX view. Compiled from general
 * knowledge, not a live feed, so treat it the same way as sp500.ts: the
 * shape (real, large, currently-traded TSX companies) is what matters,
 * not pinpoint accuracy on the newest additions.
 *
 * Symbols use the ".TO" suffix Yahoo expects; toTwelveDataSymbol() and
 * tradingViewUrl() convert that to each service's own TSX format.
 */
export const TSX_SYMBOLS: SymbolInfo[] = [
  // Banks
  { symbol: 'RY.TO', name: 'Royal Bank of Canada', kind: 'stock' },
  { symbol: 'TD.TO', name: 'Toronto-Dominion Bank', kind: 'stock' },
  { symbol: 'BNS.TO', name: 'Bank of Nova Scotia', kind: 'stock' },
  { symbol: 'BMO.TO', name: 'Bank of Montreal', kind: 'stock' },
  { symbol: 'CM.TO', name: 'Canadian Imperial Bank of Commerce', kind: 'stock' },
  { symbol: 'NA.TO', name: 'National Bank of Canada', kind: 'stock' },
  { symbol: 'EQB.TO', name: 'EQB Inc.', kind: 'stock' },

  // Insurance / diversified financials
  { symbol: 'MFC.TO', name: 'Manulife Financial Corp.', kind: 'stock' },
  { symbol: 'SLF.TO', name: 'Sun Life Financial Inc.', kind: 'stock' },
  { symbol: 'GWO.TO', name: 'Great-West Lifeco Inc.', kind: 'stock' },
  { symbol: 'IFC.TO', name: 'Intact Financial Corp.', kind: 'stock' },
  { symbol: 'IAG.TO', name: 'iA Financial Corp.', kind: 'stock' },
  { symbol: 'FFH.TO', name: 'Fairfax Financial Holdings Ltd.', kind: 'stock' },
  { symbol: 'PWF.TO', name: 'Power Financial Corp.', kind: 'stock' },
  { symbol: 'ONEX.TO', name: 'Onex Corp.', kind: 'stock' },
  { symbol: 'IGM.TO', name: 'IGM Financial Inc.', kind: 'stock' },
  { symbol: 'CIX.TO', name: 'CI Financial Corp.', kind: 'stock' },
  { symbol: 'TRI.TO', name: 'Thomson Reuters Corp.', kind: 'stock' },

  // Energy
  { symbol: 'ENB.TO', name: 'Enbridge Inc.', kind: 'stock' },
  { symbol: 'TRP.TO', name: 'TC Energy Corp.', kind: 'stock' },
  { symbol: 'CNQ.TO', name: 'Canadian Natural Resources Ltd.', kind: 'stock' },
  { symbol: 'SU.TO', name: 'Suncor Energy Inc.', kind: 'stock' },
  { symbol: 'CVE.TO', name: 'Cenovus Energy Inc.', kind: 'stock' },
  { symbol: 'IMO.TO', name: 'Imperial Oil Ltd.', kind: 'stock' },
  { symbol: 'PPL.TO', name: 'Pembina Pipeline Corp.', kind: 'stock' },
  { symbol: 'ARX.TO', name: 'ARC Resources Ltd.', kind: 'stock' },
  { symbol: 'TOU.TO', name: 'Tourmaline Oil Corp.', kind: 'stock' },
  { symbol: 'WCP.TO', name: 'Whitecap Resources Inc.', kind: 'stock' },
  { symbol: 'PEY.TO', name: 'Peyto Exploration & Development Corp.', kind: 'stock' },
  { symbol: 'BTE.TO', name: 'Baytex Energy Corp.', kind: 'stock' },
  { symbol: 'PKI.TO', name: 'Parkland Corp.', kind: 'stock' },

  // Materials / Mining
  { symbol: 'ABX.TO', name: 'Barrick Gold Corp.', kind: 'stock' },
  { symbol: 'K.TO', name: 'Kinross Gold Corp.', kind: 'stock' },
  { symbol: 'FNV.TO', name: 'Franco-Nevada Corp.', kind: 'stock' },
  { symbol: 'WPM.TO', name: 'Wheaton Precious Metals Corp.', kind: 'stock' },
  { symbol: 'AEM.TO', name: 'Agnico Eagle Mines Ltd.', kind: 'stock' },
  { symbol: 'NTR.TO', name: 'Nutrien Ltd.', kind: 'stock' },
  { symbol: 'FM.TO', name: 'First Quantum Minerals Ltd.', kind: 'stock' },
  { symbol: 'CCO.TO', name: 'Cameco Corp.', kind: 'stock' },
  { symbol: 'LUN.TO', name: 'Lundin Mining Corp.', kind: 'stock' },
  { symbol: 'IVN.TO', name: 'Ivanhoe Mines Ltd.', kind: 'stock' },
  { symbol: 'HBM.TO', name: 'Hudbay Minerals Inc.', kind: 'stock' },
  { symbol: 'CG.TO', name: 'Centerra Gold Inc.', kind: 'stock' },
  { symbol: 'PAAS.TO', name: 'Pan American Silver Corp.', kind: 'stock' },
  { symbol: 'AGI.TO', name: 'Alamos Gold Inc.', kind: 'stock' },
  { symbol: 'ELD.TO', name: 'Eldorado Gold Corp.', kind: 'stock' },
  { symbol: 'WDO.TO', name: 'Wesdome Gold Mines Ltd.', kind: 'stock' },
  { symbol: 'MX.TO', name: 'Methanex Corp.', kind: 'stock' },

  // Industrials
  { symbol: 'CNR.TO', name: 'Canadian National Railway Co.', kind: 'stock' },
  { symbol: 'CP.TO', name: 'Canadian Pacific Kansas City Ltd.', kind: 'stock' },
  { symbol: 'WCN.TO', name: 'Waste Connections Inc.', kind: 'stock' },
  { symbol: 'TFII.TO', name: 'TFI International Inc.', kind: 'stock' },
  { symbol: 'STN.TO', name: 'Stantec Inc.', kind: 'stock' },
  { symbol: 'WSP.TO', name: 'WSP Global Inc.', kind: 'stock' },
  { symbol: 'TIH.TO', name: 'Toromont Industries Ltd.', kind: 'stock' },
  { symbol: 'GFL.TO', name: 'GFL Environmental Inc.', kind: 'stock' },
  { symbol: 'EFN.TO', name: 'Element Fleet Management Corp.', kind: 'stock' },
  { symbol: 'LNR.TO', name: 'Linamar Corp.', kind: 'stock' },
  { symbol: 'SJ.TO', name: 'Stella-Jones Inc.', kind: 'stock' },
  { symbol: 'CJT.TO', name: 'Cargojet Inc.', kind: 'stock' },
  { symbol: 'NFI.TO', name: 'NFI Group Inc.', kind: 'stock' },
  { symbol: 'RBA.TO', name: 'Ritchie Bros Auctioneers Inc.', kind: 'stock' },
  { symbol: 'AC.TO', name: 'Air Canada', kind: 'stock' },

  // Telecom
  { symbol: 'BCE.TO', name: 'BCE Inc.', kind: 'stock' },

  // Consumer
  { symbol: 'ATD.TO', name: 'Alimentation Couche-Tard Inc.', kind: 'stock' },
  { symbol: 'L.TO', name: 'Loblaw Companies Ltd.', kind: 'stock' },
  { symbol: 'DOL.TO', name: 'Dollarama Inc.', kind: 'stock' },
  { symbol: 'MRU.TO', name: 'Metro Inc.', kind: 'stock' },
  { symbol: 'QSR.TO', name: 'Restaurant Brands International Inc.', kind: 'stock' },
  { symbol: 'SAP.TO', name: 'Saputo Inc.', kind: 'stock' },
  { symbol: 'ATZ.TO', name: 'Aritzia Inc.', kind: 'stock' },
  { symbol: 'MTY.TO', name: 'MTY Food Group Inc.', kind: 'stock' },

  // Technology
  { symbol: 'SHOP.TO', name: 'Shopify Inc.', kind: 'stock' },
  { symbol: 'CSU.TO', name: 'Constellation Software Inc.', kind: 'stock' },
  { symbol: 'OTEX.TO', name: 'Open Text Corp.', kind: 'stock' },
  { symbol: 'DSG.TO', name: 'Descartes Systems Group Inc.', kind: 'stock' },
  { symbol: 'KXS.TO', name: 'Kinaxis Inc.', kind: 'stock' },
  { symbol: 'LSPD.TO', name: 'Lightspeed Commerce Inc.', kind: 'stock' },
  { symbol: 'ENGH.TO', name: 'Enghouse Systems Ltd.', kind: 'stock' },
  { symbol: 'BB.TO', name: 'BlackBerry Ltd.', kind: 'stock' },

  // Utilities
  { symbol: 'FTS.TO', name: 'Fortis Inc.', kind: 'stock' },
  { symbol: 'EMA.TO', name: 'Emera Inc.', kind: 'stock' },
  { symbol: 'AQN.TO', name: 'Algonquin Power & Utilities Corp.', kind: 'stock' },
  { symbol: 'CU.TO', name: 'Canadian Utilities Ltd.', kind: 'stock' },

  // Other large caps
  { symbol: 'BAM.TO', name: 'Brookfield Asset Management Ltd.', kind: 'stock' },
  { symbol: 'BN.TO', name: 'Brookfield Corp.', kind: 'stock' },
  { symbol: 'POW.TO', name: 'Power Corporation of Canada', kind: 'stock' },
  { symbol: 'X.TO', name: 'TMX Group Ltd.', kind: 'stock' },
  { symbol: 'MG.TO', name: 'Magna International Inc.', kind: 'stock' },
  { symbol: 'DOO.TO', name: 'BRP Inc.', kind: 'stock' },
  { symbol: 'NPI.TO', name: 'Northland Power Inc.', kind: 'stock' },
  { symbol: 'H.TO', name: 'Hydro One Ltd.', kind: 'stock' },
  { symbol: 'CAE.TO', name: 'CAE Inc.', kind: 'stock' },
  { symbol: 'GIL.TO', name: 'Gildan Activewear Inc.', kind: 'stock' },
  { symbol: 'WN.TO', name: 'George Weston Ltd.', kind: 'stock' },
];
