import { describe, expect, it, vi, beforeEach } from 'vitest';

const candle = { time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 };

vi.mock('../twelvedata', () => ({
  fetchTwelveDataDaily: vi.fn(),
  fetchTwelveDataDailyBatch: vi.fn(),
  fetchTwelveDataIntraday: vi.fn(),
}));
vi.mock('../stocks', () => ({
  fetchStockCandles: vi.fn(),
}));
vi.mock('../binance', () => ({
  fetchBinanceCandles: vi.fn(),
}));

import { fetchTwelveDataDaily, fetchTwelveDataDailyBatch } from '../twelvedata';
import { fetchStockCandles } from '../stocks';
import { fetchStockBatch } from '../fetch';
import type { SymbolInfo } from '../symbols';

function stock(symbol: string): SymbolInfo {
  return { symbol, name: symbol, kind: 'stock', exchange: 'S&P 500' };
}

describe('fetchStockBatch', () => {
  beforeEach(() => {
    vi.mocked(fetchTwelveDataDailyBatch).mockReset();
    vi.mocked(fetchTwelveDataDaily).mockReset();
    vi.mocked(fetchStockCandles).mockReset();
  });

  it('goes straight to Yahoo for every symbol when the whole batch call fails, without retrying Twelve Data individually', async () => {
    const infos = Array.from({ length: 30 }, (_, i) => stock(`SYM${i}`));
    vi.mocked(fetchTwelveDataDailyBatch).mockRejectedValue(new Error('budget exhausted'));
    vi.mocked(fetchStockCandles).mockResolvedValue([candle]);

    const result = await fetchStockBatch(infos);

    expect(fetchTwelveDataDaily).not.toHaveBeenCalled();
    expect(fetchStockCandles).toHaveBeenCalledTimes(30);
    expect(Object.keys(result)).toHaveLength(30);
    expect(result.SYM0.isLive).toBe(true);
  });

  it('retries Twelve Data individually only for the small handful missing from an otherwise-successful batch', async () => {
    const infos = [stock('A'), stock('B'), stock('C')];
    vi.mocked(fetchTwelveDataDailyBatch).mockResolvedValue({ A: [candle], B: [candle] });
    vi.mocked(fetchTwelveDataDaily).mockResolvedValue([candle]);

    const result = await fetchStockBatch(infos);

    expect(fetchTwelveDataDaily).toHaveBeenCalledTimes(1);
    expect(fetchTwelveDataDaily).toHaveBeenCalledWith(expect.objectContaining({ symbol: 'C' }));
    expect(Object.keys(result)).toHaveLength(3);
  });
});
