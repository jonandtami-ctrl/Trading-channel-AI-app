import {
  actualRiskReward,
  isOpen,
  plannedRiskReward,
  realizedPnlCAD,
  realizedPnlPct,
  SETUP_TYPE_LABELS,
  tradeResult,
  unrealizedPnlCAD,
  type Position,
  type SetupType,
} from './position';

/** Closed positions only, sorted most-recently-closed first — the basis for every stat below. */
function closedPositions(positions: Position[]): Position[] {
  return positions
    .filter((p) => !isOpen(p) && p.transactions.some((t) => t.type === 'sell'))
    .sort((a, b) => (closedTime(b) ?? 0) - (closedTime(a) ?? 0));
}

function closedTime(position: Position): number | null {
  const sells = position.transactions.filter((t) => t.type === 'sell');
  if (sells.length === 0) return null;
  return Math.max(...sells.map((t) => new Date(t.date).getTime()));
}

export interface OverviewStats {
  totalRealizedPnlCAD: number;
  openUnrealizedPnlCAD: number;
  tradeCount: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  averageWinCAD: number | null;
  averageLossCAD: number | null;
  bestTradeCAD: number | null;
  worstTradeCAD: number | null;
  averageReturnPct: number | null;
  /** Positive = current winning streak length, negative = current losing streak length, 0 = no closed trades or last was breakeven. */
  currentStreak: number;
  profitFactor: number | null;
  averageRiskReward: number | null;
  thisWeekPnlCAD: number;
  thisMonthPnlCAD: number;
  thisYearPnlCAD: number;
}

/**
 * The whole "simple performance dashboard" (see the journal spec) in one
 * pass over the closed positions — deliberately a flat, small set of
 * numbers rather than anything requiring its own chart to read.
 */
export function overviewStats(positions: Position[], latestPriceBySymbol: Record<string, number> = {}): OverviewStats {
  const closed = closedPositions(positions);
  const pnls = closed.map((p) => realizedPnlCAD(p) ?? 0);

  const wins = pnls.filter((p) => p > 0.005);
  const losses = pnls.filter((p) => p < -0.005);
  const breakevens = pnls.length - wins.length - losses.length;

  const totalRealizedPnlCAD = pnls.reduce((sum, p) => sum + p, 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : null;
  const averageWinCAD = wins.length > 0 ? wins.reduce((s, p) => s + p, 0) / wins.length : null;
  const averageLossCAD = losses.length > 0 ? losses.reduce((s, p) => s + p, 0) / losses.length : null;
  const bestTradeCAD = pnls.length > 0 ? Math.max(...pnls) : null;
  const worstTradeCAD = pnls.length > 0 ? Math.min(...pnls) : null;

  const returnPcts = closed.map((p) => realizedPnlPct(p)).filter((v): v is number => v != null);
  const averageReturnPct = returnPcts.length > 0 ? returnPcts.reduce((s, v) => s + v, 0) / returnPcts.length : null;

  const grossWinCAD = wins.reduce((s, p) => s + p, 0);
  const grossLossCAD = Math.abs(losses.reduce((s, p) => s + p, 0));
  const profitFactor = grossLossCAD > 0 ? grossWinCAD / grossLossCAD : null;

  const rrValues = closed.map((p) => actualRiskReward(p)).filter((v): v is number => v != null);
  const averageRiskReward = rrValues.length > 0 ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : null;

  const openUnrealizedPnlCAD = positions
    .filter(isOpen)
    .reduce((sum, p) => {
      const price = latestPriceBySymbol[p.symbol];
      return price != null ? sum + unrealizedPnlCAD(p, price) : sum;
    }, 0);

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const monthAgo = now - 30 * 86400000;
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime();
  const thisWeekPnlCAD = sumPnlSince(closed, weekAgo);
  const thisMonthPnlCAD = sumPnlSince(closed, monthAgo);
  const thisYearPnlCAD = sumPnlSince(closed, yearStart);

  return {
    totalRealizedPnlCAD,
    openUnrealizedPnlCAD,
    tradeCount: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakevens,
    winRate,
    averageWinCAD,
    averageLossCAD,
    bestTradeCAD,
    worstTradeCAD,
    averageReturnPct,
    currentStreak: currentStreak(closed),
    profitFactor,
    averageRiskReward,
    thisWeekPnlCAD,
    thisMonthPnlCAD,
    thisYearPnlCAD,
  };
}

function sumPnlSince(closedSortedDesc: Position[], sinceMs: number): number {
  return closedSortedDesc
    .filter((p) => (closedTime(p) ?? 0) >= sinceMs)
    .reduce((sum, p) => sum + (realizedPnlCAD(p) ?? 0), 0);
}

/** Positive length = current run of wins, negative = current run of losses, counting back from the most recent closed trade. */
function currentStreak(closedSortedDesc: Position[]): number {
  if (closedSortedDesc.length === 0) return 0;
  const first = tradeResult(closedSortedDesc[0]);
  if (first == null || first === 'breakeven') return 0;

  let streak = 0;
  for (const position of closedSortedDesc) {
    const result = tradeResult(position);
    if (result !== first) break;
    streak += 1;
  }
  return first === 'win' ? streak : -streak;
}

export interface StrategyStats {
  setupType: SetupType;
  label: string;
  trades: number;
  wins: number;
  winRate: number | null;
  averageReturnPct: number | null;
  netPnlCAD: number;
}

/** Performance broken out by setup type — see item G, "which strategy actually works." Only setup types with at least one closed trade are returned. */
export function strategyPerformance(positions: Position[]): StrategyStats[] {
  const closed = closedPositions(positions);
  const bySetup = new Map<SetupType, Position[]>();
  for (const p of closed) {
    if (!bySetup.has(p.setupType)) bySetup.set(p.setupType, []);
    bySetup.get(p.setupType)!.push(p);
  }

  return Array.from(bySetup.entries())
    .map(([setupType, group]) => {
      const wins = group.filter((p) => tradeResult(p) === 'win').length;
      const returnPcts = group.map((p) => realizedPnlPct(p)).filter((v): v is number => v != null);
      return {
        setupType,
        label: SETUP_TYPE_LABELS[setupType],
        trades: group.length,
        wins,
        winRate: group.length > 0 ? (wins / group.length) * 100 : null,
        averageReturnPct: returnPcts.length > 0 ? returnPcts.reduce((s, v) => s + v, 0) / returnPcts.length : null,
        netPnlCAD: group.reduce((sum, p) => sum + (realizedPnlCAD(p) ?? 0), 0),
      };
    })
    .sort((a, b) => b.netPnlCAD - a.netPnlCAD);
}

export interface YearlyTaxSummary {
  year: number;
  totalBuysCAD: number;
  totalSalesCAD: number;
  realizedGainsCAD: number;
  realizedLossesCAD: number;
  netRealizedCAD: number;
  feesCAD: number;
  transactionCount: number;
  cadTradeCount: number;
  usdTradeCount: number;
}

/**
 * Groups every transaction by the calendar year it happened in — buys and
 * sells alike, since "total buys"/"total sales" for the year both matter
 * for records even though only sells realize a gain/loss. See item I: this
 * is trading records for tax preparation, not a filed tax figure.
 */
export function taxSummaryByYear(positions: Position[]): YearlyTaxSummary[] {
  const byYear = new Map<number, YearlyTaxSummary>();

  function bucket(year: number): YearlyTaxSummary {
    if (!byYear.has(year)) {
      byYear.set(year, {
        year,
        totalBuysCAD: 0,
        totalSalesCAD: 0,
        realizedGainsCAD: 0,
        realizedLossesCAD: 0,
        netRealizedCAD: 0,
        feesCAD: 0,
        transactionCount: 0,
        cadTradeCount: 0,
        usdTradeCount: 0,
      });
    }
    return byYear.get(year)!;
  }

  for (const position of positions) {
    for (const t of position.transactions) {
      const year = new Date(t.date).getFullYear();
      const b = bucket(year);
      const grossCAD = t.price * t.shares * t.fxRate;
      b.transactionCount += 1;
      b.feesCAD += t.fee * t.fxRate;
      if (position.currency === 'CAD') b.cadTradeCount += 1;
      else b.usdTradeCount += 1;
      if (t.type === 'buy') b.totalBuysCAD += grossCAD;
      else b.totalSalesCAD += grossCAD;
    }
  }

  // Realized gains/losses are attributed to the year each SELL happened,
  // using the position's own average-cost engine so a sale spanning
  // shares bought across different years still nets out correctly.
  for (const position of positions) {
    const sells = position.transactions.filter((t) => t.type === 'sell');
    if (sells.length === 0) continue;
    const perSale = realizedPerSaleCAD(position);
    for (const { transaction, realizedCAD } of perSale) {
      const year = new Date(transaction.date).getFullYear();
      const b = bucket(year);
      b.netRealizedCAD += realizedCAD;
      if (realizedCAD >= 0) b.realizedGainsCAD += realizedCAD;
      else b.realizedLossesCAD += Math.abs(realizedCAD);
    }
  }

  return Array.from(byYear.values()).sort((a, b) => b.year - a.year);
}

function realizedPerSaleCAD(position: Position): Array<{ transaction: Position['transactions'][number]; realizedCAD: number }> {
  const sorted = [...position.transactions].sort((a, b) => a.date.localeCompare(b.date));
  let shares = 0;
  let totalCost = 0;
  const results: Array<{ transaction: Position['transactions'][number]; realizedCAD: number }> = [];

  for (const t of sorted) {
    if (t.type === 'buy') {
      shares += t.shares;
      totalCost += t.price * t.shares + t.fee;
      continue;
    }
    const avgCost = shares > 0 ? totalCost / shares : 0;
    const costRemoved = avgCost * t.shares;
    const proceeds = t.price * t.shares - t.fee;
    const realizedCAD = (proceeds - costRemoved) * t.fxRate;
    results.push({ transaction: t, realizedCAD });
    totalCost = Math.max(0, totalCost - costRemoved);
    shares = Math.max(0, shares - t.shares);
  }

  return results;
}

/**
 * One short, factual sentence about overall performance — deliberately a
 * small, fixed set of rule-based templates over the already-computed
 * stats, not a generated narrative. Returns null when there isn't enough
 * closed history yet to say anything meaningful.
 */
export function performanceObservation(stats: OverviewStats): string | null {
  if (stats.tradeCount < 3) return null;

  if (stats.winRate != null && stats.winRate < 45 && stats.averageLossCAD != null && stats.averageWinCAD != null) {
    if (Math.abs(stats.averageLossCAD) > stats.averageWinCAD * 1.3) {
      return 'Your win rate is low and your average loss is larger than your average win — that combination is hard to come back from.';
    }
  }

  if (stats.averageWinCAD != null && stats.averageLossCAD != null) {
    if (stats.averageWinCAD > Math.abs(stats.averageLossCAD) * 1.3) {
      return 'Your wins are larger than your losses. Good.';
    }
    if (Math.abs(stats.averageLossCAD) > stats.averageWinCAD * 1.3) {
      return 'Your win rate is decent, but your average loss is too large relative to your average win.';
    }
  }

  if (stats.winRate != null && stats.winRate >= 60) {
    return 'Your win rate is strong — keep following the same entry criteria.';
  }

  if (stats.currentStreak <= -3) {
    return `You're on a ${Math.abs(stats.currentStreak)}-trade losing streak — worth reviewing recent entries before the next one.`;
  }

  if (stats.profitFactor != null && stats.profitFactor < 1) {
    return 'Your losing trades are outweighing your winning trades overall.';
  }

  return null;
}

/**
 * A short, factual per-trade takeaway (see item O) — only ever built from
 * this specific trade's own stored data, never a fabricated reason. Falls
 * back to null when there's nothing recorded (no channel snapshot) worth
 * commenting on beyond the win/loss itself.
 */
export function tradeTakeaway(position: Position): string | null {
  const result = tradeResult(position);
  if (result == null) return null;
  const snapshot = position.channelSnapshot;
  if (!snapshot) return null;

  const nearBottom = snapshot.positionInChannelPct <= 25;

  if (result === 'win') {
    if (nearBottom && snapshot.positionInChannelPct <= 15) {
      return `Good channel entry. You bought in the bottom ${Math.round(snapshot.positionInChannelPct)}% of the range.`;
    }
    if (nearBottom) {
      return `Solid entry near support, in the bottom ${Math.round(snapshot.positionInChannelPct)}% of the channel.`;
    }
    return 'Entry was above the bottom third of the channel, but the trade still worked out.';
  }

  if (result === 'loss') {
    if (!nearBottom) {
      return 'Entry was above the bottom third of the channel and support later failed.';
    }
    if (snapshot.rsi != null && snapshot.rsi > 60) {
      return `Entered near support, but RSI was already at ${Math.round(snapshot.rsi)} — support failed anyway.`;
    }
    return 'Entered near support, but the level failed to hold.';
  }

  return null;
}
