import type { Candle } from '../types';

/** Small deterministic PRNG (mulberry32) so demo data is stable across renders/builds. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) {
    h = (h * 31 + symbol.charCodeAt(i)) | 0;
  }
  return h;
}

/**
 * Generates synthetic daily OHLC data that trends in, consolidates into a
 * clean support/resistance channel for a stretch, then resumes trending —
 * so the demo badge always shows something representative of what the
 * scanner is built to find, not just noise.
 */
export function generateDemoCandles(symbol: string, days = 220): Candle[] {
  const rand = mulberry32(hashSeed(symbol));
  const basePrice = 20 + rand() * 400;
  const now = Math.floor(Date.now() / 1000);
  const dayMs = 24 * 60 * 60;
  const startTime = now - days * dayMs;

  const channelStart = Math.floor(days * 0.35);
  const channelEnd = Math.floor(days * 0.75);
  const channelWidthPct = 0.04 + rand() * 0.06;

  const candles: Candle[] = [];
  let price = basePrice;
  let channelLow = 0;
  let channelHigh = 0;

  for (let i = 0; i < days; i++) {
    const inChannel = i >= channelStart && i < channelEnd;

    if (i === channelStart) {
      channelLow = price * (1 - channelWidthPct / 2);
      channelHigh = price * (1 + channelWidthPct / 2);
    }

    let drift: number;
    if (inChannel) {
      // mean-revert toward the channel midpoint with a random walk inside it
      const mid = (channelLow + channelHigh) / 2;
      drift = (mid - price) * 0.15 + (rand() - 0.5) * (channelHigh - channelLow) * 0.35;
    } else {
      drift = (rand() - 0.47) * price * 0.02;
    }

    const open = price;
    let close = open + drift;
    if (inChannel) {
      close = Math.min(Math.max(close, channelLow * 0.995), channelHigh * 1.005);
    }
    close = Math.max(close, 0.01);

    const wick = Math.abs(close - open) * (0.3 + rand() * 0.7);
    const high = Math.max(open, close) + wick * rand();
    const low = Math.max(0.01, Math.min(open, close) - wick * rand());

    candles.push({
      time: startTime + i * dayMs,
      open,
      high,
      low,
      close,
    });

    price = close;
  }

  return candles;
}
