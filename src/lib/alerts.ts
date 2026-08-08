import type { Alert, Candle, Channel } from './types';

const APPROACH_PCT = 1.5; // within 1.5% of a level counts as "approaching"
const BOUNCE_LOOKBACK = 3; // candles to look back for a bounce reversal

export function generateAlerts(symbol: string, candles: Candle[], channels: Channel[]): Alert[] {
  if (candles.length === 0) return [];
  const last = candles[candles.length - 1];
  const alerts: Alert[] = [];

  for (const channel of channels) {
    const { support, resistance } = channel;

    if (channel.status === 'broken') {
      if (channel.brokenDirection === 'up') {
        const strengthPct = ((last.close - resistance.price) / resistance.price) * 100;
        alerts.push(
          makeAlert(
            symbol,
            'breakout',
            last,
            resistance.price,
            `broke above resistance at ${fmt(resistance.price)}`,
            strengthPct
          )
        );
      } else if (channel.brokenDirection === 'down') {
        const strengthPct = ((support.price - last.close) / support.price) * 100;
        alerts.push(
          makeAlert(
            symbol,
            'breakdown',
            last,
            support.price,
            `broke below support at ${fmt(support.price)}`,
            strengthPct
          )
        );
      }
      continue;
    }

    const distToResistance = ((resistance.price - last.close) / last.close) * 100;
    const distToSupport = ((last.close - support.price) / last.close) * 100;

    if (distToResistance >= 0 && distToResistance <= APPROACH_PCT) {
      alerts.push(
        makeAlert(
          symbol,
          'approaching_resistance',
          last,
          resistance.price,
          `approaching resistance at ${fmt(resistance.price)}`
        )
      );
    }

    if (distToSupport >= 0 && distToSupport <= APPROACH_PCT) {
      alerts.push(
        makeAlert(symbol, 'approaching_support', last, support.price, `approaching support at ${fmt(support.price)}`)
      );
    }

    const bounce = detectBounce(candles, support.price, resistance.price);
    if (bounce?.type === 'support') {
      const strengthPct = ((last.close - bounce.touchedPrice) / bounce.touchedPrice) * 100;
      alerts.push(
        makeAlert(
          symbol,
          'bounce_support',
          last,
          support.price,
          `bounced off support at ${fmt(support.price)} (+${strengthPct.toFixed(1)}%)`,
          strengthPct
        )
      );
    } else if (bounce?.type === 'resistance') {
      const strengthPct = ((bounce.touchedPrice - last.close) / bounce.touchedPrice) * 100;
      alerts.push(
        makeAlert(
          symbol,
          'bounce_resistance',
          last,
          resistance.price,
          `bounced off resistance at ${fmt(resistance.price)} (-${strengthPct.toFixed(1)}%)`,
          strengthPct
        )
      );
    }
  }

  return alerts;
}

interface Bounce {
  type: 'support' | 'resistance';
  /** The actual extreme (low for a support touch, high for a resistance touch) reached during the lookback window. */
  touchedPrice: number;
}

function detectBounce(candles: Candle[], supportPrice: number, resistancePrice: number): Bounce | null {
  if (candles.length < BOUNCE_LOOKBACK + 1) return null;
  const recent = candles.slice(-(BOUNCE_LOOKBACK + 1));
  const supportTouches = recent.filter((c) => c.low <= supportPrice * 1.005);
  const resistanceTouches = recent.filter((c) => c.high >= resistancePrice * 0.995);
  const last = recent[recent.length - 1];
  const first = recent[0];

  if (supportTouches.length > 0 && last.close > first.close) {
    return { type: 'support', touchedPrice: Math.min(...supportTouches.map((c) => c.low)) };
  }
  if (resistanceTouches.length > 0 && last.close < first.close) {
    return { type: 'resistance', touchedPrice: Math.max(...resistanceTouches.map((c) => c.high)) };
  }
  return null;
}

function makeAlert(
  symbol: string,
  type: Alert['type'],
  candle: Candle,
  levelPrice: number,
  message: string,
  strengthPct?: number
): Alert {
  return { symbol, type, price: candle.close, levelPrice, time: candle.time, message, strengthPct };
}

function fmt(n: number): string {
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}
