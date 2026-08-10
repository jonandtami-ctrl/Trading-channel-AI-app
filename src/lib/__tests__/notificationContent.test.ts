import { describe, expect, it } from 'vitest';
import { buildSignalNotificationBody, buildWeeklyDigestBody, computeNewSignals } from '../notificationContent';
import type { Alert, Candle, Channel, ScanResult } from '../types';

function makeResult(symbol: string, alerts: Alert[], channels: Channel[] = []): ScanResult {
  const candles: Candle[] = [{ time: 0, open: 100, high: 100, low: 100, close: 100 }];
  return { symbol, candles, channels, levels: [], alerts, isLive: true };
}

function alert(type: Alert['type'], levelPrice: number): Alert {
  return { symbol: 'TEST', type, price: 100, levelPrice, time: 0, message: '' };
}

const TODAY = '2026-08-08';
const TOMORROW = '2026-08-09';

describe('computeNewSignals — simulates repeated auto-refresh cycles', () => {
  it('flags a fresh buy signal on the first scan', () => {
    const results = [makeResult('AAPL', [alert('bounce_support', 90)])];
    const { newBuys, newSells, nextSeen } = computeNewSignals(results, new Set(), TODAY);
    expect(newBuys).toEqual(['AAPL']);
    expect(newSells).toEqual([]);
    expect(nextSeen.has(`AAPL-buy-${TODAY}`)).toBe(true);
  });

  it('does not re-notify the same signal on the next refresh (e.g. 20 minutes later)', () => {
    const results = [makeResult('AAPL', [alert('bounce_support', 90)])];
    const first = computeNewSignals(results, new Set(), TODAY);

    // Simulate the next scheduled rescan seeing the exact same still-active signal.
    const second = computeNewSignals(results, first.nextSeen, TODAY);
    expect(second.newBuys).toEqual([]);
    expect(second.newSells).toEqual([]);
  });

  it('flags a genuinely new signal that appears on a later refresh without re-flagging the old one', () => {
    const first = computeNewSignals([makeResult('AAPL', [alert('bounce_support', 90)])], new Set(), TODAY);

    // Next rescan: AAPL is still bouncing off the same support, but MSFT newly breaks down too.
    const second = computeNewSignals(
      [makeResult('AAPL', [alert('bounce_support', 90)]), makeResult('MSFT', [alert('breakdown', 90)])],
      first.nextSeen,
      TODAY
    );
    expect(second.newBuys).toEqual([]);
    expect(second.newSells).toEqual(['MSFT']);
    expect(second.nextSeen.has(`AAPL-buy-${TODAY}`)).toBe(true);
    expect(second.nextSeen.has(`MSFT-sell-${TODAY}`)).toBe(true);
  });

  it('re-flags the same signal again once the date rolls over', () => {
    const first = computeNewSignals([makeResult('AAPL', [alert('bounce_support', 90)])], new Set(), TODAY);
    const nextDay = computeNewSignals([makeResult('AAPL', [alert('bounce_support', 90)])], first.nextSeen, TOMORROW);
    expect(nextDay.newBuys).toEqual(['AAPL']);
  });

  it('ignores WATCH-only results — only firm buy/sell calls trigger a notification', () => {
    const results = [makeResult('AAPL', [alert('approaching_support', 95)])];
    const { newBuys, newSells } = computeNewSignals(results, new Set(), TODAY);
    expect(newBuys).toEqual([]);
    expect(newSells).toEqual([]);
  });
});

describe('buildSignalNotificationBody', () => {
  it('formats a mix of buys and sells', () => {
    expect(buildSignalNotificationBody(['AAPL', 'MSFT'], ['TSLA'])).toBe('BUY: AAPL, MSFT   ·   SELL: TSLA');
  });

  it('truncates long lists with a "+N more" suffix', () => {
    const buys = Array.from({ length: 12 }, (_, i) => `SYM${i}`);
    const body = buildSignalNotificationBody(buys, []);
    expect(body).toContain('+2 more');
    expect(body.split(', ')).toHaveLength(10);
  });
});

describe('buildWeeklyDigestBody', () => {
  it('lists symbols currently sitting in an active channel', () => {
    const channel: Channel = {
      support: { price: 90, type: 'support', touches: [] },
      resistance: { price: 100, type: 'resistance', touches: [] },
      widthPct: 10,
      containmentPct: 90,
      status: 'active',
      lastTouchIndex: 0,
    };
    const body = buildWeeklyDigestBody([makeResult('AAPL', [], [channel])]);
    expect(body).toContain('AAPL');
    expect(body).toContain('bouncing in a channel');
  });

  it('says nothing is in a channel when nothing qualifies', () => {
    const body = buildWeeklyDigestBody([makeResult('AAPL', [])]);
    expect(body).toBe('No stocks are currently sitting in a clean channel.');
  });
});
