import type { Candle } from '../types';
import type { SymbolInfo } from './symbols';
import { fetchWithTimeout } from './fetchWithTimeout';

/**
 * A small Cloudflare Worker relay, not Twelve Data directly. Twelve Data's
 * free tier sends no CORS headers, so a browser blocks a direct fetch
 * before any JS runs — and the public CORS proxies tried first
 * (allorigins.win, corsproxy.io, api.codetabs.com) all turned out to be
 * dead or paywalled in practice, not just theoretically flaky. The Worker
 * fetches Twelve Data server-side (where CORS doesn't apply), adds the
 * permissive header back, and holds the API key itself — so it's no
 * longer embedded in the public site bundle either.
 */
const WORKER_URL = 'https://channelscanner.jonandtami.workers.dev/';

/**
 * Converts our internal symbol format to what Twelve Data expects. TSX
 * names use a colon-exchange suffix (e.g. "RY:TSX"), not the ".TO" suffix
 * Yahoo/our own data uses.
 */
export function toTwelveDataSymbol(info: SymbolInfo): string {
  if (info.exchange === 'TSX') return `${info.symbol.replace(/\.TO$/, '')}:TSX`;
  return info.symbol;
}

interface TDSeriesValue {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TDSeriesResponse {
  status?: string;
  message?: string;
  values?: TDSeriesValue[];
}

/** Parses Twelve Data's time_series values into our Candle shape, sorted oldest-first. */
export function parseSeries(values: TDSeriesValue[]): Candle[] {
  const candles: Candle[] = values.map((v) => {
    const iso = v.datetime.includes(' ') ? `${v.datetime.replace(' ', 'T')}Z` : `${v.datetime}T00:00:00Z`;
    return {
      time: Math.floor(new Date(iso).getTime() / 1000),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: v.volume ? parseFloat(v.volume) : undefined,
    };
  });
  candles.sort((a, b) => a.time - b.time);
  return candles;
}

// Free tier: 8 requests/minute, 800 credits/day (batch requests bill one
// credit per symbol, same as calling for each individually) — these limits
// are on the underlying Twelve Data account, so they still apply even
// though requests now go through the Worker relay. These two guards keep
// the app from hammering into 429s and from silently burning a whole
// day's budget in one or two scan cycles — once either is tripped, callers
// fall back to the Yahoo-proxy chain instead of waiting on a call that
// would just get rejected anyway.
const MAX_REQUESTS_PER_MINUTE = 8;
const MAX_CREDITS_PER_DAY = 750; // a bit under Twelve Data's 800 cap, as headroom
const requestTimestamps: number[] = [];
let creditsUsedToday = 0;
let creditsResetAt = startOfNextUtcDay();

function startOfNextUtcDay(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function budgetAvailable(creditsNeeded: number): boolean {
  if (Date.now() >= creditsResetAt) {
    creditsUsedToday = 0;
    creditsResetAt = startOfNextUtcDay();
  }
  return creditsUsedToday + creditsNeeded <= MAX_CREDITS_PER_DAY;
}

/**
 * Reserves a rate-limit slot, or throws immediately if none is free.
 *
 * This intentionally fails fast instead of sleeping until a slot opens up.
 * The normal path (fetchTwelveDataDailyBatch) uses exactly one slot for
 * the entire stock universe in a single request, so this essentially never
 * limits real traffic. But if that batch call itself fails — Twelve Data
 * down, misconfigured key, whatever — every symbol falls back to an
 * individual per-symbol call, and with 100+ of those firing concurrently,
 * a queue-and-sleep design would serialize most of them behind the 8/min
 * limit in ~60-second waves, turning a several-second fallback into a
 * multi-minute stall. Failing fast here means those calls drop straight
 * to the Yahoo/demo fallback instead of queuing for a resource that was
 * only ever sized for one request per scan.
 */
async function waitForRateLimitSlot(): Promise<void> {
  const now = Date.now();
  while (requestTimestamps.length && now - requestTimestamps[0] > 60_000) requestTimestamps.shift();
  if (requestTimestamps.length < MAX_REQUESTS_PER_MINUTE) {
    requestTimestamps.push(now);
    return;
  }
  throw new Error('Twelve Data rate limit reached');
}

async function callTimeSeries(symbolParam: string, interval: string, outputsize: number): Promise<any> {
  await waitForRateLimitSlot();
  const url = `${WORKER_URL}?symbol=${encodeURIComponent(symbolParam)}&interval=${interval}&outputsize=${outputsize}&timezone=UTC&order=ASC&_=${Date.now()}`;
  const res = await fetchWithTimeout(url, { cache: 'no-store' }, 10000);
  if (!res.ok) throw new Error(`Twelve Data relay request failed: ${res.status}`);
  return res.json();
}

const DEFAULT_DAILY_OUTPUTSIZE = 500; // ~2 years of trading days, matching the app's fixed analysis window
const DEFAULT_INTRADAY_OUTPUTSIZE = 120;

/** Fetches daily candles for one symbol via Twelve Data. Throws if unavailable so callers fall back. */
export async function fetchTwelveDataDaily(info: SymbolInfo, outputsize = DEFAULT_DAILY_OUTPUTSIZE): Promise<Candle[]> {
  if (!budgetAvailable(1)) throw new Error('Twelve Data daily credit budget exhausted');
  const json: TDSeriesResponse = await callTimeSeries(toTwelveDataSymbol(info), '1day', outputsize);
  if (json.status === 'error' || !json.values?.length) throw new Error(json.message ?? 'Twelve Data returned no data');
  creditsUsedToday += 1;
  return parseSeries(json.values);
}

/** Fetches hourly candles for one symbol via Twelve Data, for the 1D intraday chart view. */
export async function fetchTwelveDataIntraday(
  info: SymbolInfo,
  outputsize = DEFAULT_INTRADAY_OUTPUTSIZE
): Promise<Candle[]> {
  if (!budgetAvailable(1)) throw new Error('Twelve Data daily credit budget exhausted');
  const json: TDSeriesResponse = await callTimeSeries(toTwelveDataSymbol(info), '1h', outputsize);
  if (json.status === 'error' || !json.values?.length) throw new Error(json.message ?? 'Twelve Data returned no data');
  creditsUsedToday += 1;
  return parseSeries(json.values);
}

const BATCH_CHUNK_SIZE = 120; // Twelve Data's per-call symbol cap

/**
 * Fetches daily candles for many symbols in as few calls as possible.
 * Twelve Data bills batch requests per-symbol just like individual ones, so
 * this doesn't save credits, but it turns 100+ sequential requests — which
 * would blow through the 8-requests/minute free-tier limit almost
 * instantly — into ~1 request that respects it.
 */
export async function fetchTwelveDataDailyBatch(
  infos: SymbolInfo[],
  outputsize = DEFAULT_DAILY_OUTPUTSIZE
): Promise<Record<string, Candle[]>> {
  if (!budgetAvailable(infos.length)) throw new Error('Twelve Data daily credit budget exhausted');

  const result: Record<string, Candle[]> = {};
  for (let i = 0; i < infos.length; i += BATCH_CHUNK_SIZE) {
    const chunk = infos.slice(i, i + BATCH_CHUNK_SIZE);
    const symbolParam = chunk.map(toTwelveDataSymbol).join(',');
    const json = await callTimeSeries(symbolParam, '1day', outputsize);
    creditsUsedToday += chunk.length;

    if (chunk.length === 1) {
      // Twelve Data returns the flat single-symbol shape even via batch syntax when only one symbol is requested.
      if (json.status !== 'error' && json.values?.length) result[chunk[0].symbol] = parseSeries(json.values);
      continue;
    }

    for (const info of chunk) {
      const key = toTwelveDataSymbol(info);
      const entry: TDSeriesResponse | undefined = json[key];
      if (entry && entry.status !== 'error' && entry.values?.length) {
        result[info.symbol] = parseSeries(entry.values);
      }
    }
  }
  return result;
}
