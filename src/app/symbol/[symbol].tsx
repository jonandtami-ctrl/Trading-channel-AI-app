import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../../hooks/useScanner';
import { findSymbol } from '../../lib/data/symbols';
import { formatPrice } from '../../lib/format';
import { getSignal } from '../../lib/scan';
import { LiveBadge } from '../../components/LiveBadge';
import { CandleChart } from '../../components/CandleChart';
import { AlertsFeed } from '../../components/AlertsFeed';
import { SectionHeader } from '../../components/SectionHeader';
import { colors, radius, spacing } from '../../constants/theme';

const SIGNAL_META: Record<string, { label: string; color: string }> = {
  buy: { label: 'BUY', color: colors.green },
  sell: { label: 'SELL', color: colors.red },
  watch_support: { label: 'WATCH · SUPPORT', color: colors.amber },
  watch_resistance: { label: 'WATCH · RESISTANCE', color: colors.amber },
};

export default function SymbolScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const navigation = useNavigation();
  const info = symbol ? findSymbol(symbol) : undefined;
  const { results, loading } = useScanner(info ? [info] : []);
  const result = symbol ? results[symbol] : undefined;

  useEffect(() => {
    navigation.setOptions({ title: symbol ?? '' });
  }, [navigation, symbol]);

  if (loading && !result) {
    return (
      <View style={styles.spinnerWrap}>
        <Text style={styles.spinnerText}>loading {symbol}…</Text>
      </View>
    );
  }

  if (!result) {
    return (
      <View style={styles.spinnerWrap}>
        <Text style={styles.spinnerText}>Symbol not found.</Text>
      </View>
    );
  }

  const last = result.candles[result.candles.length - 1];
  const signal = getSignal(result);
  const signalMeta = signal ? SIGNAL_META[signal] : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {result.symbol} · {info?.name}
            {info?.exchange ? ` · ${info.exchange}` : ''}
          </Text>
          <LiveBadge isLive={result.isLive} />
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{last ? formatPrice(last.close) : '—'}</Text>
          {signalMeta && (
            <View style={[styles.signalPill, { backgroundColor: `${signalMeta.color}26` }]}>
              <Text style={[styles.signalText, { color: signalMeta.color }]}>{signalMeta.label}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.chartWrap}>
        <CandleChart candles={result.candles} channels={result.channels} />
      </View>

      {result.channels.length > 0 ? (
        result.channels.map((channel, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Status</Text>
              <Text style={styles.cardValue}>
                {channel.status === 'broken'
                  ? `Broken ${channel.brokenDirection === 'up' ? 'up' : 'down'}`
                  : 'Active channel'}
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Resistance</Text>
              <Text style={styles.cardValue}>{formatPrice(channel.resistance.price)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Support</Text>
              <Text style={styles.cardValue}>{formatPrice(channel.support.price)}</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Width</Text>
              <Text style={styles.cardValue}>{channel.widthPct.toFixed(1)}%</Text>
            </View>
            <View style={styles.cardRow}>
              <Text style={styles.cardLabel}>Containment</Text>
              <Text style={styles.cardValue}>{channel.containmentPct.toFixed(0)}%</Text>
            </View>
          </View>
        ))
      ) : (
        <View style={styles.spinnerWrap}>
          <Text style={styles.spinnerText}>No active channel — price isn&apos;t currently consolidating.</Text>
        </View>
      )}

      <SectionHeader title="Alerts" color={colors.blue} />
      <AlertsFeed alerts={result.alerts} />
    </ScrollView>
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
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    color: colors.textDim,
    fontSize: 12,
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  price: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  chartWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  cardLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  cardValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  spinnerWrap: {
    padding: 40,
    alignItems: 'center',
  },
  spinnerText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
});
