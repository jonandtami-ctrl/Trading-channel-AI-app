import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CategoryMeta } from '../constants/categories';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

export function CategoryTile({
  meta,
  buyCount,
  sellCount,
  watchCount,
  total,
}: {
  meta: CategoryMeta;
  buyCount: number;
  sellCount: number;
  watchCount: number;
  total: number;
}) {
  return (
    <Link href={{ pathname: '/category/[category]', params: { category: meta.key } }} asChild>
      <Pressable style={({ pressed }) => [styles.tile, { borderColor: `${meta.color}3d` }, pressed && styles.tilePressed]}>
        <View style={styles.top}>
          <View style={[styles.iconWrap, { backgroundColor: `${meta.color}22` }]}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
        </View>
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {meta.subtitle}
        </Text>
        {meta.key === 'stable' ? (
          <View style={styles.stableRow}>
            <Text style={[styles.stableCount, { color: meta.color }]}>{total}</Text>
            <Text style={styles.stableLabel}>in a tight range</Text>
          </View>
        ) : (
          <View style={styles.countsRow}>
            <CountChip label="Buy" value={buyCount} color={colors.green} />
            <CountChip label="Sell" value={sellCount} color={colors.red} />
            <CountChip label="Watch" value={watchCount} color={colors.amber} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function CountChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '48%',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    gap: 6,
    ...cardShadow,
  },
  tilePressed: {
    backgroundColor: colors.bgPanelHover,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: -4,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  chip: {
    alignItems: 'center',
  },
  chipValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  chipLabel: {
    color: colors.textDim,
    fontSize: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  stableRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    marginTop: 2,
  },
  stableCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  stableLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '600',
  },
});
