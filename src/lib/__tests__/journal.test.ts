import { describe, expect, it } from 'vitest';
import {
  realizedPnl,
  realizedPnlPct,
  unrealizedPnl,
  unrealizedPnlPct,
  tradeYear,
  groupTradesByYear,
  tradesToCsv,
  type Trade,
} from '../journal';

function makeTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    symbol: 'AAPL',
    entryDate: '2026-03-01T00:00:00.000Z',
    entryPrice: 100,
    quantity: 10,
    status: 'open',
    ...overrides,
  };
}

describe('realizedPnl / realizedPnlPct', () => {
  it('returns null for an open trade', () => {
    const trade = makeTrade();
    expect(realizedPnl(trade)).toBeNull();
    expect(realizedPnlPct(trade)).toBeNull();
  });

  it('computes gain for a closed trade', () => {
    const trade = makeTrade({ status: 'closed', exitPrice: 110, exitDate: '2026-04-01T00:00:00.000Z' });
    expect(realizedPnl(trade)).toBeCloseTo(100, 5); // (110-100)*10
    expect(realizedPnlPct(trade)).toBeCloseTo(10, 5);
  });

  it('computes a loss correctly', () => {
    const trade = makeTrade({ status: 'closed', exitPrice: 90, exitDate: '2026-04-01T00:00:00.000Z' });
    expect(realizedPnl(trade)).toBeCloseTo(-100, 5);
  });
});

describe('unrealizedPnl', () => {
  it('computes gain/loss against a live price regardless of status', () => {
    const trade = makeTrade({ entryPrice: 50, quantity: 4 });
    expect(unrealizedPnl(trade, 60)).toBeCloseTo(40, 5);
  });
});

describe('unrealizedPnlPct', () => {
  it('computes the percentage move from entry to the live price', () => {
    const trade = makeTrade({ entryPrice: 74.38, quantity: 1 });
    expect(unrealizedPnlPct(trade, 80)).toBeCloseTo(7.556, 2);
  });

  it('is negative when the live price is below entry', () => {
    const trade = makeTrade({ entryPrice: 100, quantity: 1 });
    expect(unrealizedPnlPct(trade, 90)).toBeCloseTo(-10, 5);
  });
});

describe('tradeYear', () => {
  it('uses exit year for closed trades', () => {
    const trade = makeTrade({ status: 'closed', exitDate: '2027-01-05T00:00:00.000Z', exitPrice: 100 });
    expect(tradeYear(trade)).toBe(2027);
  });

  it('uses entry year for open trades', () => {
    expect(tradeYear(makeTrade({ entryDate: '2026-06-01T00:00:00.000Z' }))).toBe(2026);
  });
});

describe('groupTradesByYear', () => {
  it('groups trades by year, newest year first, with a realized total per year', () => {
    const trades: Trade[] = [
      makeTrade({ id: 'a', entryDate: '2026-01-01T00:00:00.000Z', status: 'closed', exitDate: '2026-02-01T00:00:00.000Z', exitPrice: 120 }),
      makeTrade({ id: 'b', entryDate: '2027-01-01T00:00:00.000Z' }),
    ];
    const grouped = groupTradesByYear(trades);
    expect(grouped.map((g) => g.year)).toEqual([2027, 2026]);
    expect(grouped.find((g) => g.year === 2026)?.realizedTotal).toBeCloseTo(200, 5); // (120-100)*10
    expect(grouped.find((g) => g.year === 2027)?.realizedTotal).toBe(0); // still open
  });
});

describe('tradesToCsv', () => {
  it('includes a header row and one row per trade', () => {
    const trades: Trade[] = [makeTrade({ status: 'closed', exitPrice: 105, exitDate: '2026-04-01T00:00:00.000Z' })];
    const csv = tradesToCsv(trades);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Symbol');
    expect(lines[1]).toContain('AAPL');
    expect(lines[1]).toContain('closed');
  });

  it('produces just a header for an empty trade list', () => {
    expect(tradesToCsv([]).split('\n')).toHaveLength(1);
  });
});
