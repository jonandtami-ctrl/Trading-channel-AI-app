import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../hooks/useScanner';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '../lib/data/symbols';
import { closestLevelDistance, getSignal } from '../lib/scan';
import type { ScanResult } from '../lib/types';
import { Watchlist } from '../components/Watchlist';
import { AlertsFeed } from '../components/AlertsFeed';
import { LiveBadge } from '../components/LiveBadge';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing } from '../constants/theme';
import {
  requestNotificationPermission,
  scheduleWeeklyChannelAlert,
  notifyNewSignals,
  type PermissionStatus,
} from '../lib/notifications';

const CRYPTO_REFRESH_MS = 60 * 1000;
const PRICE_LIMIT = 120;
const CAP = { buy: 10, sell: 10, watchSupport: 5, watchResistance: 5 };

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
  const scheduledOnce = useRef(false);
  const seenSignals = useRef<Set<string>>(new Set());
  const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

  const cryptoResults = CRYPTO_SYMBOLS.map((s) => cryptoRaw[s.symbol]).filter(Boolean);
  const allStockResults = STOCK_SYMBOLS.map((s) => stockRaw[s.symbol]).filter(Boolean);
  const tradeable = allStockResults.filter(underLimit);

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
          <Text style={styles.spinnerText}>Scanning crypto and the first batch of stocks…</Text>
          <Text style={styles.spinnerSubtext}>
            First load checks ~950 tickers, usually a minute or two. Results fill in below as they come in.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.headerCard}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>Channel Scanner</Text>
              <LiveBadge isLive={anyLive} />
            </View>
            <Text style={styles.subtitle}>Support / resistance breakout monitor · picks under ${PRICE_LIMIT}</Text>
            {stockLoading && (
              <Text style={styles.progressText}>
                scanning… {scanned.toLocaleString()} / {total.toLocaleString()} (
                {Math.round((scanned / total) * 100)}%)
              </Text>
            )}
            <AlertStatusLine status={alertStatus} scheduled={scheduledOnce.current} />
          </View>

          <SectionHeader title="Crypto" color={colors.purple} />
          <Watchlist results={cryptoResults} names={names} />

          <SectionHeader title="Buy Signals" count={buys.length} color={colors.green} />
          <Watchlist results={buys} names={names} />

          <SectionHeader title="Sell Signals" count={sells.length} color={colors.red} />
          <Watchlist results={sells} names={names} />

          <SectionHeader title="Watching — Near Support" count={watchSupport.length} color={colors.amber} />
          <Watchlist results={watchSupport} names={names} />

          <SectionHeader title="Watching — Near Resistance" count={watchResistance.length} color={colors.amber} />
          <Watchlist results={watchResistance} names={names} />

          <SectionHeader title="Alerts" color={colors.blue} />
          <AlertsFeed alerts={allAlerts} />
        </>
      )}
    </ScrollView>
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
    marginBottom: spacing.xs,
    padding: spacing.lg,
    borderRadius: 16,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
