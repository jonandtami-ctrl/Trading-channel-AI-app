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
        alerts.push(
          makeAlert(symbol, 'breakout', last, resistance.price, `broke above resistance at ${fmt(resistance.price)}`)
        );
      } else if (channel.brokenDirection === 'down') {
        alerts.push(
          makeAlert(symbol, 'breakdown', last, support.price, `broke below support at ${fmt(support.price)}`)
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
    if (bounce === 'support') {
      alerts.push(makeAlert(symbol, 'bounce_support', last, support.price, `bounced off support at ${fmt(support.price)}`));
    } else if (bounce === 'resistance') {
      alerts.push(
        makeAlert(symbol, 'bounce_resistance', last, resistance.price, `bounced off resistance at ${fmt(resistance.price)}`)
      );
    }
  }

  return alerts;
}

function detectBounce(candles: Candle[], supportPrice: number, resistancePrice: number): 'support' | 'resistance' | null {
  if (candles.length < BOUNCE_LOOKBACK + 1) return null;
  const recent = candles.slice(-(BOUNCE_LOOKBACK + 1));
  const touchedSupport = recent.some((c) => c.low <= supportPrice * 1.005);
  const touchedResistance = recent.some((c) => c.high >= resistancePrice * 0.995);
  const last = recent[recent.length - 1];
  const first = recent[0];

  if (touchedSupport && last.close > first.close) return 'support';
  if (touchedResistance && last.close < first.close) return 'resistance';
  return null;
}

function makeAlert(symbol: string, type: Alert['type'], candle: Candle, levelPrice: number, message: string): Alert {
  return { symbol, type, price: candle.close, levelPrice, time: candle.time, message };
}

function fmt(n: number): string {
  return n >= 100 ? n.toFixed(2) : n.toFixed(4);
}
