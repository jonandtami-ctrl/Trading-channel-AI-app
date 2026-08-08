import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TIMEFRAMES, type Timeframe } from '../lib/timeframes';
import { colors, radius, spacing } from '../constants/theme';

export function TimeframeSelector({
  selected,
  onSelect,
}: {
  selected: Timeframe;
  onSelect: (t: Timeframe) => void;
}) {
  return (
    <View style={styles.row}>
      {TIMEFRAMES.map((t) => {
        const active = t.label === selected.label;
        return (
          <Pressable
            key={t.label}
            onPress={() => onSelect(t)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: `${colors.accent}26`,
    borderColor: colors.accent,
  },
  label: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  labelActive: {
    color: colors.accent,
  },
});
