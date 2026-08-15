import { describe, expect, it } from 'vitest';
import { tradingViewUrl } from '../tradingview';

describe('tradingViewUrl', () => {
  it('builds a Binance-prefixed link for crypto', () => {
    const url = tradingViewUrl({ symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', binancePair: 'BTCUSDT' });
    expect(url).toBe('https://www.tradingview.com/chart/?symbol=BINANCE%3ABTCUSDT');
  });

  it('builds a plain symbol link for stocks', () => {
    const url = tradingViewUrl({ symbol: 'AAPL', name: 'Apple Inc.', kind: 'stock', exchange: 'S&P 500' });
    expect(url).toBe('https://www.tradingview.com/chart/?symbol=AAPL');
  });

  it('builds a TSX-prefixed link, stripped of the .TO suffix, for TSX stocks', () => {
    const url = tradingViewUrl({ symbol: 'RY.TO', name: 'Royal Bank of Canada', kind: 'stock', exchange: 'TSX' });
    expect(url).toBe('https://www.tradingview.com/chart/?symbol=TSX%3ARY');
  });
});
