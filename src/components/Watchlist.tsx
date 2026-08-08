import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ScanResult } from '../lib/types';
import { getSignalDetail } from '../lib/scan';
import { formatPrice } from '../lib/format';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const RISK_COLOR = { low: colors.green, medium: colors.amber, high: colors.red } as const;
const STRENGTH_LABEL = { high: 'High', medium: 'Med', low: 'Low' } as const;

function signalPill(result: ScanResult): {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  const detail = getSignalDetail(result);
  const has = (t: string) => result.alerts.some((a) => a.type === t);

  if (detail.signal === 'buy') {
    return {
      label: 'BUY · Bounce',
      color: colors.green,
      bg: `${colors.green}26`,
      icon: 'trending-up',
    };
  }
  if (detail.signal === 'sell') {
    return {
      label: has('breakdown') ? 'SELL · Breakdown' : 'SELL · Rejected',
      color: colors.red,
      bg: `${colors.red}26`,
      icon: 'trending-down',
    };
  }
  if (detail.signal === 'watch_support') {
    return { label: 'WATCH · Support', color: colors.amber, bg: `${colors.amber}26`, icon: 'eye' };
  }
  if (detail.signal === 'watch_resistance') {
    return { label: 'WATCH · Resistance', color: colors.amber, bg: `${colors.amber}26`, icon: 'eye' };
  }

  const active = result.channels.some((c) => c.status === 'active');
  return active
    ? { label: 'In channel', color: colors.textDim, bg: `${colors.textDim}1a`, icon: 'radio-outline' }
    : { label: 'No channel', color: colors.textDim, bg: `${colors.textDim}1a`, icon: 'ellipse-outline' };
}

export function Watchlist({ results, names }: { results: ScanResult[]; names: Record<string, string> }) {
  if (results.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="moon-outline" size={18} color={colors.textDim} />
        <Text style={styles.emptyText}>Nothing here right now.</Text>
      </View>
    );
  }

  return (
    <View>
      {results.map((result) => {
        const last = result.candles[result.candles.length - 1];
        const pill = signalPill(result);
        const detail = getSignalDetail(result);
        return (
          <Link key={result.symbol} href={{ pathname: '/symbol/[symbol]', params: { symbol: result.symbol } }} asChild>
            <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={[styles.accentBar, { backgroundColor: pill.color }]} />
              <View style={styles.left}>
                <Text style={styles.symbol}>{result.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {names[result.symbol] ?? ''}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.price}>{last ? formatPrice(last.close) : '—'}</Text>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Ionicons name={pill.icon} size={11} color={pill.color} />
                  <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
                </View>
                {detail.strengthTier && (
                  <Text style={styles.detailText}>
                    {detail.strengthPct?.toFixed(1)}% move · {STRENGTH_LABEL[detail.strengthTier]} strength
                    {detail.risk && (
                      <Text style={{ color: RISK_COLOR[detail.risk] }}> · {detail.risk} risk</Text>
                    )}
                  </Text>
                )}
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
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  detailText: {
    color: colors.textDim,
    fontSize: 9,
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
  },
});
