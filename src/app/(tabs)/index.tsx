import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanData } from '../../hooks/ScanDataProvider';
import { ALL_SYMBOLS, findSymbol } from '../../lib/data/symbols';
import { bySignal } from '../../lib/scan';
import type { ScanResult } from '../../lib/types';
import { loadPinnedSymbols } from '../../lib/pins';
import { loadTrades } from '../../lib/journalStorage';
import { Watchlist } from '../../components/Watchlist';
import { AlertsFeed } from '../../components/AlertsFeed';
import { LiveBadge } from '../../components/LiveBadge';
import { Disclaimer } from '../../components/Disclaimer';
import { SectionHeader } from '../../components/SectionHeader';
import { CategoryTile } from '../../components/CategoryTile';
import { CATEGORIES } from '../../constants/categories';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';
import { requestNotificationPermission, scheduleWeeklyChannelAlert, notifyNewSignals } from '../../lib/notifications';

const TOP_PICKS_CAP = 6;
const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

export default function DashboardScreen() {
  const { crypto, stocks } = useScanData();
  const [alertStatus, setAlertStatus] = useState<'granted' | 'denied' | 'undetermined' | 'pending'>('pending');
  const [keepSymbols, setKeepSymbols] = useState<string[]>([]);
  const seenSignals = useRef<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadPinnedSymbols(), loadTrades()]).then(([pinned, trades]) => {
        const openSymbols = trades.filter((t) => t.status === 'open').map((t) => t.symbol);
        setKeepSymbols(Array.from(new Set([...pinned, ...openSymbols])));
      });
    }, [])
  );

  const cryptoResults = Object.values(crypto.results);
  const allStockResults = Object.values(stocks.results);
  const stockResults = allStockResults.filter((r) => findSymbol(r.symbol)?.exchange !== 'ETF');
  const etfResults = allStockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'ETF');
  const stableResults = allStockResults.filter((r) => !!r.stability);

  const allResultsBysymbol: Record<string, ScanResult> = { ...crypto.results, ...stocks.results };
  const keptResults = keepSymbols.map((s) => allResultsBysymbol[s]).filter(Boolean);

  const perCategory = {
    crypto: signalCounts(cryptoResults),
    stocks: signalCounts(stockResults),
    etfs: signalCounts(etfResults),
    stable: { buy: 0, sell: 0, watch: 0, total: stableResults.length },
  };

  const buysTotal = perCategory.crypto.buy + perCategory.stocks.buy + perCategory.etfs.buy;
  const sellsTotal = perCategory.crypto.sell + perCategory.stocks.sell + perCategory.etfs.sell;
  const watchTotal = perCategory.crypto.watch + perCategory.stocks.watch + perCategory.etfs.watch;

  const allResults = [...cryptoResults, ...allStockResults];
  const topPicks = [...bySignal(allResults, 'buy'), ...bySignal(allResults, 'sell')]
    .sort((a, b) => (b.tradePlan?.qualityScore ?? 0) - (a.tradePlan?.qualityScore ?? 0))
    .slice(0, TOP_PICKS_CAP);

  const anyLive = allResults.some((r) => r.isLive);
  const allAlerts = allResults.flatMap((r) => r.alerts);

  useEffect(() => {
    requestNotificationPermission().then(setAlertStatus);
  }, []);

  useEffect(() => {
    if (stocks.loading || allStockResults.length === 0 || alertStatus !== 'granted') return;
    scheduleWeeklyChannelAlert(allStockResults);
    notifyNewSignals(allStockResults, seenSignals.current).then((next) => {
      seenSignals.current = next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.loading, alertStatus, allStockResults.length]);

  const initialLoad = cryptoResults.length === 0 && allStockResults.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {initialLoad ? (
        <View style={styles.spinnerWrap}>
          <Ionicons name="pulse" size={28} color={colors.accent} />
          <Text style={styles.spinnerText}>Scanning crypto and the first batch of stocks…</Text>
          <Text style={styles.spinnerSubtext}>
            First load checks ~550 S&amp;P 500 &amp; ETF tickers, usually a minute or two. Results fill in below as
            they come in.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="pulse" size={19} color={colors.accent} />
                </View>
                <View>
                  <Text style={styles.title}>Channel Scanner</Text>
                  <Text style={styles.subtitle}>Support / resistance breakout monitor</Text>
                </View>
              </View>
              <LiveBadge isLive={anyLive} />
            </View>
            {stocks.loading && (
              <View style={styles.progressRow}>
                <Ionicons name="refresh" size={12} color={colors.blue} />
                <Text style={styles.progressText}>
                  scanning stocks &amp; ETFs… {stocks.scanned.toLocaleString()} / {stocks.total.toLocaleString()} (
                  {Math.round((stocks.scanned / stocks.total) * 100)}%)
                </Text>
              </View>
            )}
            <Disclaimer compact />
          </View>

          <View style={styles.statsRow}>
            <StatTile icon="trending-up" label="Buys" value={buysTotal} color={colors.green} />
            <StatTile icon="trending-down" label="Sells" value={sellsTotal} color={colors.red} />
            <StatTile icon="eye" label="Watching" value={watchTotal} color={colors.amber} />
            <StatTile icon="pin" label="Kept" value={keptResults.length} color={colors.accent} />
          </View>

          <SectionHeader title="Browse by Market" color={colors.text} icon="grid-outline" />
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((meta) => {
              const c = perCategory[meta.key];
              return (
                <CategoryTile
                  key={meta.key}
                  meta={meta}
                  buyCount={c.buy}
                  sellCount={c.sell}
                  watchCount={c.watch}
                  total={c.total}
                />
              );
            })}
          </View>

          {keptResults.length > 0 && (
            <>
              <SectionHeader title="Pinned & Open Positions" count={keptResults.length} color={colors.accent} icon="pin" />
              <Watchlist results={keptResults} names={names} />
            </>
          )}

          <SectionHeader title="Today's Top Picks" count={topPicks.length} color={colors.text} icon="star" />
          <Watchlist results={topPicks} names={names} horizontal />

          <SectionHeader title="Alerts" color={colors.blue} icon="notifications" />
          <AlertsFeed alerts={allAlerts} />
        </>
      )}
    </ScrollView>
  );
}

function signalCounts(results: ScanResult[]): { buy: number; sell: number; watch: number; total: number } {
  const buy = bySignal(results, 'buy').length;
  const sell = bySignal(results, 'sell').length;
  const watch = bySignal(results, 'watch_support').length + bySignal(results, 'watch_resistance').length;
  return { buy, sell, watch, total: results.length };
}

function StatTile({
  icon,
  label,
  value,
  color,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={[styles.statTile, { borderColor: `${color}44` }]}>
      <View style={[styles.statIconWrap, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 120,
  },
  headerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...cardShadow,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}22`,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  progressText: {
    color: colors.blue,
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    ...cardShadow,
  },
  statIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  spinnerWrap: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  spinnerText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
  spinnerSubtext: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
    opacity: 0.7,
  },
});
