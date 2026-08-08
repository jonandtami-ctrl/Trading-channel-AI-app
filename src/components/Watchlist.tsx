import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScanResult } from '../lib/types';
import { urgencyScore } from '../lib/scan';
import { formatPrice } from '../lib/format';
import { colors } from '../constants/theme';

function statusFor(result: ScanResult): { label: string; color: string; bg: string } {
  const breakout = result.alerts.find((a) => a.type === 'breakout');
  const breakdown = result.alerts.find((a) => a.type === 'breakdown');
  if (breakout) return { label: 'Breakout', color: colors.green, bg: `${colors.green}22` };
  if (breakdown) return { label: 'Breakdown', color: colors.red, bg: `${colors.red}22` };

  const approaching = result.alerts.find(
    (a) => a.type === 'approaching_resistance' || a.type === 'approaching_support'
  );
  if (approaching) {
    return {
      label: approaching.type === 'approaching_resistance' ? 'Near resistance' : 'Near support',
      color: colors.amber,
      bg: `${colors.amber}22`,
    };
  }

  const bounce = result.alerts.find((a) => a.type === 'bounce_support' || a.type === 'bounce_resistance');
  if (bounce) return { label: 'Bounced', color: colors.amber, bg: `${colors.amber}22` };

  const active = result.channels.find((c) => c.status === 'active');
  if (active) return { label: 'In channel', color: colors.textDim, bg: `${colors.textDim}18` };

  return { label: 'No channel', color: colors.textDim, bg: `${colors.textDim}18` };
}

export function Watchlist({ results, names }: { results: ScanResult[]; names: Record<string, string> }) {
  const sorted = [...results].sort((a, b) => urgencyScore(a) - urgencyScore(b));

  if (sorted.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data yet.</Text>
      </View>
    );
  }

  return (
    <View>
      {sorted.map((result) => {
        const last = result.candles[result.candles.length - 1];
        const status = statusFor(result);
        return (
          <Link key={result.symbol} href={{ pathname: '/symbol/[symbol]', params: { symbol: result.symbol } }} asChild>
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
              <View>
                <Text style={styles.symbol}>{result.symbol}</Text>
                <Text style={styles.name}>{names[result.symbol] ?? ''}</Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.price}>{last ? formatPrice(last.close) : '—'}</Text>
                <View style={[styles.pill, { backgroundColor: status.bg }]}>
                  <Text style={[styles.pillText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
            </Pressable>
          </Link>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.bgPanel,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.bgPanelHover,
  },
  symbol: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  name: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  price: {
    color: colors.text,
    fontSize: 13,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
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
