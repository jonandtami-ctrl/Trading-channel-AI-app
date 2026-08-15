import { SP500_SYMBOLS } from './sp500';
import { TSX_SYMBOLS } from './tsx';

export type Exchange = 'S&P 500' | 'TSX';

export interface SymbolInfo {
  symbol: string; // display symbol, e.g. BTC or AAPL
  name: string;
  kind: 'crypto' | 'stock';
  binancePair?: string; // e.g. BTCUSDT
  exchange?: Exchange;
}

// Roughly the top 50 cryptocurrencies by market cap with an active
// Binance USDT pair (stablecoins, leveraged/inverse tokens, and
// wrapped-asset pairs excluded — none of those have a meaningful channel
// to find against USDT). Deliberately kept concentrated here rather than
// widened further — crypto market-cap rank churns fast, and the top 50
// is the layer where liquidity, listing longevity, and pattern quality
// are all most reliable. All of these get scanned; the dashboard
// only displays the best 10 by how close each one is to actually doing
// something (see CRYPTO_DISPLAY_CAP in the dashboard).
export const CRYPTO_SYMBOLS: SymbolInfo[] = [
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' },
  { symbol: 'ETH', name: 'Ethereum', kind: 'crypto', binancePair: 'ETHUSDT' },
  { symbol: 'XRP', name: 'XRP', kind: 'crypto', binancePair: 'XRPUSDT' },
  { symbol: 'BNB', name: 'BNB', kind: 'crypto', binancePair: 'BNBUSDT' },
  { symbol: 'SOL', name: 'Solana', kind: 'crypto', binancePair: 'SOLUSDT' },
  { symbol: 'DOGE', name: 'Dogecoin', kind: 'crypto', binancePair: 'DOGEUSDT' },
  { symbol: 'ADA', name: 'Cardano', kind: 'crypto', binancePair: 'ADAUSDT' },
  { symbol: 'TRX', name: 'TRON', kind: 'crypto', binancePair: 'TRXUSDT' },
  { symbol: 'AVAX', name: 'Avalanche', kind: 'crypto', binancePair: 'AVAXUSDT' },
  { symbol: 'LINK', name: 'Chainlink', kind: 'crypto', binancePair: 'LINKUSDT' },
  { symbol: 'SHIB', name: 'Shiba Inu', kind: 'crypto', binancePair: 'SHIBUSDT' },
  { symbol: 'DOT', name: 'Polkadot', kind: 'crypto', binancePair: 'DOTUSDT' },
  { symbol: 'BCH', name: 'Bitcoin Cash', kind: 'crypto', binancePair: 'BCHUSDT' },
  { symbol: 'NEAR', name: 'NEAR Protocol', kind: 'crypto', binancePair: 'NEARUSDT' },
  { symbol: 'LTC', name: 'Litecoin', kind: 'crypto', binancePair: 'LTCUSDT' },
  { symbol: 'ICP', name: 'Internet Computer', kind: 'crypto', binancePair: 'ICPUSDT' },
  { symbol: 'UNI', name: 'Uniswap', kind: 'crypto', binancePair: 'UNIUSDT' },
  { symbol: 'APT', name: 'Aptos', kind: 'crypto', binancePair: 'APTUSDT' },
  { symbol: 'ETC', name: 'Ethereum Classic', kind: 'crypto', binancePair: 'ETCUSDT' },
  { symbol: 'XLM', name: 'Stellar', kind: 'crypto', binancePair: 'XLMUSDT' },
  { symbol: 'FIL', name: 'Filecoin', kind: 'crypto', binancePair: 'FILUSDT' },
  { symbol: 'ATOM', name: 'Cosmos', kind: 'crypto', binancePair: 'ATOMUSDT' },
  { symbol: 'HBAR', name: 'Hedera', kind: 'crypto', binancePair: 'HBARUSDT' },
  { symbol: 'IMX', name: 'Immutable', kind: 'crypto', binancePair: 'IMXUSDT' },
  { symbol: 'VET', name: 'VeChain', kind: 'crypto', binancePair: 'VETUSDT' },
  { symbol: 'OP', name: 'Optimism', kind: 'crypto', binancePair: 'OPUSDT' },
  { symbol: 'ARB', name: 'Arbitrum', kind: 'crypto', binancePair: 'ARBUSDT' },
  { symbol: 'MKR', name: 'Maker', kind: 'crypto', binancePair: 'MKRUSDT' },
  { symbol: 'INJ', name: 'Injective', kind: 'crypto', binancePair: 'INJUSDT' },
  { symbol: 'GRT', name: 'The Graph', kind: 'crypto', binancePair: 'GRTUSDT' },
  { symbol: 'AAVE', name: 'Aave', kind: 'crypto', binancePair: 'AAVEUSDT' },
  { symbol: 'ALGO', name: 'Algorand', kind: 'crypto', binancePair: 'ALGOUSDT' },
  { symbol: 'SAND', name: 'The Sandbox', kind: 'crypto', binancePair: 'SANDUSDT' },
  { symbol: 'MANA', name: 'Decentraland', kind: 'crypto', binancePair: 'MANAUSDT' },
  { symbol: 'AXS', name: 'Axie Infinity', kind: 'crypto', binancePair: 'AXSUSDT' },
  { symbol: 'EGLD', name: 'MultiversX', kind: 'crypto', binancePair: 'EGLDUSDT' },
  { symbol: 'FTM', name: 'Fantom', kind: 'crypto', binancePair: 'FTMUSDT' },
  { symbol: 'THETA', name: 'Theta Network', kind: 'crypto', binancePair: 'THETAUSDT' },
  { symbol: 'XTZ', name: 'Tezos', kind: 'crypto', binancePair: 'XTZUSDT' },
  { symbol: 'EOS', name: 'EOS', kind: 'crypto', binancePair: 'EOSUSDT' },
  { symbol: 'RUNE', name: 'THORChain', kind: 'crypto', binancePair: 'RUNEUSDT' },
  { symbol: 'FLOW', name: 'Flow', kind: 'crypto', binancePair: 'FLOWUSDT' },
  { symbol: 'CHZ', name: 'Chiliz', kind: 'crypto', binancePair: 'CHZUSDT' },
  { symbol: 'KAVA', name: 'Kava', kind: 'crypto', binancePair: 'KAVAUSDT' },
  { symbol: 'MINA', name: 'Mina Protocol', kind: 'crypto', binancePair: 'MINAUSDT' },
  { symbol: 'CRV', name: 'Curve DAO', kind: 'crypto', binancePair: 'CRVUSDT' },
  { symbol: 'SNX', name: 'Synthetix', kind: 'crypto', binancePair: 'SNXUSDT' },
  { symbol: 'DYDX', name: 'dYdX', kind: 'crypto', binancePair: 'DYDXUSDT' },
  { symbol: 'ENJ', name: 'Enjin Coin', kind: 'crypto', binancePair: 'ENJUSDT' },
  { symbol: 'ZEC', name: 'Zcash', kind: 'crypto', binancePair: 'ZECUSDT' },
];

// A broad slice of the S&P 500 (see sp500.ts) — no ETFs, no leveraged
// products, just real companies — scanned for genuine, tradeable channels.
const SP500_TAGGED: SymbolInfo[] = SP500_SYMBOLS.map((s) => ({ ...s, exchange: 'S&P 500' as const }));
// Major TSX-listed Canadian companies (see tsx.ts) — priced/settled in
// CAD, cheaper to trade from a Canadian brokerage than a US ticker since
// there's no currency conversion. Scanned alongside the S&P 500 but kept
// in their own "TSX (Canada)" browse category and dashboard row.
const TSX_TAGGED: SymbolInfo[] = TSX_SYMBOLS.map((s) => ({ ...s, exchange: 'TSX' as const }));

export const STOCK_SYMBOLS: SymbolInfo[] = [...SP500_TAGGED, ...TSX_TAGGED];

export const ALL_SYMBOLS: SymbolInfo[] = [...CRYPTO_SYMBOLS, ...STOCK_SYMBOLS];

export function findSymbol(symbol: string): SymbolInfo | undefined {
  return ALL_SYMBOLS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase());
}
