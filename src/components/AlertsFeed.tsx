import { StyleSheet, Text, View } from 'react-native';
import type { Alert } from '../lib/types';
import { formatDate } from '../lib/format';
import { colors } from '../constants/theme';

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
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    fontSize: 11,
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
