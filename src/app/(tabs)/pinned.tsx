import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../../hooks/useScanner';
import { ALL_SYMBOLS, findSymbol, type SymbolInfo } from '../../lib/data/symbols';
import { loadPinnedSymbols } from '../../lib/pins';
import { loadTrades } from '../../lib/journalStorage';
import { Watchlist } from '../../components/Watchlist';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

const REFRESH_MS = 60 * 1000;
const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

export default function PinnedScreen() {
  const [symbolInfos, setSymbolInfos] = useState<SymbolInfo[]>([]);
  const [loadedOnce, setLoadedOnce] = useState(false);

  useFocusEffect(
    useCallback(() => {
      Promise.all([loadPinnedSymbols(), loadTrades()]).then(([pinned, trades]) => {
        const openSymbols = trades.filter((t) => t.status === 'open').map((t) => t.symbol);
        const symbols = Array.from(new Set([...pinned, ...openSymbols]));
        setSymbolInfos(symbols.map(findSymbol).filter((s): s is SymbolInfo => !!s));
        setLoadedOnce(true);
      });
    }, [])
  );

  // A pinned list is usually small, so scanning just these directly is fast —
  // no need to wait on the full ~600-symbol dashboard scan to see them.
  const { results, loading } = useScanner(symbolInfos, REFRESH_MS);
  const scanResults = symbolInfos.map((s) => results[s.symbol]).filter(Boolean);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleIcon}>
          <Ionicons name="pin" size={18} color={colors.accent} />
        </View>
        <View style={styles.titleTextWrap}>
          <Text style={styles.title}>Pinned & Open Positions</Text>
          <Text style={styles.subtitle}>
            {symbolInfos.length} symbol{symbolInfos.length === 1 ? '' : 's'} you're tracking or actively trading
          </Text>
        </View>
      </View>

      {!loadedOnce ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : symbolInfos.length === 0 ? (
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
