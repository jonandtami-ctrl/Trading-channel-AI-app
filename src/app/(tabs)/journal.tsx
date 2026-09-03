import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  averageCostPerShare,
  closedAt,
  holdingPeriodDays,
  isOpen,
  openedAt,
  realizedPnlCAD,
  realizedPnlPct,
  sharesHeld,
  SETUP_TYPE_LABELS,
  tradeResult,
  unrealizedPnlCAD,
  unrealizedPnlPct,
  type Position,
  type TradeResult,
} from '../../lib/position';
import {
  overviewStats,
  performanceObservation,
  strategyPerformance,
  taxSummaryByYear,
  tradeTakeaway,
} from '../../lib/journalStats';
import {
  deletePosition,
  exportAllTransactionsCsv,
  exportBackupJson,
  exportClosedTradesCsv,
  exportYearlyTaxSummaryCsv,
  loadPositions,
} from '../../lib/journalStorage';
import { formatPrice } from '../../lib/format';
import { findSymbol } from '../../lib/data/symbols';
import { useScanData } from '../../hooks/ScanDataProvider';
import { EquityCurve } from '../../components/EquityCurve';
import { SymbolSearch } from '../../components/SymbolSearch';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

type JournalTab = 'overview' | 'open' | 'closed' | 'taxes';
const TABS: Array<{ key: JournalTab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'overview', label: 'Overview', icon: 'stats-chart' },
  { key: 'open', label: 'Open', icon: 'radio-button-on' },
  { key: 'closed', label: 'Closed', icon: 'checkmark-circle' },
  { key: 'taxes', label: 'Taxes', icon: 'document-text' },
];

function cad(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function priceKindFor(symbol: string): 'stock' | 'crypto' {
  return findSymbol(symbol)?.kind === 'stock' ? 'stock' : 'crypto';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function JournalScreen() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<JournalTab>('overview');
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const { crypto, stocks } = useScanData();

  const latestBySymbol: Record<string, number> = {};
  for (const r of [...Object.values(crypto.results), ...Object.values(stocks.results)]) {
    const last = r.candles[r.candles.length - 1];
    if (last) latestBySymbol[r.symbol] = last.close;
  }

  useFocusEffect(
    useCallback(() => {
      loadPositions().then((p) => {
        setPositions(p);
        setLoaded(true);
      });
    }, [])
  );

  async function handleDelete(id: string) {
    Alert.alert('Delete this position?', 'This removes it and every buy/sell recorded against it, permanently.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => setPositions(await deletePosition(id)) },
    ]);
  }

  const openCount = positions.filter(isOpen).length;
  const closedCount = positions.filter((p) => !isOpen(p) && p.transactions.some((t) => t.type === 'sell')).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <View style={styles.titleIcon}>
              <Ionicons name="book" size={18} color={colors.accent} />
            </View>
            <Text style={styles.title}>Trade Journal</Text>
          </View>
          <Pressable style={styles.addTradeButton} onPress={() => setAddTradeOpen((v) => !v)}>
            <Ionicons name={addTradeOpen ? 'close' : 'add'} size={15} color="#fff" />
            <Text style={styles.addTradeText}>{addTradeOpen ? 'Cancel' : 'Add Trade'}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          {openCount} open · {closedCount} closed
        </Text>
        {addTradeOpen && (
          <View style={styles.addTradeSearch}>
            <Text style={styles.addTradeHint}>Search a symbol to buy — you'll land on its page to enter price/shares/stop/target.</Text>
            <SymbolSearch />
          </View>
        )}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.key} style={[styles.tabButton, tab === t.key && styles.tabButtonActive]} onPress={() => setTab(t.key)}>
            <Ionicons name={t.icon} size={14} color={tab === t.key ? colors.accent : colors.textDim} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!loaded ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Loading…</Text>
          </View>
        ) : positions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={22} color={colors.textDim} />
            <Text style={styles.emptyText}>No trades logged yet. Open any symbol and tap &quot;Buy&quot; to start your record.</Text>
          </View>
        ) : tab === 'overview' ? (
          <OverviewTab positions={positions} latestBySymbol={latestBySymbol} />
        ) : tab === 'open' ? (
          <OpenTab positions={positions} latestBySymbol={latestBySymbol} />
        ) : tab === 'closed' ? (
          <ClosedTab positions={positions} onDelete={handleDelete} />
        ) : (
          <TaxesTab positions={positions} />
        )}
      </ScrollView>
    </View>
  );
}

// --- OVERVIEW ------------------------------------------------------------

function OverviewTab({ positions, latestBySymbol }: { positions: Position[]; latestBySymbol: Record<string, number> }) {
  const stats = overviewStats(positions, latestBySymbol);
  const strategy = strategyPerformance(positions);
  const observation = performanceObservation(stats);

  const closedChronological = useMemo(
    () =>
      positions
        .filter((p) => !isOpen(p) && p.transactions.some((t) => t.type === 'sell'))
        .sort((a, b) => (closedAt(a) ?? '').localeCompare(closedAt(b) ?? '')),
    [positions]
  );
  const cumulative = useMemo(() => {
    let running = 0;
    return closedChronological.map((p) => (running += realizedPnlCAD(p) ?? 0));
  }, [closedChronological]);

  if (stats.tradeCount === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="hourglass-outline" size={20} color={colors.textDim} />
        <Text style={styles.emptyText}>No closed trades yet — stats show up once you've sold something.</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.bigStatCard}>
        <Text style={styles.bigStatLabel}>Total Realized Profit/Loss</Text>
        <Text style={[styles.bigStatValue, { color: stats.totalRealizedPnlCAD >= 0 ? colors.green : colors.red }]}>
          {cad(stats.totalRealizedPnlCAD)}
        </Text>
        {stats.openUnrealizedPnlCAD !== 0 && (
          <Text style={styles.bigStatSub}>
            {cad(stats.openUnrealizedPnlCAD)} unrealized on open positions
          </Text>
        )}
      </View>

      {cumulative.length >= 2 && <EquityCurve cumulativeValues={cumulative} />}

      <View style={styles.statGrid}>
        <StatTile label="Win Rate" value={stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '—'} />
        <StatTile label="Trades" value={String(stats.tradeCount)} />
        <StatTile label="Wins" value={String(stats.wins)} color={colors.green} />
        <StatTile label="Losses" value={String(stats.losses)} color={colors.red} />
        <StatTile label="Average Win" value={stats.averageWinCAD != null ? cad(stats.averageWinCAD) : '—'} color={colors.green} />
        <StatTile label="Average Loss" value={stats.averageLossCAD != null ? cad(stats.averageLossCAD) : '—'} color={colors.red} />
        <StatTile label="Best Trade" value={stats.bestTradeCAD != null ? cad(stats.bestTradeCAD) : '—'} color={colors.green} />
        <StatTile label="Worst Trade" value={stats.worstTradeCAD != null ? cad(stats.worstTradeCAD) : '—'} color={colors.red} />
        <StatTile label="Avg % Return" value={stats.averageReturnPct != null ? `${stats.averageReturnPct >= 0 ? '+' : ''}${stats.averageReturnPct.toFixed(1)}%` : '—'} />
        <StatTile
          label="Streak"
          value={stats.currentStreak === 0 ? '—' : `${Math.abs(stats.currentStreak)} ${stats.currentStreak > 0 ? 'win' : 'loss'}${Math.abs(stats.currentStreak) === 1 ? '' : 'es'}`}
          color={stats.currentStreak > 0 ? colors.green : stats.currentStreak < 0 ? colors.red : undefined}
        />
        <StatTile label="Profit Factor" value={stats.profitFactor != null ? stats.profitFactor.toFixed(2) : '—'} />
        <StatTile label="Avg Risk/Reward" value={stats.averageRiskReward != null ? `1 : ${stats.averageRiskReward.toFixed(1)}` : '—'} />
      </View>

      <View style={styles.periodRow}>
        <PeriodTile label="This Week" value={stats.thisWeekPnlCAD} />
        <PeriodTile label="This Month" value={stats.thisMonthPnlCAD} />
        <PeriodTile label="This Year" value={stats.thisYearPnlCAD} />
      </View>

      {observation && (
        <View style={styles.observationBox}>
          <Ionicons name="bulb-outline" size={14} color={colors.accent} />
          <Text style={styles.observationText}>{observation}</Text>
        </View>
      )}

      {strategy.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Strategy Performance</Text>
          {strategy.map((s) => (
            <View key={s.setupType} style={styles.strategyCard}>
              <View style={styles.strategyTop}>
                <Text style={styles.strategyLabel}>{s.label.toUpperCase()}</Text>
                <Text style={[styles.strategyPnl, { color: s.netPnlCAD >= 0 ? colors.green : colors.red }]}>{cad(s.netPnlCAD)}</Text>
              </View>
              <Text style={styles.strategyDetail}>
                Trades: {s.trades} · Win Rate: {s.winRate != null ? `${s.winRate.toFixed(0)}%` : '—'} · Avg Return:{' '}
                {s.averageReturnPct != null ? `${s.averageReturnPct >= 0 ? '+' : ''}${s.averageReturnPct.toFixed(1)}%` : '—'}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statTileLabel}>{label}</Text>
      <Text style={[styles.statTileValue, color && { color }]}>{value}</Text>
    </View>
  );
}

function PeriodTile({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.periodTile}>
      <Text style={styles.periodLabel}>{label}</Text>
      <Text style={[styles.periodValue, { color: value >= 0 ? colors.green : colors.red }]}>{cad(value)}</Text>
    </View>
  );
}

// --- OPEN ------------------------------------------------------------

function OpenTab({ positions, latestBySymbol }: { positions: Position[]; latestBySymbol: Record<string, number> }) {
  const open = positions.filter(isOpen).sort((a, b) => (openedAt(b) ?? '').localeCompare(openedAt(a) ?? ''));

  if (open.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="radio-button-on-outline" size={20} color={colors.textDim} />
        <Text style={styles.emptyText}>No open positions right now.</Text>
      </View>
    );
  }

  return (
    <View>
      {open.map((position) => {
        const kind = priceKindFor(position.symbol);
        const shares = sharesHeld(position);
        const avgCost = averageCostPerShare(position);
        const currentPrice = latestBySymbol[position.symbol];
        const unrealized = currentPrice != null ? unrealizedPnlCAD(position, currentPrice) : null;
        const unrealizedPct = currentPrice != null ? unrealizedPnlPct(position, currentPrice) : null;
        const distanceToTarget =
          currentPrice != null && position.targetPrice != null ? ((position.targetPrice - currentPrice) / currentPrice) * 100 : null;
        const distanceToStop =
          currentPrice != null && position.stopPrice != null ? ((currentPrice - position.stopPrice) / currentPrice) * 100 : null;

        return (
          <Link key={position.id} href={{ pathname: '/symbol/[symbol]', params: { symbol: position.symbol } }} asChild>
            <Pressable style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.symbol}>{position.symbol}</Text>
                <Text style={styles.detail}>
                  {shares} @ {formatPrice(avgCost, kind)}
                </Text>
              </View>
              {currentPrice != null ? (
                <Text style={styles.detail}>Current: {formatPrice(currentPrice, kind)}</Text>
              ) : (
                <Text style={styles.detail}>Current price unavailable</Text>
              )}
              {unrealized != null && unrealizedPct != null && (
                <Text style={[styles.pnl, { color: unrealized >= 0 ? colors.green : colors.red }]}>
                  {cad(unrealized)} ({unrealizedPct >= 0 ? '+' : ''}
                  {unrealizedPct.toFixed(1)}%)
                </Text>
              )}
              <View style={styles.planRow}>
                {position.targetPrice != null && (
                  <Text style={styles.detail}>
                    Target {formatPrice(position.targetPrice, kind)}
                    {distanceToTarget != null && ` (${distanceToTarget >= 0 ? '+' : ''}${distanceToTarget.toFixed(1)}%)`}
                  </Text>
                )}
                {position.stopPrice != null && (
                  <Text style={styles.detail}>
                    Stop {formatPrice(position.stopPrice, kind)}
                    {distanceToStop != null && ` (${distanceToStop >= 0 ? '+' : ''}${distanceToStop.toFixed(1)}%)`}
                  </Text>
                )}
              </View>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

// --- CLOSED ------------------------------------------------------------

type ClosedSort = 'date' | 'ticker' | 'strategy' | 'pnl';
type ResultFilter = 'all' | TradeResult;
type CurrencyFilter = 'all' | 'CAD' | 'USD';

function ClosedTab({ positions, onDelete }: { positions: Position[]; onDelete: (id: string) => void }) {
  const [sort, setSort] = useState<ClosedSort>('date');
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyFilter>('all');

  const closed = positions.filter((p) => !isOpen(p) && p.transactions.some((t) => t.type === 'sell'));

  const filtered = closed
    .filter((p) => resultFilter === 'all' || tradeResult(p) === resultFilter)
    .filter((p) => currencyFilter === 'all' || p.currency === currencyFilter);

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'ticker') return a.symbol.localeCompare(b.symbol);
    if (sort === 'strategy') return SETUP_TYPE_LABELS[a.setupType].localeCompare(SETUP_TYPE_LABELS[b.setupType]);
    if (sort === 'pnl') return (realizedPnlCAD(b) ?? 0) - (realizedPnlCAD(a) ?? 0);
    return (closedAt(b) ?? '').localeCompare(closedAt(a) ?? '');
  });

  return (
    <View>
      <View style={styles.filterRow}>
        <FilterChip label="All" active={resultFilter === 'all'} onPress={() => setResultFilter('all')} />
        <FilterChip label="Wins" active={resultFilter === 'win'} onPress={() => setResultFilter('win')} />
        <FilterChip label="Losses" active={resultFilter === 'loss'} onPress={() => setResultFilter('loss')} />
      </View>
      <View style={styles.filterRow}>
        <FilterChip label="CAD + USD" active={currencyFilter === 'all'} onPress={() => setCurrencyFilter('all')} />
        <FilterChip label="CAD" active={currencyFilter === 'CAD'} onPress={() => setCurrencyFilter('CAD')} />
        <FilterChip label="USD" active={currencyFilter === 'USD'} onPress={() => setCurrencyFilter('USD')} />
      </View>
      <View style={styles.filterRow}>
        {(['date', 'ticker', 'strategy', 'pnl'] as ClosedSort[]).map((s) => (
          <FilterChip key={s} label={`Sort: ${s}`} active={sort === s} onPress={() => setSort(s)} />
        ))}
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No closed trades match these filters.</Text>
        </View>
      ) : (
        sorted.map((position) => <ClosedTradeCard key={position.id} position={position} onDelete={onDelete} />)
      )}
    </View>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function ClosedTradeCard({ position, onDelete }: { position: Position; onDelete: (id: string) => void }) {
  const kind = priceKindFor(position.symbol);
  const pnl = realizedPnlCAD(position) ?? 0;
  const pnlPct = realizedPnlPct(position);
  const result = tradeResult(position);
  const held = holdingPeriodDays(position);
  const takeaway = tradeTakeaway(position);

  const buys = position.transactions.filter((t) => t.type === 'buy').sort((a, b) => a.date.localeCompare(b.date));
  const sells = position.transactions.filter((t) => t.type === 'sell').sort((a, b) => a.date.localeCompare(b.date));
  const shares = buys.reduce((n, t) => n + t.shares, 0);

  const resultColor = result === 'win' ? colors.green : result === 'loss' ? colors.red : colors.textDim;
  const resultLabel = result === 'win' ? 'WIN' : result === 'loss' ? 'LOSS' : 'BREAKEVEN';

  return (
    <Pressable style={styles.card} onLongPress={() => onDelete(position.id)}>
      <View style={styles.cardTop}>
        <Text style={styles.symbol}>{position.symbol}</Text>
        <Text style={[styles.pnl, { color: resultColor }]}>
          {resultLabel} {cad(pnl)}
          {pnlPct != null && ` (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`}
        </Text>
      </View>
      <Text style={styles.detail}>
        Bought: {buys[0] ? formatPrice(buys[0].price, kind) : '—'} · Sold: {sells[sells.length - 1] ? formatPrice(sells[sells.length - 1].price, kind) : '—'}
      </Text>
      <Text style={styles.detail}>
        Shares: {shares} · Held: {held != null ? `${held} day${held === 1 ? '' : 's'}` : '—'} · {SETUP_TYPE_LABELS[position.setupType]}
      </Text>
      {takeaway && (
        <View style={styles.takeawayBox}>
          <Ionicons name="bulb-outline" size={11} color={colors.accent} />
          <Text style={styles.takeawayText}>{takeaway}</Text>
        </View>
      )}
      <View style={styles.deleteHintRow}>
        <Ionicons name="trash-outline" size={9} color={colors.textDim} style={{ opacity: 0.5 }} />
        <Text style={styles.deleteHint}>Long-press to delete</Text>
      </View>
    </Pressable>
  );
}

// --- TAXES ------------------------------------------------------------

function TaxesTab({ positions }: { positions: Position[] }) {
  const summaries = taxSummaryByYear(positions);
  const [selectedYear, setSelectedYear] = useState<number | null>(summaries[0]?.year ?? null);
  const selected = summaries.find((s) => s.year === selectedYear) ?? summaries[0];

  return (
    <View>
      <View style={styles.disclaimerBox}>
        <Ionicons name="information-circle-outline" size={13} color={colors.textDim} />
        <Text style={styles.disclaimerText}>
          Trading records / estimated realized P&amp;L for tax preparation — not an official tax return figure. Always
          in CAD, with the original transaction currency preserved underneath.
        </Text>
      </View>

      {summaries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No transactions recorded yet.</Text>
        </View>
      ) : (
        <>
          <View style={styles.filterRow}>
            {summaries.map((s) => (
              <FilterChip key={s.year} label={String(s.year)} active={selectedYear === s.year} onPress={() => setSelectedYear(s.year)} />
            ))}
          </View>

          {selected && (
            <View style={styles.taxCard}>
              <Text style={styles.taxYearTitle}>{selected.year} Trading Records</Text>
              <TaxRow label="Total purchases" value={`$${selected.totalBuysCAD.toFixed(2)}`} />
              <TaxRow label="Total sales" value={`$${selected.totalSalesCAD.toFixed(2)}`} />
              <TaxRow label="Realized gains" value={`$${selected.realizedGainsCAD.toFixed(2)}`} color={colors.green} />
              <TaxRow label="Realized losses" value={`-$${selected.realizedLossesCAD.toFixed(2)}`} color={colors.red} />
              <TaxRow
                label="Net realized P/L"
                value={cad(selected.netRealizedCAD)}
                color={selected.netRealizedCAD >= 0 ? colors.green : colors.red}
                bold
              />
              <TaxRow label="Fees" value={`$${selected.feesCAD.toFixed(2)}`} />
              <TaxRow label="Transactions" value={`${selected.transactionCount} (${selected.cadTradeCount} CAD, ${selected.usdTradeCount} USD)`} />
            </View>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Export</Text>
      <ExportButton icon="document-text-outline" label="CSV — all transactions" onPress={() => exportAllTransactionsCsv(positions)} />
      <ExportButton icon="checkmark-done-outline" label="CSV — closed trades" onPress={() => exportClosedTradesCsv(positions)} />
      <ExportButton icon="calendar-outline" label="CSV — yearly tax summary" onPress={() => exportYearlyTaxSummaryCsv(positions)} />
      <ExportButton icon="cloud-download-outline" label="Backup / export full journal (JSON)" onPress={() => exportBackupJson(positions)} />
    </View>
  );
}

function TaxRow({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <View style={styles.taxRow}>
      <Text style={styles.taxRowLabel}>{label}</Text>
      <Text style={[styles.taxRowValue, bold && styles.taxRowValueBold, color && { color }]}>{value}</Text>
    </View>
  );
}

function ExportButton({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.exportButton} onPress={onPress}>
      <Ionicons name={icon} size={15} color={colors.accent} />
      <Text style={styles.exportText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 120,
    paddingTop: spacing.sm,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  addTradeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  addTradeSearch: {
    marginTop: spacing.sm,
  },
  addTradeHint: {
    color: colors.textDim,
    fontSize: 10,
    marginBottom: 4,
  },
  titleIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}22`,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabButtonActive: {
    backgroundColor: `${colors.accent}1f`,
  },
  tabLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: colors.accent,
  },
  empty: {
    padding: 40,
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
  bigStatCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
    ...cardShadow,
  },
  bigStatLabel: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  bigStatValue: {
    fontSize: 34,
    fontWeight: '800',
  },
  bigStatSub: {
    color: colors.textDim,
    fontSize: 11,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  statTile: {
    width: '31%',
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  statTileLabel: {
    color: colors.textDim,
    fontSize: 9,
  },
  statTileValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  periodTile: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
  },
  periodLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '700',
  },
  periodValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  observationBox: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: `${colors.accent}14`,
  },
  observationText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  strategyCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
  },
  strategyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  strategyLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  strategyPnl: {
    fontSize: 13,
    fontWeight: '800',
  },
  strategyDetail: {
    color: colors.textDim,
    fontSize: 11,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    ...cardShadow,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbol: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  detail: {
    color: colors.textDim,
    fontSize: 11,
  },
  pnl: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  planRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 2,
  },
  takeawayBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 6,
    padding: 8,
    borderRadius: radius.sm,
    backgroundColor: `${colors.accent}14`,
  },
  takeawayText: {
    flex: 1,
    color: colors.text,
    fontSize: 11,
    lineHeight: 15,
  },
  deleteHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 6,
  },
  deleteHint: {
    color: colors.textDim,
    fontSize: 9,
    opacity: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: `${colors.accent}26`,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  chipTextActive: {
    color: colors.accent,
  },
  disclaimerBox: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    flex: 1,
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 14,
  },
  taxCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
    ...cardShadow,
  },
  taxYearTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  taxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  taxRowLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  taxRowValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  taxRowValueBold: {
    fontSize: 14,
    fontWeight: '800',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    backgroundColor: `${colors.accent}14`,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  exportText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
});
