export interface Trade {
  id: string;
  symbol: string;
  entryDate: string; // ISO timestamp, auto-stamped when logged
  entryPrice: number;
  quantity: number;
  exitDate?: string; // ISO timestamp, auto-stamped when closed
  exitPrice?: number;
  status: 'open' | 'closed';
}

export function realizedPnl(trade: Trade): number | null {
  if (trade.status !== 'closed' || trade.exitPrice == null) return null;
  return (trade.exitPrice - trade.entryPrice) * trade.quantity;
}

export function realizedPnlPct(trade: Trade): number | null {
  if (trade.status !== 'closed' || trade.exitPrice == null) return null;
  return ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
}

export function unrealizedPnl(trade: Trade, currentPrice: number): number {
  return (currentPrice - trade.entryPrice) * trade.quantity;
}

export function unrealizedPnlPct(trade: Trade, currentPrice: number): number {
  return ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
}

/** Year a trade belongs to for grouping — closed trades group by exit year (when the gain/loss was realized), open trades by entry year. */
export function tradeYear(trade: Trade): number {
  return new Date(trade.exitDate ?? trade.entryDate).getFullYear();
}

export function groupTradesByYear(trades: Trade[]): Array<{ year: number; trades: Trade[]; realizedTotal: number }> {
  const byYear = new Map<number, Trade[]>();
  for (const trade of trades) {
    const year = tradeYear(trade);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(trade);
  }

  return Array.from(byYear.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, yearTrades]) => ({
      year,
      trades: yearTrades.sort((a, b) => new Date(b.entryDate).getTime() - new Date(a.entryDate).getTime()),
      realizedTotal: yearTrades.reduce((sum, t) => sum + (realizedPnl(t) ?? 0), 0),
    }));
}

/** Builds a CSV suitable for a tax record — one row per trade, realized trades show gain/loss. */
export function tradesToCsv(trades: Trade[]): string {
  const header = 'Symbol,Status,Entry Date,Entry Price,Quantity,Exit Date,Exit Price,Realized P&L,Realized P&L %';
  const rows = trades.map((t) => {
    const pnl = realizedPnl(t);
    const pnlPct = realizedPnlPct(t);
    return [
      t.symbol,
      t.status,
      t.entryDate,
      t.entryPrice.toFixed(4),
      t.quantity,
      t.exitDate ?? '',
      t.exitPrice != null ? t.exitPrice.toFixed(4) : '',
      pnl != null ? pnl.toFixed(2) : '',
      pnlPct != null ? pnlPct.toFixed(2) : '',
    ].join(',');
  });
  return [header, ...rows].join('\n');
}
