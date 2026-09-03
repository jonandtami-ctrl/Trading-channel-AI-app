import { SETUP_TYPE_LABELS, isOpen, realizedPnlCAD, realizedPnlPct, tradeResult, type Position } from './position';
import { taxSummaryByYear, type YearlyTaxSummary } from './journalStats';

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(cells: Array<string | number>): string {
  return cells.map(csvCell).join(',');
}

/**
 * One row per transaction (buy or sell) — the full detailed record an
 * accountant needs (see item J): original currency amounts alongside the
 * CAD conversion used, never one overwriting the other.
 */
export function transactionsToCsv(positions: Position[]): string {
  const header = csvRow([
    'Ticker', 'Company', 'Exchange', 'Currency',
    'Type', 'Date', 'Price', 'Shares', 'Fee',
    'Gross Amount', 'FX Rate', 'CAD Value',
    'Strategy', 'Notes',
  ]);

  const rows: string[] = [];
  for (const p of positions) {
    const sorted = [...p.transactions].sort((a, b) => a.date.localeCompare(b.date));
    for (const t of sorted) {
      const gross = t.price * t.shares;
      rows.push(
        csvRow([
          p.symbol,
          p.name,
          p.exchange ?? '',
          p.currency,
          t.type === 'buy' ? 'BUY' : 'SELL',
          t.date,
          t.price.toFixed(4),
          t.shares,
          t.fee.toFixed(2),
          gross.toFixed(2),
          t.fxRate.toFixed(4),
          (gross * t.fxRate).toFixed(2),
          SETUP_TYPE_LABELS[p.setupType],
          p.notes,
        ])
      );
    }
  }
  return [header, ...rows].join('\n');
}

/** One row per closed position — matches item E's field list. */
export function closedTradesToCsv(positions: Position[]): string {
  const header = csvRow([
    'Ticker', 'Company', 'Exchange', 'Currency',
    'Entry Date', 'Exit Date', 'Entry Price', 'Exit Price', 'Shares',
    'Net P/L (CAD)', 'P/L %', 'Strategy', 'Result',
  ]);

  const rows = positions
    .filter((p) => !isOpen(p) && p.transactions.some((t) => t.type === 'sell'))
    .map((p) => {
      const buys = p.transactions.filter((t) => t.type === 'buy').sort((a, b) => a.date.localeCompare(b.date));
      const sells = p.transactions.filter((t) => t.type === 'sell').sort((a, b) => a.date.localeCompare(b.date));
      const shares = buys.reduce((n, t) => n + t.shares, 0);
      const result = tradeResult(p);
      return csvRow([
        p.symbol,
        p.name,
        p.exchange ?? '',
        p.currency,
        buys[0]?.date ?? '',
        sells[sells.length - 1]?.date ?? '',
        buys[0]?.price.toFixed(4) ?? '',
        sells[sells.length - 1]?.price.toFixed(4) ?? '',
        shares,
        (realizedPnlCAD(p) ?? 0).toFixed(2),
        (realizedPnlPct(p) ?? 0).toFixed(2),
        SETUP_TYPE_LABELS[p.setupType],
        result ? result.toUpperCase() : '',
      ]);
    });

  return [header, ...rows].join('\n');
}

/** One row per calendar year — see item I/J, meant to be handed straight to an accountant. */
export function yearlyTaxSummaryToCsv(positions: Position[]): string {
  const header = csvRow([
    'Year', 'Total Buys (CAD)', 'Total Sales (CAD)', 'Realized Gains (CAD)',
    'Realized Losses (CAD)', 'Net Realized P/L (CAD)', 'Fees (CAD)',
    'Transactions', 'CAD Trades', 'USD Trades',
  ]);
  const summaries: YearlyTaxSummary[] = taxSummaryByYear(positions);
  const rows = summaries.map((s) =>
    csvRow([
      s.year,
      s.totalBuysCAD.toFixed(2),
      s.totalSalesCAD.toFixed(2),
      s.realizedGainsCAD.toFixed(2),
      s.realizedLossesCAD.toFixed(2),
      s.netRealizedCAD.toFixed(2),
      s.feesCAD.toFixed(2),
      s.transactionCount,
      s.cadTradeCount,
      s.usdTradeCount,
    ])
  );
  return [header, ...rows].join('\n');
}
