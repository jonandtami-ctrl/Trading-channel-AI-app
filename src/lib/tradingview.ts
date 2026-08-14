import type { SymbolInfo } from './data/symbols';

/**
 * Builds a link to the same symbol on TradingView, so its own (independently
 * maintained, split-adjusted) chart is one tap away to cross-check against —
 * this app's chart stays the primary view since it's the only one that can
 * show the buy/sell channel lines TradePlanCard is talking about.
 */
export function tradingViewUrl(info: SymbolInfo): string {
  if (info.kind === 'crypto' && info.binancePair) {
    return `https://www.tradingview.com/chart/?symbol=BINANCE%3A${info.binancePair}`;
  }
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(info.symbol)}`;
}
