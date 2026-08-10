import { Platform } from 'react-native';
import type { Candle } from '../types';
import { fetchWithTimeout } from './fetchWithTimeout';
import { trimAtSplitDiscontinuity } from './splitDetect';

const YAHOO_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Yahoo's chart endpoint doesn't send CORS headers, so a browser blocks the
 * response outright before JS ever sees it — only a native app (not subject
 * to browser CORS enforcement) can call it directly. On web (the deployed
 * GitHub Pages site) this tries a couple of public CORS-forwarding proxies
 * in turn before falling back to demo data — free proxies come and go, so
 * relying on a single one isn't reliable enough on its own.
 *
 * The cache-buster on the target URL matters more than it looks: public
 * CORS proxies commonly cache responses by URL to cut their own origin
 * load, and a stale cached copy can badly mislead a leveraged/inverse ETF
 * price specifically — those funds do occasional reverse splits, and a
 * response cached from just before one shows a share price several times
 * too high with nothing about it looking obviously wrong.
 */
function candidateUrls(symbol: string, yahooRange: string, interval: string): string[] {
  const target = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${yahooRange}&interval=${interval}&_=${Date.now()}`;
  if (Platform.OS !== 'web') return [target];
  return [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(target)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
  ];
}

function parseChartResponse(json: any): Candle[] {
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
  return trimAtSplitDiscontinuity(candles);
}

export async function fetchStockCandles(symbol: string, yahooRange = '1y', interval = '1d'): Promise<Candle[]> {
  const urls = candidateUrls(symbol, yahooRange, interval);
  let lastError: unknown;

  for (const url of urls) {
    try {
      const res = await fetchWithTimeout(url, { headers: YAHOO_HEADERS, cache: 'no-store' }, 7000);
      if (!res.ok) throw new Error(`Yahoo request failed: ${res.status}`);
      return parseChartResponse(await res.json());
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error('All chart data sources failed');
}
