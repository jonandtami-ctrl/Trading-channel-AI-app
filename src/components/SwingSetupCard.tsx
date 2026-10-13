import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { SwingSetup } from '../lib/swingSetup';
import { ENTRY_STATUS_LABELS } from '../lib/entryConfirmation';
import { RANGE_HEALTH_LABELS } from '../lib/breakdownRisk';
import { formatPrice } from '../lib/format';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const STATUS_COLOR: Record<SwingSetup['entryStatus'], string> = {
  approaching_support: colors.amber,
  bounce_confirming: colors.blue,
  bounce_confirmed: colors.green,
  mid_range: colors.textDim,
  near_resistance: colors.amber,
  extended: colors.textDim,
  breakdown_warning: colors.red,
  broken: colors.red,
};

const PATTERN_LABEL: Record<SwingSetup['patternType'], string> = {
  horizontal_range: 'Horizontal Range',
  ascending_channel: 'Ascending Channel',
};

export function SwingSetupCard({ setup, name }: { setup: SwingSetup; name: string }) {
  const price = (n: number) => formatPrice(n, 'stock');
  const statusColor = STATUS_COLOR[setup.entryStatus];

  return (
    <Link href={{ pathname: '/symbol/[symbol]', params: { symbol: setup.symbol } }} asChild>
      <Pressable style={styles.card}>
        <View style={[styles.accentBar, { backgroundColor: statusColor }]} />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.symbol}>{setup.symbol}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name} · {setup.exchange}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.currentPrice}>
              {price(setup.currentPrice)} <Text style={styles.currency}>{setup.currency}</Text>
            </Text>
            <Text style={styles.pattern}>{PATTERN_LABEL[setup.patternType]}</Text>
          </View>
        </View>

        <View style={styles.pillRow}>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor}1f`, borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{ENTRY_STATUS_LABELS[setup.entryStatus]}</Text>
          </View>
          <View style={[styles.healthPill, { backgroundColor: `${colors.textDim}1a` }]}>
            <Text style={styles.healthText}>{RANGE_HEALTH_LABELS[setup.rangeHealth]}</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <Cell label="Support" value={price(setup.support)} />
          <Cell label="Resistance" value={price(setup.resistance)} />
          <Cell label="Channel Width" value={`${setup.channelWidthPct.toFixed(1)}%`} />
          <Cell label="Actual Upside" value={`+${setup.actualUpsidePct.toFixed(1)}%`} valueColor={colors.green} />
          <Cell label="Channel Position" value={`${setup.channelPositionPct.toFixed(0)}%`} />
          <Cell
            label="Reward:Risk"
            value={setup.riskRewardPlan.rewardToRisk1 != null ? `${setup.riskRewardPlan.rewardToRisk1.toFixed(1)}:1` : '—'}
          />
          <Cell label="Support Touches" value={String(setup.supportTouches)} />
          <Cell label="Channel Quality" value={`${setup.channelQualityScore.toFixed(0)}/100`} />
          <Cell label="Overall Score" value={`${setup.overallSetupScore}/100`} />
        </View>
      </Pressable>
    </Link>
  );
}

function Cell({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, valueColor && { color: valueColor }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    paddingLeft: spacing.md + 4,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: spacing.sm,
    ...cardShadow,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.sm,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  symbol: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  name: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  currentPrice: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  currency: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  pattern: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 1,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 6,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  healthPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  healthText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '31%',
    gap: 1,
  },
  cellLabel: {
    color: colors.textDim,
    fontSize: 9,
  },
  cellValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
});
