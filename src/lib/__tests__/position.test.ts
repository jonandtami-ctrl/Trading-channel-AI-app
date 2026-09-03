import { describe, expect, it } from 'vitest';
import {
  actualRiskReward,
  amountInvested,
  averageCostPerShare,
  holdingPeriodDays,
  isOpen,
  migrateLegacyTrades,
  plannedRiskReward,
  realizedPnlCAD,
  realizedPnlPct,
  sharesHeld,
  tradeResult,
  unrealizedPnlCAD,
  type Position,
  type Transaction,
} from '../position';
import type { Trade } from '../journal';

const day = (n: number) => new Date(2026, 0, 1 + n).toISOString();

function txn(overrides: Partial<Transaction>): Transaction {
  return { id: `t${Math.random()}`, type: 'buy', date: day(0), price: 100, shares: 10, fee: 0, fxRate: 1, ...overrides };
}

function position(overrides: Partial<Position>): Position {
  return {
    id: 'p1',
    symbol: 'ZTS',
    name: 'Zoetis Inc.',
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

describe('a normal completed winning trade', () => {
  it('computes gross/net P/L, P/L %, and a WIN result', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 75.2, shares: 20, fee: 0, fxRate: 1 }),
        txn({ type: 'sell', date: day(2), price: 77.31, shares: 20, fee: 0, fxRate: 1 }),
      ],
    });
    expect(isOpen(p)).toBe(false);
    expect(realizedPnlCAD(p)).toBeCloseTo((77.31 - 75.2) * 20, 5);
    expect(realizedPnlPct(p)).toBeCloseTo(((77.31 - 75.2) / 75.2) * 100, 5);
    expect(tradeResult(p)).toBe('win');
    expect(holdingPeriodDays(p)).toBe(2);
  });
});

describe('a losing trade', () => {
  it('computes a negative net P/L and a LOSS result', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 50, shares: 10 }),
        txn({ type: 'sell', date: day(1), price: 45, shares: 10 }),
      ],
    });
    expect(realizedPnlCAD(p)).toBeCloseTo(-50, 5);
    expect(tradeResult(p)).toBe('loss');
  });
});

describe('a breakeven trade', () => {
  it('is neither a win nor a loss', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 50, shares: 10 }),
        txn({ type: 'sell', date: day(1), price: 50, shares: 10 }),
      ],
    });
    expect(tradeResult(p)).toBe('breakeven');
  });
});

describe('a USD trade converted to CAD', () => {
  it('preserves both the original USD P/L and the converted CAD P/L, never overwriting one with the other', () => {
    const p = position({
      currency: 'USD',
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 10, fxRate: 1.35 }),
        txn({ type: 'sell', date: day(1), price: 110, shares: 10, fxRate: 1.38 }),
      ],
    });
    // USD P/L per share is (110-100)*10 = $100 USD, but realizedPnlCAD applies
    // the SALE's own fxRate to that USD gain (the standard "translate the
    // gain at the rate in effect when it was realized" approach), not the
    // buy's rate — so it should NOT simply be 100 * 1.35 or 100 * 1.38 by coincidence.
    const pnlCAD = realizedPnlCAD(p)!;
    expect(pnlCAD).toBeCloseTo(100 * 1.38, 5);
    // The transactions themselves still carry the untouched original USD price/shares.
    expect(p.transactions[0].price).toBe(100);
    expect(p.transactions[1].price).toBe(110);
  });
});

describe('commissions/fees', () => {
  it('reduces net P/L by both the buy and sell fee', () => {
    const withoutFees = position({
      transactions: [txn({ type: 'buy', date: day(0), price: 100, shares: 10, fee: 0 }), txn({ type: 'sell', date: day(1), price: 110, shares: 10, fee: 0 })],
    });
    const withFees = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 10, fee: 5 }),
        txn({ type: 'sell', date: day(1), price: 110, shares: 10, fee: 5 }),
      ],
    });
    expect(realizedPnlCAD(withFees)!).toBeCloseTo(realizedPnlCAD(withoutFees)! - 10, 5);
  });

  it('counts fees in the total amount invested', () => {
    const p = position({ transactions: [txn({ type: 'buy', date: day(0), price: 100, shares: 10, fee: 9.99 })] });
    expect(amountInvested(p)).toBeCloseTo(1009.99, 5);
  });
});

describe('multiple purchases (adding to a position)', () => {
  it('averages the cost basis across both buys', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 10 }),
        txn({ type: 'buy', date: day(1), price: 120, shares: 10 }),
      ],
    });
    expect(sharesHeld(p)).toBe(20);
    expect(averageCostPerShare(p)).toBeCloseTo(110, 5);
  });
});

describe('partial sale', () => {
  it('leaves the position open with reduced shares and only realizes P/L on the sold portion', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 20 }),
        txn({ type: 'sell', date: day(1), price: 110, shares: 8 }),
      ],
    });
    expect(isOpen(p)).toBe(true);
    expect(sharesHeld(p)).toBe(12);
    expect(realizedPnlCAD(p)).toBeCloseTo((110 - 100) * 8, 5);
    // The remaining 12 shares are still costed at the original $100 average.
    expect(averageCostPerShare(p)).toBeCloseTo(100, 5);
  });
});

describe('multiple exits (selling a position across several transactions)', () => {
  it('sums realized P/L across every sale and closes once all shares are gone', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 30 }),
        txn({ type: 'sell', date: day(1), price: 105, shares: 10 }),
        txn({ type: 'sell', date: day(3), price: 95, shares: 10 }),
        txn({ type: 'sell', date: day(5), price: 115, shares: 10 }),
      ],
    });
    expect(isOpen(p)).toBe(false);
    const expected = (105 - 100) * 10 + (95 - 100) * 10 + (115 - 100) * 10;
    expect(realizedPnlCAD(p)).toBeCloseTo(expected, 5);
    expect(holdingPeriodDays(p)).toBe(5); // first buy (day 0) to LAST sell (day 5)
  });

  it('averages the cost basis correctly when a buy happens between two sells', () => {
    const p = position({
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 10 }),
        txn({ type: 'sell', date: day(1), price: 120, shares: 5 }), // realize (120-100)*5 = 100
        txn({ type: 'buy', date: day(2), price: 140, shares: 5 }), // now holding 5@100 + 5@140 => avg 120
        txn({ type: 'sell', date: day(3), price: 130, shares: 10 }), // realize (130-120)*10 = 100
      ],
    });
    expect(realizedPnlCAD(p)).toBeCloseTo(100 + 100, 5);
    expect(isOpen(p)).toBe(false);
  });
});

describe('planned vs actual risk/reward', () => {
  it('computes a planned risk/reward ratio from the stop/target recorded at entry', () => {
    const p = position({
      stopPrice: 95,
      targetPrice: 115,
      transactions: [txn({ type: 'buy', date: day(0), price: 100, shares: 10 })],
    });
    // risk = 100-95 = 5, reward = 115-100 = 15 -> R:R = 3
    expect(plannedRiskReward(p)).toBeCloseTo(3, 5);
  });

  it('computes the actual risk/reward realized once closed', () => {
    const p = position({
      stopPrice: 95,
      transactions: [
        txn({ type: 'buy', date: day(0), price: 100, shares: 10 }),
        txn({ type: 'sell', date: day(1), price: 110, shares: 10 }),
      ],
    });
    // risk/share = 5, realized/share = 10 -> actual R:R = 2
    expect(actualRiskReward(p)).toBeCloseTo(2, 5);
  });
});

describe('unrealized P/L on an open position', () => {
  it('is never counted toward a completed trade result', () => {
    const p = position({ transactions: [txn({ type: 'buy', date: day(0), price: 100, shares: 10 })] });
    expect(unrealizedPnlCAD(p, 120)).toBeCloseTo(200, 5);
    expect(tradeResult(p)).toBeNull();
    expect(realizedPnlCAD(p)).toBeNull();
  });
});

describe('migrateLegacyTrades', () => {
  it('preserves an open legacy trade as an open position with one buy transaction', () => {
    const legacy: Trade[] = [{ id: 'old1', symbol: 'AAPL', entryDate: day(0), entryPrice: 150, quantity: 5, status: 'open' }];
    const [migrated] = migrateLegacyTrades(legacy);
    expect(migrated.symbol).toBe('AAPL');
    expect(isOpen(migrated)).toBe(true);
    expect(sharesHeld(migrated)).toBe(5);
  });

  it('preserves a closed legacy trade as a closed position with matching realized P/L', () => {
    const legacy: Trade[] = [
      { id: 'old2', symbol: 'MSFT', entryDate: day(0), entryPrice: 300, quantity: 2, exitDate: day(5), exitPrice: 320, status: 'closed' },
    ];
    const [migrated] = migrateLegacyTrades(legacy);
    expect(isOpen(migrated)).toBe(false);
    expect(realizedPnlCAD(migrated)).toBeCloseTo((320 - 300) * 2, 5);
  });

  it('assigns CAD currency to a TSX legacy symbol and USD to everything else', () => {
    const legacy: Trade[] = [
      { id: 'a', symbol: 'RY.TO', entryDate: day(0), entryPrice: 100, quantity: 1, status: 'open' },
      { id: 'b', symbol: 'AAPL', entryDate: day(0), entryPrice: 100, quantity: 1, status: 'open' },
    ];
    const [ry, aapl] = migrateLegacyTrades(legacy);
    expect(ry.currency).toBe('CAD');
    expect(aapl.currency).toBe('USD');
  });
});
