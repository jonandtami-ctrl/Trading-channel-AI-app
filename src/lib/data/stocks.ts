import type { Candle } from '../types';
import { fetchWithRetry } from './fetchWithTimeout';

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Native apps aren't subject to browser CORS restrictions, so we can call
 * Yahoo Finance's chart endpoint directly — no proxy needed. A realistic
 * browser-style User-Agent + Accept headers make Yahoo's basic bot
 * heuristics far less likely to reject the request outright.
 */
export async function fetchStockCandles(symbol: string, yahooRange = '1y'): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yahooRange}&interval=1d`;
  const res = await fetchWithRetry(url, { headers: YAHOO_HEADERS });
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
  const volumes: (number | null)[] = quote.volume ?? [];

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    if (opens[i] == null || highs[i] == null || lows[i] == null || closes[i] == null) continue;
    candles.push({
      time: timestamps[i],
      open: opens[i] as number,
      high: highs[i] as number,
      low: lows[i] as number,
      close: closes[i] as number,
      volume: volumes[i] ?? undefined,
    });
  }

  if (candles.length === 0) throw new Error('No usable candles in Yahoo response');
  return candles;
}
