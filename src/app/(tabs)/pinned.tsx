import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanData } from '../../hooks/ScanDataProvider';
import { ALL_SYMBOLS } from '../../lib/data/symbols';
import { loadPinnedSymbols } from '../../lib/pins';
import { loadPositions } from '../../lib/journalStorage';
import { isOpen } from '../../lib/position';
import { Watchlist } from '../../components/Watchlist';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

export default function PinnedScreen() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);
  // Reuses the same live scan every other screen reads from (dashboard,
  // category screens) instead of running a separate scan on its own
  // timer — that mismatch used to mean this tab could show a price up to
  // 5 minutes stale while the symbol detail page (which fetches fresh on
  // open) showed the current one for the same symbol.
  const { crypto, stocks } = useScanData();

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadPinnedSymbols(), loadPositions()]).then(([pinned, positions]) => {
        const openSymbols = positions.filter(isOpen).map((p) => p.symbol);
        setSymbols(Array.from(new Set([...pinned, ...openSymbols])));
        setLoadedOnce(true);
      });
    }, [])
  );

  const resultsBySymbol = { ...crypto.results, ...stocks.results };
  const scanResults = symbols.map((s) => resultsBySymbol[s]).filter(Boolean);
  const loading = crypto.loading || stocks.loading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleIcon}>
          <Ionicons name="pin" size={18} color={colors.accent} />
        </View>
        <View style={styles.titleTextWrap}>
          <Text style={styles.title}>Pinned & Open Positions</Text>
          <Text style={styles.subtitle}>
            {symbols.length} symbol{symbols.length === 1 ? '' : 's'} you're tracking or actively trading
          </Text>
        </View>
      </View>

      {!loadedOnce ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : symbols.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="pin-outline" size={22} color={colors.textDim} />
          <Text style={styles.emptyText}>
            Nothing pinned yet. Open any symbol and tap &quot;Pin&quot; to keep it here — logging a trade pins it
            automatically too.
          </Text>
        </View>
      ) : loading && scanResults.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Scanning your pinned symbols…</Text>
        </View>
      ) : (
        <Watchlist results={scanResults} names={names} />
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
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  titleIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}22`,
  },
  titleTextWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    marginHorizontal: spacing.lg,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    ...cardShadow,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
});
