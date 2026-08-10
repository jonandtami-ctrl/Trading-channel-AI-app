import { describe, expect, it } from 'vitest';
import { tradingViewUrl } from '../tradingview';

describe('tradingViewUrl', () => {
  it('builds a Binance-prefixed link for crypto', () => {
    const url = tradingViewUrl({ symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' });
    expect(url).toBe('https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT');
  });

  it('builds a TSX-prefixed link with the .TO suffix stripped', () => {
    const url = tradingViewUrl({ symbol: 'QQU.TO', name: 'BetaPro NASDAQ-100 2x Daily Bull', kind: 'stock', exchange: 'TSX' });
    expect(url).toBe('https://www.tradingview.com/chart/?symbol=TSX%3AQQU');
  });

  it('builds a plain symbol link for US stocks/ETFs', () => {
    const url = tradingViewUrl({ symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', exchange: 'Blue Chip' });
    expect(url).toBe('https://www.tradingview.com/chart/?symbol=AAPL');
  });
});
