import { Platform } from 'react-native';
import type { Candle } from '../types';
import { fetchWithRetry } from './fetchWithTimeout';

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Yahoo's chart endpoint doesn't send CORS headers, so a browser blocks the
 * response outright before JS ever sees it — only native apps (not subject
 * to browser CORS enforcement) can call it directly. The web build (the
 * deployed GitHub Pages site) routes through a public CORS-forwarding proxy
 * instead, or every stock/ETF fetch would silently fail over to demo data.
 */
function chartUrl(symbol: string, yahooRange: string): string {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yahooRange}&interval=1d`;
  return Platform.OS === 'web' ? `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}` : target;
}

export async function fetchStockCandles(symbol: string, yahooRange = '1y'): Promise<Candle[]> {
  const url = chartUrl(symbol, yahooRange);
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
