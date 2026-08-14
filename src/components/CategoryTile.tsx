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
      <Pressable style={{ ...styles.tile, borderColor: `${meta.color}3d` }}>
        <View style={styles.top}>
          <View style={[styles.iconWrap, { backgroundColor: `${meta.color}22` }]}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
          </View>
          <Ionicons name="chevron-forward" size={14} color={colors.textDim} />
        </View>
        <Text style={styles.title}>{meta.title}</Text>
        {meta.key === 'stable' ? (
          <View style={styles.headlineRow}>
            <Text style={[styles.headlineCount, { color: meta.color }]}>{total}</Text>
            <Text style={styles.headlineLabel}>in a tight range</Text>
          </View>
        ) : (
          <>
            <View style={styles.headlineRow}>
              <Text style={[styles.headlineCount, { color: buyCount + sellCount > 0 ? meta.color : colors.textDim }]}>
                {buyCount + sellCount}
              </Text>
              <Text style={styles.headlineLabel}>actionable</Text>
            </View>
            <Text style={styles.breakdown} numberOfLines={1}>
              {buyCount} buy · {sellCount} sell · {watchCount} watching
            </Text>
          </>
        )}
      </Pressable>
    </Link>
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
    fontSize: 13,
    fontWeight: '700',
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  headlineCount: {
    fontSize: 22,
    fontWeight: '800',
  },
  headlineLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  breakdown: {
    color: colors.textDim,
    fontSize: 9,
  },
});
