import type { Candle } from '../types';

/** Calls our own /api/stocks proxy (server-side, so Yahoo's missing CORS headers don't matter). */
export async function fetchStockCandles(symbol: string): Promise<Candle[]> {
  const res = await fetch(`/api/stocks/${symbol}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Stock proxy request failed: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Unexpected response shape');

  const timestamps: number[] = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens: (number | null)[] = quote.open ?? [];
  const highs: (number | null)[] = quote.high ?? [];
  const lows: (number | null)[] = quote.low ?? [];
  const closes: (number | null)[] = quote.close ?? [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null) continue;
    candles.push({
      time: timestamps[i],
      open: opens[i] as number,
      high: highs[i] as number,
      low: lows[i] as number,
      close: closes[i] as number,
    });
  }

  if (candles.length === 0) throw new Error('No usable candles in response');
  return candles;
}
