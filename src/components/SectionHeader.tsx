import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export function SectionHeader({ title, count, color }: { title: string; count?: number; color: string }) {
  return (
    <View style={styles.row}>
      <View style={[styles.bar, { backgroundColor: color }]} />
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  bar: {
    width: 4,
    height: 14,
    borderRadius: 2,
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  count: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '600',
  },
});
