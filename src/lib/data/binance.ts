import type { Candle } from '../types';
import { fetchWithRetry } from './fetchWithTimeout';

/** Binance's public klines endpoint allows cross-origin requests, so crypto can go live directly. */
export async function fetchBinanceCandles(pair: string, limit = 220): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=${limit}`;
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`Binance request failed: ${res.status}`);

  const raw = (await res.json()) as unknown[][];
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}
