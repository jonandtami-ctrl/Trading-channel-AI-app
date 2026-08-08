import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../constants/theme';

export function SectionHeader({
  title,
  count,
  color,
  icon,
}: {
  title: string;
  count?: number;
  color: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon ?? 'ellipse'} size={14} color={color} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {count !== undefined && (
        <View style={[styles.countPill, { backgroundColor: `${color}22` }]}>
          <Text style={[styles.count, { color }]}>{count}</Text>
        </View>
      )}
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
  iconWrap: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    flex: 1,
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    minWidth: 22,
    alignItems: 'center',
  },
  count: {
    fontSize: 11,
    fontWeight: '800',
  },
});
