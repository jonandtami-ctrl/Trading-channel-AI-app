import { StyleSheet, Text, View } from 'react-native';
import type { Alert } from '../lib/types';
import { formatDate } from '../lib/format';
import { colors, radius, spacing } from '../constants/theme';

const TYPE_COLOR: Record<Alert['type'], string> = {
  breakout: colors.green,
  bounce_support: colors.green,
  breakdown: colors.red,
  bounce_resistance: colors.red,
  approaching_support: colors.amber,
  approaching_resistance: colors.amber,
};

export function AlertsFeed({ alerts }: { alerts: Alert[] }) {
  const sorted = [...alerts].sort((a, b) => b.time - a.time).slice(0, 30);

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No alerts right now — everything&apos;s calm.</Text>
      </View>
    );
  }

  return (
    <View>
      {sorted.map((alert, i) => (
        <View key={`${alert.symbol}-${alert.type}-${alert.time}-${i}`} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: TYPE_COLOR[alert.type] }]} />
          <Text style={styles.message}>
            <Text style={styles.symbol}>{alert.symbol}</Text> {alert.message}
          </Text>
          <Text style={styles.time}>{formatDate(alert.time)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginHorizontal: spacing.lg,
    marginBottom: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
  },
  symbol: {
    color: colors.blue,
    fontWeight: '700',
  },
  time: {
    color: colors.textDim,
    fontSize: 10,
  },
  empty: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
  },
});
