import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../../hooks/useScanner';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '../../lib/data/symbols';
import { closestLevelDistance, getSignal } from '../../lib/scan';
import type { ScanResult } from '../../lib/types';
import { loadPinnedSymbols } from '../../lib/pins';
import { loadTrades } from '../../lib/journalStorage';
import { Watchlist } from '../../components/Watchlist';
import { AlertsFeed } from '../../components/AlertsFeed';
import { LiveBadge } from '../../components/LiveBadge';
import { SectionHeader } from '../../components/SectionHeader';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';
import {
  requestNotificationPermission,
  scheduleWeeklyChannelAlert,
  notifyNewSignals,
  type PermissionStatus,
} from '../../lib/notifications';

const CRYPTO_REFRESH_MS = 60 * 1000;
const PRICE_LIMIT = 120;
const CAP = { buy: 15, sell: 15, watchSupport: 5, watchResistance: 5 };

function underLimit(r: ScanResult): boolean {
  const last = r.candles[r.candles.length - 1];
  return !!last && last.close > 0 && last.close < PRICE_LIMIT;
}

function bySignal(results: ScanResult[], signal: ReturnType<typeof getSignal>, cap: number): ScanResult[] {
  return results
    .filter((r) => getSignal(r) === signal)
    .sort((a, b) => closestLevelDistance(a) - closestLevelDistance(b))
    .slice(0, cap);
}

export default function DashboardScreen() {
  const { results: cryptoRaw } = useScanner(CRYPTO_SYMBOLS, CRYPTO_REFRESH_MS);
  const { results: stockRaw, loading: stockLoading, scanned, total } = useScanner(STOCK_SYMBOLS);
  const [alertStatus, setAlertStatus] = useState<PermissionStatus | 'pending'>('pending');
  const [keepSymbols, setKeepSymbols] = useState<string[]>([]);
  const scheduledOnce = useRef(false);
  const seenSignals = useRef<Set<string>>(new Set());
  const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadPinnedSymbols(), loadTrades()]).then(([pinned, trades]) => {
        const openSymbols = trades.filter((t) => t.status === 'open').map((t) => t.symbol);
        setKeepSymbols(Array.from(new Set([...pinned, ...openSymbols])));
      });
    }, [])
  );

  const cryptoResults = CRYPTO_SYMBOLS.map((s) => cryptoRaw[s.symbol]).filter(Boolean);
  const allStockResults = STOCK_SYMBOLS.map((s) => stockRaw[s.symbol]).filter(Boolean);
  const tradeable = allStockResults.filter(underLimit);
  const allResultsBysymbol: Record<string, ScanResult> = { ...cryptoRaw, ...stockRaw };
  const keptResults = keepSymbols.map((s) => allResultsBysymbol[s]).filter(Boolean);

  const buys = bySignal(tradeable, 'buy', CAP.buy);
  const sells = bySignal(tradeable, 'sell', CAP.sell);
  const watchSupport = bySignal(tradeable, 'watch_support', CAP.watchSupport);
  const watchResistance = bySignal(tradeable, 'watch_resistance', CAP.watchResistance);
  const picks = [...buys, ...sells, ...watchSupport, ...watchResistance];

  const anyLive = [...cryptoResults, ...allStockResults].some((r) => r.isLive);
  const allAlerts = [...cryptoResults, ...picks].flatMap((r) => r.alerts);

  useEffect(() => {
    requestNotificationPermission().then(setAlertStatus);
  }, []);

  useEffect(() => {
    if (stockLoading || tradeable.length === 0 || alertStatus !== 'granted') return;
    scheduleWeeklyChannelAlert(tradeable);
    scheduledOnce.current = true;
    notifyNewSignals(tradeable, seenSignals.current).then((next) => {
      seenSignals.current = next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockLoading, alertStatus, tradeable.length]);

  const initialLoad = cryptoResults.length === 0 && allStockResults.length === 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {initialLoad ? (
        <View style={styles.spinnerWrap}>
          <Ionicons name="pulse" size={28} color={colors.accent} />
          <Text style={styles.spinnerText}>Scanning crypto and the first batch of stocks…</Text>
          <Text style={styles.spinnerSubtext}>
            First load checks ~950 tickers, usually a minute or two. Results fill in below as they come in.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <View style={styles.brandRow}>
                <View style={styles.brandIcon}>
                  <Ionicons name="pulse" size={18} color={colors.accent} />
                </View>
                <Text style={styles.title}>Channel Scanner</Text>
              </View>
              <LiveBadge isLive={anyLive} />
            </View>
            <Text style={styles.subtitle}>Support / resistance breakout monitor · picks under ${PRICE_LIMIT}</Text>
            {stockLoading && (
              <View style={styles.progressRow}>
                <Ionicons name="refresh" size={12} color={colors.blue} />
                <Text style={styles.progressText}>
                  scanning… {scanned.toLocaleString()} / {total.toLocaleString()} (
                  {Math.round((scanned / total) * 100)}%)
                </Text>
              </View>
            )}
            <AlertStatusLine status={alertStatus} scheduled={scheduledOnce.current} />
          </View>

          <View style={styles.statsRow}>
            <StatTile icon="trending-up" label="Buys" value={buys.length} color={colors.green} />
            <StatTile icon="trending-down" label="Sells" value={sells.length} color={colors.red} />
            <StatTile icon="eye" label="Watching" value={watchSupport.length + watchResistance.length} color={colors.amber} />
            <StatTile icon="pin" label="Kept" value={keptResults.length} color={colors.accent} />
          </View>

          {keptResults.length > 0 && (
            <>
              <SectionHeader title="Pinned & Open Positions" count={keptResults.length} color={colors.accent} icon="pin" />
              <Watchlist results={keptResults} names={names} />
            </>
          )}

          <SectionHeader title="Crypto" color={colors.purple} icon="logo-bitcoin" />
          <Watchlist results={cryptoResults} names={names} />

          <SectionHeader title="Buy Signals" count={buys.length} color={colors.green} icon="trending-up" />
          <Watchlist results={buys} names={names} />

          <SectionHeader title="Sell Signals" count={sells.length} color={colors.red} icon="trending-down" />
          <Watchlist results={sells} names={names} />

          <SectionHeader title="Watching — Near Support" count={watchSupport.length} color={colors.amber} icon="arrow-down-circle" />
          <Watchlist results={watchSupport} names={names} />

          <SectionHeader title="Watching — Near Resistance" count={watchResistance.length} color={colors.amber} icon="arrow-up-circle" />
          <Watchlist results={watchResistance} names={names} />

          <SectionHeader title="Alerts" color={colors.blue} icon="notifications" />
          <AlertsFeed alerts={allAlerts} />
        </>
      )}
    </ScrollView>
  );
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

function AlertStatusLine({ status, scheduled }: { status: PermissionStatus | 'pending'; scheduled: boolean }) {
  if (status === 'pending') return null;

  let text = '';
  if (status === 'denied') {
    text = 'Notifications off — enable in Settings for the Sunday digest + instant buy/sell alerts.';
  } else if (status === 'granted' && scheduled) {
    text = 'Sunday 8pm digest + instant buy/sell alerts are on.';
  } else if (status === 'granted') {
    text = 'Setting up alerts…';
  }

  return <Text style={styles.alertStatusText}>{text}</Text>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 40,
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
    gap: 6,
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
    gap: 8,
  },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}22`,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
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
  alertStatusText: {
    color: colors.textDim,
    fontSize: 10,
    fontStyle: 'italic',
    marginTop: 2,
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
