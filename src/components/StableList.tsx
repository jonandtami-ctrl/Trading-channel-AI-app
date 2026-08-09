import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScanResult } from '../lib/types';
import { formatPrice } from '../lib/format';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

/** A dedicated list for the "stable / going nowhere" category — these aren't buy/sell calls, so it shows the range itself instead of a signal pill. */
export function StableList({ results, names }: { results: ScanResult[]; names: Record<string, string> }) {
  if (results.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="moon-outline" size={18} color={colors.textDim} />
        <Text style={styles.emptyText}>
          Nothing sitting in a long, tight, sideways range right now — check back after the next scan.
        </Text>
      </View>
    );
  }

  const sorted = [...results].sort((a, b) => (a.stability?.widthPct ?? 0) - (b.stability?.widthPct ?? 0));

  return (
    <View>
      {sorted.map((result) => {
        const last = result.candles[result.candles.length - 1];
        const info = result.stability;
        if (!info) return null;
        return (
          <Link key={result.symbol} href={{ pathname: '/symbol/[symbol]', params: { symbol: result.symbol } }} asChild>
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.accentBar} />
              <View style={styles.left}>
                <Text style={styles.symbol}>{result.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {names[result.symbol] ?? ''}
                </Text>
                <Text style={styles.range}>
                  Range {formatPrice(info.support)}–{formatPrice(info.resistance)} · ±{(info.widthPct / 2).toFixed(1)}%
                  · {info.touchCount} touches
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.price}>{last ? formatPrice(last.close) : '—'}</Text>
                <View style={styles.pill}>
                  <Ionicons name="shield-checkmark-outline" size={11} color={colors.green} />
                  <Text style={styles.pillText}>Stable range</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textDim} style={styles.chevron} />
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...cardShadow,
  },
  cardPressed: {
    backgroundColor: colors.bgPanelHover,
    borderColor: colors.accent,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.green,
  },
  left: {
    flex: 1,
    marginRight: spacing.sm,
    marginLeft: spacing.xs,
  },
  symbol: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  name: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  range: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 4,
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${colors.green}22`,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.green,
  },
  chevron: {
    marginLeft: 6,
  },
  empty: {
    padding: 24,
    marginHorizontal: spacing.lg,
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
