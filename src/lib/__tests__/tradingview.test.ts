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
});
