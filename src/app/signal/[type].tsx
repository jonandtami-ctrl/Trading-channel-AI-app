import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanData } from '../../hooks/ScanDataProvider';
import { ALL_SYMBOLS } from '../../lib/data/symbols';
import { bySignal } from '../../lib/scan';
import type { ScanResult } from '../../lib/types';
import { Watchlist } from '../../components/Watchlist';
import { LiveBadge } from '../../components/LiveBadge';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

type SignalType = 'buy' | 'sell' | 'watch';

const META: Record<SignalType, { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  buy: {
    title: 'Buy Signals',
    subtitle: 'Confirmed bounces off support, across crypto and the S&P 500',
    icon: 'trending-up',
    color: colors.green,
  },
  sell: {
    title: 'Sell Signals',
    subtitle: 'Breakdowns and resistance rejections, across crypto and the S&P 500',
    icon: 'trending-down',
    color: colors.red,
  },
  watch: {
    title: 'Watching',
    subtitle: 'Sitting right at support or resistance, not confirmed yet',
    icon: 'eye',
    color: colors.amber,
  },
};

function resultsForSignal(type: SignalType, results: ScanResult[]): ScanResult[] {
  if (type === 'buy') return bySignal(results, 'buy');
  if (type === 'sell') return bySignal(results, 'sell');
  return [...bySignal(results, 'watch_support'), ...bySignal(results, 'watch_resistance')];
}

export default function SignalScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const meta = type === 'buy' || type === 'sell' || type === 'watch' ? META[type] : undefined;
  const { crypto, stocks } = useScanData();

  if (!meta) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Unknown signal type.</Text>
      </View>
    );
  }

  const allResults = [...Object.values(crypto.results), ...Object.values(stocks.results)];
  const results = resultsForSignal(type as SignalType, allResults);
  const anyLive = results.some((r) => r.isLive);
  const loading = crypto.loading || stocks.loading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: meta.title }} />

      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={styles.brandRow}>
            <View style={[styles.brandIcon, { backgroundColor: `${meta.color}22` }]}>
              <Ionicons name={meta.icon} size={18} color={meta.color} />
            </View>
            <View>
              <Text style={styles.title}>{meta.title}</Text>
              <Text style={styles.subtitle}>{meta.subtitle}</Text>
            </View>
          </View>
          <LiveBadge isLive={anyLive} />
        </View>
      </View>

      {results.length === 0 ? (
        !loading && (
          <View style={styles.infoCard}>
            <Ionicons name="moon-outline" size={14} color={colors.textDim} />
            <Text style={styles.infoText}>Nothing here right now — check back after the next scan.</Text>
          </View>
        )
      ) : (
        <Watchlist results={results} names={names} />
      )}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  headerCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
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
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: {
    flex: 1,
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 13,
  },
});
