import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../hooks/useScanner';
import { ALL_SYMBOLS, CRYPTO_SYMBOLS, STOCK_SYMBOLS } from '../lib/data/symbols';
import { Watchlist } from '../components/Watchlist';
import { AlertsFeed } from '../components/AlertsFeed';
import { LiveBadge } from '../components/LiveBadge';
import { colors } from '../constants/theme';
import {
  requestNotificationPermission,
  scheduleWeeklyChannelAlert,
  type PermissionStatus,
} from '../lib/notifications';

export default function DashboardScreen() {
  const { results, loading } = useScanner(ALL_SYMBOLS);
  const [alertStatus, setAlertStatus] = useState<PermissionStatus | 'pending'>('pending');
  const scheduledOnce = useRef(false);
  const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

  const cryptoResults = CRYPTO_SYMBOLS.map((s) => results[s.symbol]).filter(Boolean);
  const stockResults = STOCK_SYMBOLS.map((s) => results[s.symbol]).filter(Boolean);
  const allResults = [...cryptoResults, ...stockResults];
  const allAlerts = allResults.flatMap((r) => r.alerts);
  const anyLive = allResults.some((r) => r.isLive);

  useEffect(() => {
    requestNotificationPermission().then(setAlertStatus);
  }, []);

  useEffect(() => {
    if (loading || stockResults.length === 0 || alertStatus !== 'granted') return;
    scheduleWeeklyChannelAlert(stockResults);
    scheduledOnce.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, alertStatus, stockResults.length]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {loading && allResults.length === 0 ? (
        <View style={styles.spinnerWrap}>
          <Text style={styles.spinnerText}>scanning…</Text>
        </View>
      ) : (
        <>
          <View style={styles.subHeader}>
            <Text style={styles.subtitle}>support / resistance breakout monitor</Text>
            {allResults.length > 0 && <LiveBadge isLive={anyLive} />}
          </View>

          <AlertStatusLine status={alertStatus} scheduled={scheduledOnce.current} />

          <Text style={styles.sectionTitle}>Crypto</Text>
          <Watchlist results={cryptoResults} names={names} />

          <Text style={styles.sectionTitle}>Stocks (top 15, by urgency)</Text>
          <Watchlist results={stockResults} names={names} />

          <Text style={styles.sectionTitle}>Alerts</Text>
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
    text = 'Weekly Sunday alert off — notifications denied. Enable in Settings to turn it on.';
  } else if (status === 'granted' && scheduled) {
    text = 'Weekly Sunday 8pm alert scheduled, updated with today’s scan.';
  } else if (status === 'granted') {
    text = 'Weekly Sunday 8pm alert: scheduling…';
  }

  return (
    <View style={styles.alertStatus}>
      <Text style={styles.alertStatusText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
  },
  alertStatus: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  alertStatusText: {
    color: colors.textDim,
    fontSize: 10,
    fontStyle: 'italic',
  },
  sectionTitle: {
    color: colors.textDim,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  spinnerWrap: {
    padding: 40,
    alignItems: 'center',
  },
  spinnerText: {
    color: colors.textDim,
    fontSize: 12,
  },
});
