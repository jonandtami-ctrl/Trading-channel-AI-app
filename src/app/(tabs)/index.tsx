import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanData } from '../../hooks/ScanDataProvider';
import { ALL_SYMBOLS, findSymbol } from '../../lib/data/symbols';
import { bySignal, mostReliableChannels, topActivePicks, underMaxBuyPrice } from '../../lib/scan';
import type { ScanResult } from '../../lib/types';
import { loadPinnedSymbols } from '../../lib/pins';
import { loadTrades } from '../../lib/journalStorage';
import { Watchlist } from '../../components/Watchlist';
import { SymbolSearch } from '../../components/SymbolSearch';
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
  // A handful of real S&P 500 constituents are obscure enough that showing
  // them as a "pick" just buries the recognizable names under tickers
  // nobody's heard of (see the notable doc comment on SymbolInfo) — every
  // browse/discovery view on this screen is built from this filtered set.
  // Pinned/logged positions deliberately read straight from the raw scan
  // below instead, so an existing real position never loses its price just
  // because its symbol isn't "notable."
  const stockResults = Object.values(stocks.results).filter((r) => findSymbol(r.symbol)?.notable !== false);
  // TSX names are scanned alongside the S&P 500 but get their own browse
  // category and dashboard row — split them out so the "Stocks" tile/row
  // stays a pure S&P 500 view.
  const sp500Results = stockResults.filter((r) => findSymbol(r.symbol)?.exchange !== 'TSX');
  const tsxResults = stockResults.filter((r) => findSymbol(r.symbol)?.exchange === 'TSX');
  // isLive: false means this symbol never fetched real data — demo/synthetic
  // candles can compute a "stable range" too, but it has no bearing on
  // reality (a delisted or unreachable ticker, most likely) and shouldn't
  // be counted here any more than it should show up in the category drill-down.
  const stableResults = stockResults.filter((r) => !!r.stability && r.isLive);

  const allResultsBysymbol: Record<string, ScanResult> = { ...crypto.results, ...stocks.results };
  const keptResults = keepSymbols.map((s) => allResultsBysymbol[s]).filter(Boolean);

  const perCategory = {
    crypto: signalCounts(cryptoResults),
    stocks: signalCounts(sp500Results),
    tsx: signalCounts(tsxResults),
    stable: { buy: 0, sell: 0, watch: 0, total: stableResults.length },
  };

  const buysTotal = perCategory.crypto.buy + perCategory.stocks.buy + perCategory.tsx.buy;
  const sellsTotal = perCategory.crypto.sell + perCategory.stocks.sell + perCategory.tsx.sell;
  const watchTotal = perCategory.crypto.watch + perCategory.stocks.watch + perCategory.tsx.watch;

  const allResults = [...cryptoResults, ...stockResults];

  // "Best Buys Under $100" — confirmed bounce-off-support setups only,
  // priced under $100. Ranked by trade-plan quality, not just proximity to
  // a level.
  const bestBuyPool = allResults;
  const bestBuys = bySignal(bestBuyPool, 'buy')
    .filter((r) => {
      const last = r.candles[r.candles.length - 1];
      return last != null && last.close < 100;
    })
    .sort((a, b) => (b.tradePlan?.qualityScore ?? 0) - (a.tradePlan?.qualityScore ?? 0))
    .slice(0, TOP_PICKS_CAP);

  // Not "what's actionable right now" like Best Buys, but "what's proven
  // itself" — symbols whose channel has bounced back and forth enough
  // times to trust the pattern, regardless of where price sits in it today.
  const mostReliable = mostReliableChannels(allResults, TOP_PICKS_CAP);

  // Every stock in the S&P 500 scan with a currently active channel on a
  // timescale that actually fits how a large-cap stock moves (see
  // topActivePicks/VALUE_MAX_SPAN_CANDLES), ranked by touch count and
  // containment. Uncapped — anything that clears the reliability bar
  // shows up here, not just a fixed top handful. These two rows are
  // explicitly "to trade," so they respect the same per-share price
  // ceiling as a BUY signal (see underMaxBuyPrice) even for a WATCH/SELL
  // card — this is the pool of stocks actually worth entering.
  const topPicks = topActivePicks(sp500Results.filter(underMaxBuyPrice));
  // Same idea, scoped to TSX — priced/settled in CAD, so cheaper to
  // actually trade from a Canadian brokerage than a US ticker.
  const tsxPicks = topActivePicks(tsxResults.filter(underMaxBuyPrice));
  // Crypto never had an equivalent row — it only ever appeared in "Most
  // Reliable Channels" above, pooled together with ~380 stock/TSX symbols
  // for a shared top-6 cap, so with only 50 crypto names it almost always
  // lost out to stocks and never showed up there. This gives crypto its
  // own wide-window row exactly like stocks/TSX get, so it's never crowded
  // out by the much bigger stock universe.
  const cryptoPicks = topActivePicks(cryptoResults);

  const anyLive = allResults.some((r) => r.isLive);
  const allAlerts = allResults.flatMap((r) => r.alerts);

  useEffect(() => {
    requestNotificationPermission().then(setAlertStatus);
  }, []);

  useEffect(() => {
    if (stocks.loading || stockResults.length === 0 || alertStatus !== 'granted') return;
    scheduleWeeklyChannelAlert(stockResults);
    notifyNewSignals(stockResults, seenSignals.current).then((next) => {
      seenSignals.current = next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stocks.loading, alertStatus, stockResults.length]);

  const initialLoad = cryptoResults.length === 0 && stockResults.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {initialLoad ? (
        <View style={styles.spinnerWrap}>
          <Ionicons name="pulse" size={28} color={colors.accent} />
          <Text style={styles.spinnerText}>Scanning crypto, the S&amp;P 500, &amp; the TSX…</Text>
          <Text style={styles.spinnerSubtext}>
            First load checks ~430 tickers — the S&amp;P 500, TSX, and top 50 crypto — usually just a few seconds.
            Results fill in below as they come in.
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
                  scanning stocks… {stocks.scanned.toLocaleString()} / {stocks.total.toLocaleString()} (
                  {Math.round((stocks.scanned / stocks.total) * 100)}%)
                </Text>
              </View>
            )}
            <Disclaimer compact />
          </View>

          <SymbolSearch />

          <View style={styles.statsRow}>
            <StatTile icon="trending-up" label="Buys" value={buysTotal} color={colors.green} href="/signal/buy" />
            <StatTile icon="trending-down" label="Sells" value={sellsTotal} color={colors.red} href="/signal/sell" />
            <StatTile icon="eye" label="Watching" value={watchTotal} color={colors.amber} href="/signal/watch" />
            <StatTile icon="pin" label="Kept" value={keptResults.length} color={colors.accent} href="/pinned" />
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

          <SectionHeader title="Best Buys Under $100" count={bestBuys.length} color={colors.text} icon="star" />
          <Watchlist results={bestBuys} names={names} horizontal />

          <SectionHeader
            title="Most Reliable Channels"
            count={mostReliable.length}
            color={colors.text}
            icon="repeat"
          />
          <Watchlist results={mostReliable} names={names} horizontal />

          <SectionHeader title="Crypto Picks" count={cryptoPicks.length} color={colors.text} icon="logo-bitcoin" />
          <Watchlist results={cryptoPicks} names={names} horizontal showChannelAge wideView />

          <SectionHeader
            title="Active Channels to Trade"
            count={topPicks.length}
            color={colors.text}
            icon="ribbon-outline"
          />
          <Watchlist results={topPicks} names={names} horizontal showChannelAge wideView />

          <SectionHeader
            title="TSX Picks (CAD)"
            count={tsxPicks.length}
            color={colors.blue}
            icon="flag-outline"
          />
          <Watchlist results={tsxPicks} names={names} horizontal showChannelAge wideView />

          <SectionHeader title="Recent Alerts" color={colors.blue} icon="notifications" />
          <AlertsFeed alerts={allAlerts} limit={8} />
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
  href,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  color: string;
  href: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable style={{ ...styles.statTile, borderColor: `${color}44` }}>
        <View style={[styles.statIconWrap, { backgroundColor: `${color}22` }]}>
          <Ionicons name={icon} size={15} color={color} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </Pressable>
    </Link>
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
