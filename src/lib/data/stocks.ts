import type { Candle } from '../types';

const CORS_PROXY = 'https://corsproxy.io/?url=';

/**
 * Yahoo Finance's chart endpoint doesn't send CORS headers, so a direct
 * browser fetch is rejected. We try it anyway (works if run through a
 * server), then fall back to a public CORS proxy as a best effort. Either
 * path can legitimately fail — callers should fall back to demo data.
 */
export async function fetchStockCandles(symbol: string): Promise<Candle[]> {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1y&interval=1d`;

  try {
    return await fetchYahoo(target);
  } catch {
    return await fetchYahoo(CORS_PROXY + encodeURIComponent(target));
  }
}

async function fetchYahoo(url: string): Promise<Candle[]> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Yahoo request failed: ${res.status}`);

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('Unexpected Yahoo response shape');

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

  if (candles.length === 0) throw new Error('No usable candles in Yahoo response');
  return candles;
}
