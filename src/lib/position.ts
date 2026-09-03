import type { Trade } from './journal';
import { findSymbol } from './data/symbols';

export type Currency = 'CAD' | 'USD';
export type SetupType = 'channel_bounce' | 'support_reclaim' | 'breakout' | 'other';

export const SETUP_TYPE_LABELS: Record<SetupType, string> = {
  channel_bounce: 'Channel Bounce',
  support_reclaim: 'Support Reclaim',
  breakout: 'Breakout',
  other: 'Other',
};

// No live FX feed exists in this app — a new USD transaction is stamped
// with a reasonable default so nothing blocks a fast entry, and the rate
// stays fully editable afterward (see editTransaction in journalStorage.ts)
// for whenever the user wants to correct it to an official CRA rate.
export const DEFAULT_USD_CAD_RATE = 1.35;

export interface Transaction {
  id: string;
  type: 'buy' | 'sell';
  /** ISO timestamp, auto-stamped at entry. */
  date: string;
  /** In the position's trade currency — never overwritten when converting to CAD. */
  price: number;
  shares: number;
  /** Commission/fee for this fill, in the position's trade currency. */
  fee: number;
  /** CAD per 1 unit of trade currency. Always 1 for a CAD position. Editable after the fact. */
  fxRate: number;
}

/** Snapshot of the channel this position was opened against — captured once, at entry, from the scanner (see item H). Null for a manually-logged trade with no scanner context. */
export interface ChannelSnapshot {
  support: number;
  resistance: number;
  widthPct: number;
  positionInChannelPct: number;
  roomToResistancePct: number;
  channelAgeDays: number;
  supportTouches: number;
  resistanceTouches: number;
  rsi: number | null;
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  exchange?: string;
  currency: Currency;
  setupType: SetupType;
  notes: string;
  tags: string[];
  stopPrice: number | null;
  targetPrice: number | null;
  channelSnapshot: ChannelSnapshot | null;
  transactions: Transaction[];
}

/** Net shares currently held — 0 means the position is fully closed. */
export function sharesHeld(position: Position): number {
  return position.transactions.reduce((n, t) => n + (t.type === 'buy' ? t.shares : -t.shares), 0);
}

export function isOpen(position: Position): boolean {
  return sharesHeld(position) > 0.0000001;
}

/** First buy transaction's date — when the position was opened. */
export function openedAt(position: Position): string | null {
  const buys = position.transactions.filter((t) => t.type === 'buy').sort((a, b) => a.date.localeCompare(b.date));
  return buys[0]?.date ?? null;
}

/** Last transaction's date, of any type — most recent activity. */
export function lastActivityAt(position: Position): string | null {
  const sorted = [...position.transactions].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1]?.date ?? null;
}

/** Last sell transaction's date — when the position was (most recently) closed out of, fully or partially. */
export function closedAt(position: Position): string | null {
  const sells = position.transactions.filter((t) => t.type === 'sell').sort((a, b) => a.date.localeCompare(b.date));
  return sells[sells.length - 1]?.date ?? null;
}

interface CostBasisEvent {
  sellTransaction: Transaction;
  /** Average cost per share, in trade currency, of the shares this sale consumed. */
  avgCostPerShare: number;
  /** Realized gain/loss for this specific sale, in trade currency. */
  realizedTradeCurrency: number;
  /** Realized gain/loss for this specific sale, converted to CAD using this sale's own fxRate. */
  realizedCAD: number;
}

/**
 * Walks a position's transactions in date order and matches every sell
 * against the running average cost of shares held at that moment — the
 * same average-cost approach Canadian ACB tracking uses, so this is also
 * the natural place to eventually build a full ACB feature (see the
 * Position/Transaction model note in journalStorage.ts). Handles any
 * number of buys and any number of partial/full sells, in any order.
 */
function costBasisEvents(position: Position): CostBasisEvent[] {
  const sorted = [...position.transactions].sort((a, b) => a.date.localeCompare(b.date));
  const events: CostBasisEvent[] = [];

  let shares = 0;
  let totalCost = 0; // running cost basis (ACB), trade currency, fees included

  for (const t of sorted) {
    if (t.type === 'buy') {
      shares += t.shares;
      totalCost += t.price * t.shares + t.fee;
      continue;
    }

    const avgCostPerShare = shares > 0 ? totalCost / shares : 0;
    const costRemoved = avgCostPerShare * t.shares;
    const proceeds = t.price * t.shares - t.fee;
    const realizedTradeCurrency = proceeds - costRemoved;

    events.push({
      sellTransaction: t,
      avgCostPerShare,
      realizedTradeCurrency,
      realizedCAD: realizedTradeCurrency * t.fxRate,
    });

    shares = Math.max(0, shares - t.shares);
    totalCost = Math.max(0, totalCost - costRemoved);
  }

  return events;
}

/** Total realized P/L across every sell so far, in CAD. Null when nothing has been sold yet (still fully open). */
export function realizedPnlCAD(position: Position): number | null {
  const events = costBasisEvents(position);
  if (events.length === 0) return null;
  return events.reduce((sum, e) => sum + e.realizedCAD, 0);
}

/** Total realized P/L across every sell so far, in the position's own trade currency. */
export function realizedPnlTradeCurrency(position: Position): number | null {
  const events = costBasisEvents(position);
  if (events.length === 0) return null;
  return events.reduce((sum, e) => sum + e.realizedTradeCurrency, 0);
}

/** Realized P/L as a percent of what was actually put in for the shares sold. Null until something's been sold. */
export function realizedPnlPct(position: Position): number | null {
  const events = costBasisEvents(position);
  if (events.length === 0) return null;
  const costRemoved = events.reduce((sum, e) => sum + e.avgCostPerShare * e.sellTransaction.shares, 0);
  const pnl = events.reduce((sum, e) => sum + e.realizedTradeCurrency, 0);
  return costRemoved > 0 ? (pnl / costRemoved) * 100 : null;
}

/** Average cost per share of whatever's still held (0 once fully closed). */
export function averageCostPerShare(position: Position): number {
  const sorted = [...position.transactions].sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0;
  let totalCost = 0;
  for (const t of sorted) {
    if (t.type === 'buy') {
      shares += t.shares;
      totalCost += t.price * t.shares + t.fee;
    } else {
      const avg = shares > 0 ? totalCost / shares : 0;
      totalCost = Math.max(0, totalCost - avg * t.shares);
      shares = Math.max(0, shares - t.shares);
    }
  }
  return shares > 0 ? totalCost / shares : 0;
}

export function unrealizedPnlCAD(position: Position, currentPrice: number): number {
  const shares = sharesHeld(position);
  const avgCost = averageCostPerShare(position);
  const fxRate = position.transactions[position.transactions.length - 1]?.fxRate ?? 1;
  return (currentPrice - avgCost) * shares * fxRate;
}

export function unrealizedPnlPct(position: Position, currentPrice: number): number {
  const avgCost = averageCostPerShare(position);
  return avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;
}

export type TradeResult = 'win' | 'loss' | 'breakeven';

/** Classifies a CLOSED position's realized result. Never called on an open position — see item E: unrealized gains never count as a completed result. */
export function tradeResult(position: Position): TradeResult | null {
  if (isOpen(position)) return null;
  const pnl = realizedPnlCAD(position);
  if (pnl == null) return null;
  if (Math.abs(pnl) < 0.005) return 'breakeven';
  return pnl > 0 ? 'win' : 'loss';
}

/** Days between the position's first buy and its final sell. Null while still open. */
export function holdingPeriodDays(position: Position): number | null {
  if (isOpen(position)) return null;
  const opened = openedAt(position);
  const closed = closedAt(position);
  if (!opened || !closed) return null;
  return Math.max(0, Math.round((new Date(closed).getTime() - new Date(opened).getTime()) / 86400000));
}

/** Planned risk per share at entry (entry - stop), in trade currency. Null without a recorded stop. */
export function plannedRiskPerShare(position: Position): number | null {
  if (position.stopPrice == null) return null;
  const avgCost = averageCostPerShare(position) || firstBuyPrice(position);
  if (avgCost == null) return null;
  return avgCost - position.stopPrice;
}

function firstBuyPrice(position: Position): number | null {
  const buys = position.transactions.filter((t) => t.type === 'buy').sort((a, b) => a.date.localeCompare(b.date));
  return buys[0]?.price ?? null;
}

/** Planned reward per share at entry (target - entry), in trade currency. Null without a recorded target. */
export function plannedRewardPerShare(position: Position): number | null {
  if (position.targetPrice == null) return null;
  const entry = firstBuyPrice(position);
  if (entry == null) return null;
  return position.targetPrice - entry;
}

/** Planned risk/reward ratio at entry — reward per share divided by risk per share. Null unless both a stop and target were recorded. */
export function plannedRiskReward(position: Position): number | null {
  const risk = plannedRiskPerShare(position);
  const reward = plannedRewardPerShare(position);
  if (risk == null || reward == null || risk <= 0) return null;
  return reward / risk;
}

/** Actual risk/reward realized on a closed position — what was actually gained/lost per share against what was risked per share. Null unless a stop was recorded and the position is closed. */
export function actualRiskReward(position: Position): number | null {
  const risk = plannedRiskPerShare(position);
  if (risk == null || risk <= 0 || isOpen(position)) return null;
  const pnl = realizedPnlTradeCurrency(position);
  const shares = position.transactions.filter((t) => t.type === 'buy').reduce((n, t) => n + t.shares, 0);
  if (pnl == null || shares <= 0) return null;
  const pnlPerShare = pnl / shares;
  return pnlPerShare / risk;
}

/** Total amount actually invested across all buys, in trade currency (fees included). */
export function amountInvested(position: Position): number {
  return position.transactions.filter((t) => t.type === 'buy').reduce((sum, t) => sum + t.price * t.shares + t.fee, 0);
}

/** Year a position belongs to for grouping — a closed position groups by the year it was last sold (when the gain/loss was realized); an open one by the year it was opened. */
export function positionYear(position: Position): number {
  const date = closedAt(position) ?? openedAt(position) ?? new Date().toISOString();
  return new Date(date).getFullYear();
}

// --- Migration from the pre-Position flat Trade[] model ---------------

let legacyIdCounter = 0;

/**
 * Converts the original one-buy-one-sell Trade records into the
 * Position/Transaction model, preserving every value exactly — nothing
 * about existing journal history is discarded, just reshaped so it can
 * support partial fills going forward. Called once by
 * journalStorage.ts's loadPositions() the first time it finds no
 * Position data yet but the old Trade key still has entries.
 */
export function migrateLegacyTrades(trades: Trade[]): Position[] {
  return trades.map((t) => {
    const transactions: Transaction[] = [
      { id: `legacy-buy-${legacyIdCounter++}`, type: 'buy', date: t.entryDate, price: t.entryPrice, shares: t.quantity, fee: 0, fxRate: 1 },
    ];
    if (t.status === 'closed' && t.exitPrice != null && t.exitDate != null) {
      transactions.push({
        id: `legacy-sell-${legacyIdCounter++}`,
        type: 'sell',
        date: t.exitDate,
        price: t.exitPrice,
        shares: t.quantity,
        fee: 0,
        fxRate: 1,
      });
    }
    const info = findSymbol(t.symbol);
    return {
      id: t.id,
      symbol: t.symbol,
      name: info?.name ?? t.symbol,
      exchange: info?.exchange,
      currency: info?.exchange === 'TSX' ? 'CAD' : 'USD',
      setupType: 'other',
      notes: '',
      tags: [],
      stopPrice: null,
      targetPrice: null,
      channelSnapshot: null,
      transactions,
    };
  });
}
