export interface SymbolInfo {
  symbol: string; // display symbol, e.g. BTC or AAPL
  name: string;
  kind: 'crypto' | 'stock';
  binancePair?: string; // e.g. BTCUSDT
}

export const CRYPTO_SYMBOLS: SymbolInfo[] = [
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', kind: 'crypto', binancePair: 'ETHUSDT' },
  { symbol: 'SOL', name: 'Solana', kind: 'crypto', binancePair: 'SOLUSDT' },
];

export const STOCK_SYMBOLS: SymbolInfo[] = [
  { symbol: 'AAPL', name: 'Apple', kind: 'stock' },
  { symbol: 'MSFT', name: 'Microsoft', kind: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'stock' },
  { symbol: 'AMZN', name: 'Amazon', kind: 'stock' },
  { symbol: 'GOOGL', name: 'Alphabet', kind: 'stock' },
  { symbol: 'META', name: 'Meta Platforms', kind: 'stock' },
  { symbol: 'TSLA', name: 'Tesla', kind: 'stock' },
  { symbol: 'AMD', name: 'AMD', kind: 'stock' },
  { symbol: 'NFLX', name: 'Netflix', kind: 'stock' },
  { symbol: 'JPM', name: 'JPMorgan Chase', kind: 'stock' },
  { symbol: 'V', name: 'Visa', kind: 'stock' },
  { symbol: 'DIS', name: 'Disney', kind: 'stock' },
  { symbol: 'BA', name: 'Boeing', kind: 'stock' },
  { symbol: 'INTC', name: 'Intel', kind: 'stock' },
  { symbol: 'COIN', name: 'Coinbase', kind: 'stock' },
];

export const ALL_SYMBOLS: SymbolInfo[] = [...CRYPTO_SYMBOLS, ...STOCK_SYMBOLS];

export function findSymbol(symbol: string): SymbolInfo | undefined {
  return ALL_SYMBOLS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
}
