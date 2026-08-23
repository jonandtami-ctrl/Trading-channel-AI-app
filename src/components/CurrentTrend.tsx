import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { Candle, Level } from '../lib/types';
import { findPivots } from '../lib/pivots';
import { classifyTrend, type TrendDirection } from '../lib/trend';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const TREND_META: Record<TrendDirection, { icon: keyof typeof Ionicons.glyphMap; color: string; note: string }> = {
  strong_uptrend: {
    icon: 'trending-up',
    color: colors.green,
    note: "Price is trending, not range-bound — there's no defined support/resistance to trade against right now.",
  },
  uptrend: {
    icon: 'trending-up',
    color: colors.green,
    note: "Price is trending, not range-bound — there's no defined support/resistance to trade against right now.",
  },
  sideways: {
    icon: 'remove',
    color: colors.textDim,
    note: 'Moving without a clear direction, but not tight or well-touched enough yet to call it a real channel.',
  },
  downtrend: {
    icon: 'trending-down',
    color: colors.red,
    note: "Price is trending down, not range-bound — there's no defined support/resistance to trade against right now.",
  },
  strong_downtrend: {
    icon: 'trending-down',
    color: colors.red,
    note: "Price is trending down, not range-bound — there's no defined support/resistance to trade against right now.",
  },
};

/** Shown in place of a trade plan when there's no active channel — still says something about what price is actually doing. */
export function CurrentTrend({ candles, levels = [] }: { candles: Candle[]; levels?: Level[] }) {
  if (candles.length < 2) return null;

  const pivots = findPivots(candles, 5);
  const trend = classifyTrend(pivots);
  const meta = TREND_META[trend.direction];

  // The chart above draws these same support/resistance levels as dashed
  // "level forming" lines even when they haven't paired up into a channel
  // detectChannels is willing to call active (touches too spread out, not
  // contained tightly enough, etc). Saying "no active channel" with zero
  // context reads as contradicting lines the user is looking at right
  // above it — name what's actually going on instead.
  const hasFormingRange = levels.some((l) => l.type === 'support') && levels.some((l) => l.type === 'resistance');
  const subtitle = hasFormingRange ? 'Levels forming, not a confirmed channel yet' : 'No active channel right now';
  const note = hasFormingRange
    ? "The dashed lines above are real support/resistance touches — they just haven't lined up into a channel tight and recent enough (within about a month) to call it a confirmed swing setup yet."
    : meta.note;

  const first = candles[0];
  const last = candles[candles.length - 1];
  const changePct = ((last.close - first.close) / first.close) * 100;
  const periodHigh = Math.max(...candles.map((c) => c.high));
  const periodLow = Math.min(...candles.map((c) => c.low));
  const offHighPct = ((periodHigh - last.close) / periodHigh) * 100;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: `${meta.color}1f` }]}>
          <Ionicons name={meta.icon} size={16} color={meta.color} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: meta.color }]}>{trend.label}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Stat
          label="This period"
          value={`${changePct >= 0 ? '+' : ''}${changePct.toFixed(1)}%`}
          color={changePct >= 0 ? colors.green : colors.red}
        />
        <Stat
          label="Off period high"
          value={offHighPct < 0.5 ? 'At high' : `-${offHighPct.toFixed(1)}%`}
          color={offHighPct < 0.5 ? colors.green : colors.textDim}
        />
      </View>

      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    gap: spacing.sm,
    ...cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  stat: {
    gap: 1,
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 10,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  note: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
  },
});
