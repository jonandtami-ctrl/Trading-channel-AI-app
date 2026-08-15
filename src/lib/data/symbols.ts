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

// A broad slice of established cryptocurrencies with an active Binance
// USDT pair (stablecoins, leveraged/inverse tokens, and wrapped-asset
// pairs excluded — none of those have a meaningful channel to find
// against USDT). Compiled from general knowledge, not a live ranking —
// unlike the S&P 500, crypto market-cap rank churns constantly, so this
// deliberately stays inside the more established, longer-lived layer of
// the market rather than chasing an exact "top 300 by cap" list that
// would go stale within weeks. All of these get scanned; the dashboard
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

  { symbol: 'TON', name: 'Toncoin', kind: 'crypto', binancePair: 'TONUSDT' },
  { symbol: 'SUI', name: 'Sui', kind: 'crypto', binancePair: 'SUIUSDT' },
  { symbol: 'SEI', name: 'Sei', kind: 'crypto', binancePair: 'SEIUSDT' },
  { symbol: 'TIA', name: 'Celestia', kind: 'crypto', binancePair: 'TIAUSDT' },
  { symbol: 'PYTH', name: 'Pyth Network', kind: 'crypto', binancePair: 'PYTHUSDT' },
  { symbol: 'JUP', name: 'Jupiter', kind: 'crypto', binancePair: 'JUPUSDT' },
  { symbol: 'WIF', name: 'dogwifhat', kind: 'crypto', binancePair: 'WIFUSDT' },
  { symbol: 'PEPE', name: 'Pepe', kind: 'crypto', binancePair: 'PEPEUSDT' },
  { symbol: 'FLOKI', name: 'FLOKI', kind: 'crypto', binancePair: 'FLOKIUSDT' },
  { symbol: 'BONK', name: 'Bonk', kind: 'crypto', binancePair: 'BONKUSDT' },
  { symbol: 'RENDER', name: 'Render', kind: 'crypto', binancePair: 'RENDERUSDT' },
  { symbol: 'FET', name: 'Fetch.ai', kind: 'crypto', binancePair: 'FETUSDT' },
  { symbol: 'GALA', name: 'Gala', kind: 'crypto', binancePair: 'GALAUSDT' },
  { symbol: 'APE', name: 'ApeCoin', kind: 'crypto', binancePair: 'APEUSDT' },
  { symbol: 'LDO', name: 'Lido DAO', kind: 'crypto', binancePair: 'LDOUSDT' },
  { symbol: 'ARKM', name: 'Arkham', kind: 'crypto', binancePair: 'ARKMUSDT' },
  { symbol: 'STX', name: 'Stacks', kind: 'crypto', binancePair: 'STXUSDT' },
  { symbol: 'KAS', name: 'Kaspa', kind: 'crypto', binancePair: 'KASUSDT' },
  { symbol: 'ORDI', name: 'ORDI', kind: 'crypto', binancePair: 'ORDIUSDT' },
  { symbol: 'CFX', name: 'Conflux', kind: 'crypto', binancePair: 'CFXUSDT' },
  { symbol: 'CAKE', name: 'PancakeSwap', kind: 'crypto', binancePair: 'CAKEUSDT' },
  { symbol: 'COMP', name: 'Compound', kind: 'crypto', binancePair: 'COMPUSDT' },
  { symbol: '1INCH', name: '1inch', kind: 'crypto', binancePair: '1INCHUSDT' },
  { symbol: 'YFI', name: 'yearn.finance', kind: 'crypto', binancePair: 'YFIUSDT' },
  { symbol: 'BAT', name: 'Basic Attention Token', kind: 'crypto', binancePair: 'BATUSDT' },
  { symbol: 'ZIL', name: 'Zilliqa', kind: 'crypto', binancePair: 'ZILUSDT' },
  { symbol: 'IOTA', name: 'IOTA', kind: 'crypto', binancePair: 'IOTAUSDT' },
  { symbol: 'NEO', name: 'NEO', kind: 'crypto', binancePair: 'NEOUSDT' },
  { symbol: 'WAVES', name: 'Waves', kind: 'crypto', binancePair: 'WAVESUSDT' },
  { symbol: 'DASH', name: 'Dash', kind: 'crypto', binancePair: 'DASHUSDT' },
  { symbol: 'ANKR', name: 'Ankr', kind: 'crypto', binancePair: 'ANKRUSDT' },
  { symbol: 'CELO', name: 'Celo', kind: 'crypto', binancePair: 'CELOUSDT' },
  { symbol: 'GMT', name: 'STEPN', kind: 'crypto', binancePair: 'GMTUSDT' },
  { symbol: 'MASK', name: 'Mask Network', kind: 'crypto', binancePair: 'MASKUSDT' },
  { symbol: 'ROSE', name: 'Oasis Network', kind: 'crypto', binancePair: 'ROSEUSDT' },
  { symbol: 'SKL', name: 'SKALE', kind: 'crypto', binancePair: 'SKLUSDT' },
  { symbol: 'LPT', name: 'Livepeer', kind: 'crypto', binancePair: 'LPTUSDT' },
  { symbol: 'BLUR', name: 'Blur', kind: 'crypto', binancePair: 'BLURUSDT' },
  { symbol: 'ID', name: 'SPACE ID', kind: 'crypto', binancePair: 'IDUSDT' },
  { symbol: 'SSV', name: 'ssv.network', kind: 'crypto', binancePair: 'SSVUSDT' },
  { symbol: 'HOOK', name: 'Hooked Protocol', kind: 'crypto', binancePair: 'HOOKUSDT' },
  { symbol: 'RPL', name: 'Rocket Pool', kind: 'crypto', binancePair: 'RPLUSDT' },
  { symbol: 'PENDLE', name: 'Pendle', kind: 'crypto', binancePair: 'PENDLEUSDT' },
  { symbol: 'ENS', name: 'Ethereum Name Service', kind: 'crypto', binancePair: 'ENSUSDT' },
  { symbol: 'JASMY', name: 'JasmyCoin', kind: 'crypto', binancePair: 'JASMYUSDT' },
  { symbol: 'WOO', name: 'WOO Network', kind: 'crypto', binancePair: 'WOOUSDT' },
  { symbol: 'GAS', name: 'Gas', kind: 'crypto', binancePair: 'GASUSDT' },
  { symbol: 'OMG', name: 'OMG Network', kind: 'crypto', binancePair: 'OMGUSDT' },
  { symbol: 'ZRX', name: '0x Protocol', kind: 'crypto', binancePair: 'ZRXUSDT' },
  { symbol: 'STORJ', name: 'Storj', kind: 'crypto', binancePair: 'STORJUSDT' },
  { symbol: 'BAND', name: 'Band Protocol', kind: 'crypto', binancePair: 'BANDUSDT' },
  { symbol: 'NKN', name: 'NKN', kind: 'crypto', binancePair: 'NKNUSDT' },
  { symbol: 'CTSI', name: 'Cartesi', kind: 'crypto', binancePair: 'CTSIUSDT' },
  { symbol: 'HOT', name: 'Holo', kind: 'crypto', binancePair: 'HOTUSDT' },
  { symbol: 'ICX', name: 'ICON', kind: 'crypto', binancePair: 'ICXUSDT' },
  { symbol: 'ONT', name: 'Ontology', kind: 'crypto', binancePair: 'ONTUSDT' },
  { symbol: 'QTUM', name: 'Qtum', kind: 'crypto', binancePair: 'QTUMUSDT' },
  { symbol: 'RVN', name: 'Ravencoin', kind: 'crypto', binancePair: 'RVNUSDT' },
  { symbol: 'SC', name: 'Siacoin', kind: 'crypto', binancePair: 'SCUSDT' },
  { symbol: 'SXP', name: 'Solar', kind: 'crypto', binancePair: 'SXPUSDT' },
  { symbol: 'TFUEL', name: 'Theta Fuel', kind: 'crypto', binancePair: 'TFUELUSDT' },
  { symbol: 'ONE', name: 'Harmony', kind: 'crypto', binancePair: 'ONEUSDT' },
  { symbol: 'CELR', name: 'Celer Network', kind: 'crypto', binancePair: 'CELRUSDT' },
  { symbol: 'COTI', name: 'COTI', kind: 'crypto', binancePair: 'COTIUSDT' },
  { symbol: 'DUSK', name: 'Dusk', kind: 'crypto', binancePair: 'DUSKUSDT' },
  { symbol: 'LRC', name: 'Loopring', kind: 'crypto', binancePair: 'LRCUSDT' },
  { symbol: 'OGN', name: 'Origin Protocol', kind: 'crypto', binancePair: 'OGNUSDT' },
  { symbol: 'PERP', name: 'Perpetual Protocol', kind: 'crypto', binancePair: 'PERPUSDT' },
  { symbol: 'POLYX', name: 'Polymesh', kind: 'crypto', binancePair: 'POLYXUSDT' },
  { symbol: 'POWR', name: 'Powerledger', kind: 'crypto', binancePair: 'POWRUSDT' },
  { symbol: 'REN', name: 'Ren', kind: 'crypto', binancePair: 'RENUSDT' },
  { symbol: 'REQ', name: 'Request', kind: 'crypto', binancePair: 'REQUSDT' },
  { symbol: 'SUPER', name: 'SuperVerse', kind: 'crypto', binancePair: 'SUPERUSDT' },
  { symbol: 'SYS', name: 'Syscoin', kind: 'crypto', binancePair: 'SYSUSDT' },
  { symbol: 'TRB', name: 'Tellor', kind: 'crypto', binancePair: 'TRBUSDT' },
  { symbol: 'TWT', name: 'Trust Wallet Token', kind: 'crypto', binancePair: 'TWTUSDT' },
  { symbol: 'UMA', name: 'UMA', kind: 'crypto', binancePair: 'UMAUSDT' },
  { symbol: 'XVS', name: 'Venus', kind: 'crypto', binancePair: 'XVSUSDT' },
  { symbol: 'YGG', name: 'Yield Guild Games', kind: 'crypto', binancePair: 'YGGUSDT' },
  { symbol: 'KNC', name: 'Kyber Network Crystal', kind: 'crypto', binancePair: 'KNCUSDT' },
  { symbol: 'LSK', name: 'Lisk', kind: 'crypto', binancePair: 'LSKUSDT' },
  { symbol: 'XEM', name: 'NEM', kind: 'crypto', binancePair: 'XEMUSDT' },
  { symbol: 'XVG', name: 'Verge', kind: 'crypto', binancePair: 'XVGUSDT' },
  { symbol: 'ARDR', name: 'Ardor', kind: 'crypto', binancePair: 'ARDRUSDT' },
  { symbol: 'BNT', name: 'Bancor', kind: 'crypto', binancePair: 'BNTUSDT' },
  { symbol: 'FXS', name: 'Frax Share', kind: 'crypto', binancePair: 'FXSUSDT' },
  { symbol: 'GNO', name: 'Gnosis', kind: 'crypto', binancePair: 'GNOUSDT' },
  { symbol: 'MTL', name: 'Metal', kind: 'crypto', binancePair: 'MTLUSDT' },
  { symbol: 'RAD', name: 'Radicle', kind: 'crypto', binancePair: 'RADUSDT' },

  { symbol: 'GMX', name: 'GMX', kind: 'crypto', binancePair: 'GMXUSDT' },
  { symbol: 'TAO', name: 'Bittensor', kind: 'crypto', binancePair: 'TAOUSDT' },
  { symbol: 'AR', name: 'Arweave', kind: 'crypto', binancePair: 'ARUSDT' },
  { symbol: 'JTO', name: 'Jito', kind: 'crypto', binancePair: 'JTOUSDT' },
  { symbol: 'W', name: 'Wormhole', kind: 'crypto', binancePair: 'WUSDT' },
  { symbol: 'RAY', name: 'Raydium', kind: 'crypto', binancePair: 'RAYUSDT' },
  { symbol: 'ENA', name: 'Ethena', kind: 'crypto', binancePair: 'ENAUSDT' },
  { symbol: 'ETHFI', name: 'ether.fi', kind: 'crypto', binancePair: 'ETHFIUSDT' },
  { symbol: 'ZK', name: 'ZKsync', kind: 'crypto', binancePair: 'ZKUSDT' },
  { symbol: 'ZRO', name: 'LayerZero', kind: 'crypto', binancePair: 'ZROUSDT' },
  { symbol: 'EIGEN', name: 'EigenLayer', kind: 'crypto', binancePair: 'EIGENUSDT' },
  { symbol: 'OMNI', name: 'Omni Network', kind: 'crypto', binancePair: 'OMNIUSDT' },
  { symbol: 'IO', name: 'io.net', kind: 'crypto', binancePair: 'IOUSDT' },
  { symbol: 'WLD', name: 'Worldcoin', kind: 'crypto', binancePair: 'WLDUSDT' },
  { symbol: 'STRK', name: 'Starknet', kind: 'crypto', binancePair: 'STRKUSDT' },
  { symbol: 'MANTA', name: 'Manta Network', kind: 'crypto', binancePair: 'MANTAUSDT' },
  { symbol: 'DYM', name: 'Dymension', kind: 'crypto', binancePair: 'DYMUSDT' },
  { symbol: 'NOT', name: 'Notcoin', kind: 'crypto', binancePair: 'NOTUSDT' },
  { symbol: 'BAL', name: 'Balancer', kind: 'crypto', binancePair: 'BALUSDT' },
  { symbol: 'SUSHI', name: 'SushiSwap', kind: 'crypto', binancePair: 'SUSHIUSDT' },
  { symbol: 'API3', name: 'API3', kind: 'crypto', binancePair: 'API3USDT' },
  { symbol: 'GLMR', name: 'Moonbeam', kind: 'crypto', binancePair: 'GLMRUSDT' },
  { symbol: 'ASTR', name: 'Astar', kind: 'crypto', binancePair: 'ASTRUSDT' },
  { symbol: 'ACH', name: 'Alchemy Pay', kind: 'crypto', binancePair: 'ACHUSDT' },
  { symbol: 'RSR', name: 'Reserve Rights', kind: 'crypto', binancePair: 'RSRUSDT' },
  { symbol: 'SFP', name: 'SafePal', kind: 'crypto', binancePair: 'SFPUSDT' },
  { symbol: 'GTC', name: 'Gitcoin', kind: 'crypto', binancePair: 'GTCUSDT' },
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
