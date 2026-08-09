import type { Candle, Channel, Level } from './types';

const MIN_TOUCHES = 2;
const MIN_WIDTH_PCT = 1;
const MAX_WIDTH_PCT = 15;
const MIN_CONTAINMENT_PCT = 80;
const BAND_TOLERANCE = 0.005; // 0.5% slack around each level when checking containment
const BREAK_TOLERANCE = 0.01; // price must close 1% past a level to count as broken
// Last touch must fall within roughly the most recent ~3 months of daily
// data. Fixed in candles, not a fraction of whatever lookback is loaded —
// a channel last touched 4 months ago isn't "active" just because someone
// is viewing a 2-year chart; it should read the same on a 1Y, 2Y, or 3M view.
const RECENT_CANDLES = 60;
// A channel's full life — from its first touch to its last — must fit inside
// roughly a month of trading days. Longer-spanning channels take quarters or
// years to complete a swing between support and resistance, which isn't a
// tradeable horizon for a swing trade entered today.
const MAX_SPAN_CANDLES = 25;

/**
 * Pairs support + resistance levels into channels. A pair only becomes a
 * channel if both sides have enough touches, price actually stayed
 * contained between them most of the time, the band isn't absurdly wide
 * or vanishingly thin, and at least one touch is recent enough to still
 * be relevant.
 */
export function detectChannels(
  candles: Candle[],
  levels: Level[],
  opts: { maxSpanCandles?: number } = {}
): Channel[] {
  if (candles.length === 0) return [];
  const maxSpanCandles = opts.maxSpanCandles ?? MAX_SPAN_CANDLES;

  const supports = levels.filter((l) => l.type === 'support' && l.touches.length >= MIN_TOUCHES);
  const resistances = levels.filter((l) => l.type === 'resistance' && l.touches.length >= MIN_TOUCHES);
  const channels: Channel[] = [];
  const recencyCutoff = Math.max(0, candles.length - RECENT_CANDLES);

  for (const support of supports) {
    for (const resistance of resistances) {
      if (resistance.price <= support.price) continue;

      const widthPct = ((resistance.price - support.price) / support.price) * 100;
      if (widthPct < MIN_WIDTH_PCT || widthPct > MAX_WIDTH_PCT) continue;

      const firstTouchIndex = Math.min(
        support.touches[0].index,
        resistance.touches[0].index
      );
      const lastTouchIndex = Math.max(
        support.touches[support.touches.length - 1].index,
        resistance.touches[resistance.touches.length - 1].index
      );

      if (lastTouchIndex < recencyCutoff) continue;

      const window = candles.slice(firstTouchIndex, lastTouchIndex + 1);
      if (window.length === 0) continue;
      if (window.length > maxSpanCandles) continue;

      const bandLow = support.price * (1 - BAND_TOLERANCE);
      const bandHigh = resistance.price * (1 + BAND_TOLERANCE);
      const containedCount = window.filter((c) => c.low >= bandLow && c.high <= bandHigh).length;
      const containmentPct = (containedCount / window.length) * 100;

      if (containmentPct < MIN_CONTAINMENT_PCT) continue;

      const lastCandle = candles[candles.length - 1];
      let status: Channel['status'] = 'active';
      let brokenDirection: Channel['brokenDirection'];

      if (lastCandle.close > resistance.price * (1 + BREAK_TOLERANCE)) {
        status = 'broken';
        brokenDirection = 'up';
      } else if (lastCandle.close < support.price * (1 - BREAK_TOLERANCE)) {
        status = 'broken';
        brokenDirection = 'down';
      }

      channels.push({
        support,
        resistance,
        widthPct,
        containmentPct,
        status,
        brokenDirection,
        lastTouchIndex,
      });
    }
  }

  // Prefer the tightest, most-contained channel when candidates overlap.
  channels.sort((a, b) => b.containmentPct - a.containmentPct || a.widthPct - b.widthPct);
  return dedupeOverlapping(channels);
}

function dedupeOverlapping(channels: Channel[]): Channel[] {
  const kept: Channel[] = [];
  for (const channel of channels) {
    const overlaps = kept.some(
      (k) =>
        channel.support.price < k.resistance.price * 1.02 &&
        channel.resistance.price > k.support.price * 0.98
    );
    if (!overlaps) kept.push(channel);
  }
  return kept;
}
