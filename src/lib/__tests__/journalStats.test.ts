import { describe, expect, it } from 'vitest';
import { overviewStats, strategyPerformance, taxSummaryByYear } from '../journalStats';
import type { Position, Transaction } from '../position';

const day = (year: number, n: number) => new Date(year, 0, 1 + n).toISOString();

function txn(overrides: Partial<Transaction>): Transaction {
  return { id: `t${Math.random()}`, type: 'buy', date: day(2026, 0), price: 100, shares: 10, fee: 0, fxRate: 1, ...overrides };
}

function position(overrides: Partial<Position>): Position {
  return {
    id: `p${Math.random()}`,
    symbol: 'TEST',
    name: 'Test Co.',
    currency: 'USD',
    setupType: 'channel_bounce',
    notes: '',
    tags: [],
    stopPrice: null,
    targetPrice: null,
    channelSnapshot: null,
    transactions: [],
    ...overrides,
  };
}

describe('overviewStats — correct win-rate and net P/L across several trades', () => {
  it('matches a hand-computed win rate and total realized P/L', () => {
    const positions: Position[] = [
      // Win: +$100
      position({
        symbol: 'A',
        transactions: [txn({ type: 'buy', date: day(2026, 0), price: 100, shares: 10 }), txn({ type: 'sell', date: day(2026, 1), price: 110, shares: 10 })],
      }),
      // Win: +$50
      position({
        symbol: 'B',
        transactions: [txn({ type: 'buy', date: day(2026, 2), price: 50, shares: 10 }), txn({ type: 'sell', date: day(2026, 3), price: 55, shares: 10 })],
      }),
      // Loss: -$60
      position({
        symbol: 'C',
        transactions: [txn({ type: 'buy', date: day(2026, 4), price: 80, shares: 10 }), txn({ type: 'sell', date: day(2026, 5), price: 74, shares: 10 })],
      }),
      // Still open — must not count as a completed trade.
      position({ symbol: 'D', transactions: [txn({ type: 'buy', date: day(2026, 6), price: 200, shares: 5 })] }),
    ];

    const stats = overviewStats(positions);
    expect(stats.tradeCount).toBe(3);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(1);
    expect(stats.winRate).toBeCloseTo((2 / 3) * 100, 5);
    expect(stats.totalRealizedPnlCAD).toBeCloseTo(100 + 50 - 60, 5);
    expect(stats.averageWinCAD).toBeCloseTo((100 + 50) / 2, 5);
    expect(stats.averageLossCAD).toBeCloseTo(-60, 5);
    expect(stats.bestTradeCAD).toBeCloseTo(100, 5);
    expect(stats.worstTradeCAD).toBeCloseTo(-60, 5);
  });

  it('computes profit factor as gross winning dollars over gross losing dollars', () => {
    const positions: Position[] = [
      position({ symbol: 'A', transactions: [txn({ type: 'buy', price: 100, shares: 1 }), txn({ type: 'sell', price: 140, shares: 1 })] }), // +40
      position({ symbol: 'B', transactions: [txn({ type: 'buy', price: 100, shares: 1 }), txn({ type: 'sell', price: 90, shares: 1 })] }), // -10
    ];
    expect(overviewStats(positions).profitFactor).toBeCloseTo(40 / 10, 5);
  });

  it('tracks a losing streak as a negative streak count', () => {
    const positions: Position[] = [
      position({ symbol: 'A', transactions: [txn({ type: 'buy', date: day(2026, 0), price: 100, shares: 1 }), txn({ type: 'sell', date: day(2026, 1), price: 90, shares: 1 })] }),
      position({ symbol: 'B', transactions: [txn({ type: 'buy', date: day(2026, 2), price: 100, shares: 1 }), txn({ type: 'sell', date: day(2026, 3), price: 80, shares: 1 })] }),
    ];
    expect(overviewStats(positions).currentStreak).toBe(-2);
  });
});

describe('strategyPerformance', () => {
  it('groups net P/L and win rate by setup type', () => {
    const positions: Position[] = [
      position({
        symbol: 'A',
        setupType: 'channel_bounce',
        transactions: [txn({ type: 'buy', price: 100, shares: 1 }), txn({ type: 'sell', price: 110, shares: 1 })],
      }),
      position({
        symbol: 'B',
        setupType: 'breakout',
        transactions: [txn({ type: 'buy', price: 100, shares: 1 }), txn({ type: 'sell', price: 95, shares: 1 })],
      }),
    ];
    const perf = strategyPerformance(positions);
    const bounce = perf.find((p) => p.setupType === 'channel_bounce')!;
    const breakout = perf.find((p) => p.setupType === 'breakout')!;
    expect(bounce.trades).toBe(1);
    expect(bounce.winRate).toBe(100);
    expect(breakout.winRate).toBe(0);
    expect(breakout.netPnlCAD).toBeCloseTo(-5, 5);
  });
});

describe('taxSummaryByYear', () => {
  it('groups totals by the calendar year each transaction happened, attributing realized gains to the sale year', () => {
    const positions: Position[] = [
      position({
        symbol: 'A',
        currency: 'CAD',
        transactions: [
          txn({ type: 'buy', date: day(2025, 300), price: 100, shares: 10, fxRate: 1 }), // bought in 2025
          txn({ type: 'sell', date: day(2026, 5), price: 120, shares: 10, fxRate: 1 }), // sold in 2026
        ],
      }),
      position({
        symbol: 'B',
        currency: 'USD',
        transactions: [
          txn({ type: 'buy', date: day(2026, 10), price: 50, shares: 4, fee: 2, fxRate: 1.35 }),
          txn({ type: 'sell', date: day(2026, 20), price: 40, shares: 4, fee: 2, fxRate: 1.35 }),
        ],
      }),
    ];

    const summaries = taxSummaryByYear(positions);
    const y2025 = summaries.find((s) => s.year === 2025)!;
    const y2026 = summaries.find((s) => s.year === 2026)!;

    // 2025 only has the buy of position A — no sale, so no realized gain/loss that year.
    expect(y2025.totalBuysCAD).toBeCloseTo(1000, 5);
    expect(y2025.totalSalesCAD).toBe(0);
    expect(y2025.netRealizedCAD).toBe(0);

    // 2026 has position A's sale (realized +$200 CAD) and both legs of position B (realized loss in USD*1.35).
    expect(y2026.realizedGainsCAD).toBeCloseTo(200, 5);
    const bLossCAD = (40 * 4 - 2 - (50 * 4 + 2)) * 1.35;
    expect(y2026.realizedLossesCAD).toBeCloseTo(Math.abs(bLossCAD), 5);
    expect(y2026.cadTradeCount).toBe(1); // position A's sell only (its buy fell in 2025)
    expect(y2026.usdTradeCount).toBe(2); // position B's buy + sell
  });
});
