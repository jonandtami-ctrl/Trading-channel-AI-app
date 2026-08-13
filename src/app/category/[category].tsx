import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanData } from '../../hooks/ScanDataProvider';
import { ALL_SYMBOLS } from '../../lib/data/symbols';
import { bySignal } from '../../lib/scan';
import { resultsForCategory } from '../../lib/categorize';
import { getCategoryMeta } from '../../constants/categories';
import { Watchlist } from '../../components/Watchlist';
import { StableList } from '../../components/StableList';
import { SectionHeader } from '../../components/SectionHeader';
import { LiveBadge } from '../../components/LiveBadge';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

const CAP = { buy: 25, sell: 25, watchSupport: 15, watchResistance: 15 };
const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

export default function CategoryScreen() {
  const { category } = useLocalSearchParams<{ category: string }>();
  const meta = getCategoryMeta(category ?? '');
  const { crypto, stocks } = useScanData();

  if (!meta) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Unknown category.</Text>
      </View>
    );
  }

  const cryptoResults = crypto.results;
  const stockResults = stocks.results;
  const cryptoList = Object.values(cryptoResults);
  const stockList = Object.values(stockResults);
  const results = resultsForCategory(meta.key, cryptoList, stockList);

  const loading = meta.key === 'crypto' ? crypto.loading : stocks.loading;
  const anyLive = results.some((r) => r.isLive);

  const buys = bySignal(results, 'buy', CAP.buy);
  const sells = bySignal(results, 'sell', CAP.sell);
  const watchSupport = bySignal(results, 'watch_support', CAP.watchSupport);
  const watchResistance = bySignal(results, 'watch_resistance', CAP.watchResistance);

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
        {loading && results.length === 0 && (
          <View style={styles.progressRow}>
            <Ionicons name="refresh" size={12} color={colors.blue} />
            <Text style={styles.progressText}>Scanning…</Text>
          </View>
        )}
      </View>

      {meta.key === 'stable' ? (
        <>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textDim} />
            <Text style={styles.infoText}>
              Long-established, tight, sideways channels — not a buy/sell call, just symbols that have genuinely
              gone nowhere for a while.
            </Text>
          </View>
          <SectionHeader title="Stable Ranges" count={results.length} color={meta.color} icon={meta.icon} />
          <StableList results={results} names={names} />
        </>
      ) : buys.length + sells.length + watchSupport.length + watchResistance.length === 0 ? (
        !loading && (
          <View style={styles.infoCard}>
            <Ionicons name="moon-outline" size={14} color={colors.textDim} />
            <Text style={styles.infoText}>Nothing set up here right now — check back later.</Text>
          </View>
        )
      ) : (
        <>
          {buys.length > 0 && (
            <>
              <SectionHeader title="Buy Signals" count={buys.length} color={colors.green} icon="trending-up" />
              <Watchlist results={buys} names={names} />
            </>
          )}
          {sells.length > 0 && (
            <>
              <SectionHeader title="Sell Signals" count={sells.length} color={colors.red} icon="trending-down" />
              <Watchlist results={sells} names={names} />
            </>
          )}
          {watchSupport.length > 0 && (
            <>
              <SectionHeader title="Watching — Near Support" count={watchSupport.length} color={colors.amber} icon="arrow-down-circle" />
              <Watchlist results={watchSupport} names={names} />
            </>
          )}
          {watchResistance.length > 0 && (
            <>
              <SectionHeader
                title="Watching — Near Resistance"
                count={watchResistance.length}
                color={colors.amber}
                icon="arrow-up-circle"
              />
              <Watchlist results={watchResistance} names={names} />
            </>
          )}
        </>
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
