import { SP500_SYMBOLS } from './sp500';
import { EXTRA_SYMBOLS } from './extra_symbols';
import { ETF_SYMBOLS } from './etfs';

export type Exchange = 'S&P 500' | 'NASDAQ' | 'NYSE' | 'ETF';

export interface SymbolInfo {
  symbol: string; // display symbol, e.g. BTC or AAPL
  name: string;
  kind: 'crypto' | 'stock';
  binancePair?: string; // e.g. BTCUSDT
  exchange?: Exchange;
}

export const CRYPTO_SYMBOLS: SymbolInfo[] = [
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', kind: 'crypto', binancePair: 'ETHUSDT' },
  { symbol: 'SOL', name: 'Solana', kind: 'crypto', binancePair: 'SOLUSDT' },
];

const SP500_TAGGED: SymbolInfo[] = SP500_SYMBOLS.map((s) => ({ ...s, exchange: 'S&P 500' as const }));

export const STOCK_SYMBOLS: SymbolInfo[] = [...SP500_TAGGED, ...EXTRA_SYMBOLS, ...ETF_SYMBOLS];

export const ALL_SYMBOLS: SymbolInfo[] = [...CRYPTO_SYMBOLS, ...STOCK_SYMBOLS];

export function findSymbol(symbol: string): SymbolInfo | undefined {
  return ALL_SYMBOLS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
}
