import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../../hooks/useScanner';
import { findSymbol } from '../../lib/data/symbols';
import { formatPrice } from '../../lib/format';
import { LiveBadge } from '../../components/LiveBadge';
import { CandleChart } from '../../components/CandleChart';
import { AlertsFeed } from '../../components/AlertsFeed';
import { colors } from '../../constants/theme';

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {result.symbol} · {info?.name}
          </Text>
          <LiveBadge isLive={result.isLive} />
        </View>
        <Text style={styles.price}>{last ? formatPrice(last.close) : '—'}</Text>
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

      <Text style={styles.sectionTitle}>Alerts</Text>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaText: {
    color: colors.textDim,
    fontSize: 12,
  },
  price: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  chartWrap: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.bgPanel,
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
    textAlign: 'center',
  },
});
