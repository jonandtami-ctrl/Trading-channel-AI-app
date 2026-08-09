import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { TradePlan } from '../lib/tradePlan';
import { calculatePositionSize } from '../lib/positionSize';
import type { TradeSettings } from '../lib/tradeSettingsStorage';
import { formatPrice } from '../lib/format';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const STATUS_COLOR: Record<string, string> = {
  '🟢': colors.green,
  '🟡': colors.amber,
  '🔴': colors.red,
  '⚪': colors.textDim,
};

const VOLUME_LABEL: Record<TradePlan['volumeLevel'], string> = {
  high: 'High',
  elevated: 'Elevated',
  normal: 'Normal',
  low: 'Low',
};

const ENTRY_QUALITY_LABEL: Record<NonNullable<TradePlan['entryQuality']>, string> = {
  excellent: 'Excellent',
  good: 'Good',
  acceptable: 'Acceptable',
  late: 'Late',
  poor: 'Poor',
};

export function TradePlanCard({ plan, tradeSettings }: { plan: TradePlan; tradeSettings: TradeSettings }) {
  const statusColor = STATUS_COLOR[plan.finalStatusLabel.slice(0, 2).trim()] ?? colors.textDim;
  const position =
    plan.stopLoss != null ? calculatePositionSize(tradeSettings.accountSize, tradeSettings.riskPct, plan.currentPrice, plan.stopLoss) : null;

  return (
    <View style={styles.card}>
      <View style={[styles.statusBanner, { backgroundColor: `${statusColor}1f`, borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{plan.finalStatusLabel}</Text>
        <Text style={styles.reasonText}>{plan.reason}</Text>
      </View>

      <View style={styles.metaRow}>
        <MetaChip icon="trending-up-outline" label={plan.trendLabel} />
        <MetaChip icon="git-commit-outline" label={plan.channelDirection} capitalize />
        <MetaChip icon="location-outline" label={plan.channelStateLabel} />
      </View>

      <View style={styles.scoreRow}>
        <View style={styles.scoreTrack}>
          <View style={[styles.scoreFill, { width: `${plan.qualityScore}%`, backgroundColor: scoreColor(plan.qualityScore) }]} />
        </View>
        <Text style={styles.scoreText}>{plan.qualityScore}/100</Text>
      </View>

      <View style={styles.grid}>
        <Row label="Support" value={formatPrice(plan.support)} />
        <Row label="Resistance" value={formatPrice(plan.resistance)} />
        <Row label="Setup type" value={plan.setupType} />
        {plan.entryQuality && <Row label="Entry quality" value={ENTRY_QUALITY_LABEL[plan.entryQuality]} />}
        <Row label="Volume" value={`${VOLUME_LABEL[plan.volumeLevel]} (${plan.volumeRatio.toFixed(1)}×)`} />
      </View>

      {plan.entryZoneLow != null && plan.entryZoneHigh != null && (
        <Row label="Entry zone" value={`${formatPrice(plan.entryZoneLow)} – ${formatPrice(plan.entryZoneHigh)}`} />
      )}

      {plan.confirmationNeeded && (
        <View style={styles.confirmationBox}>
          <Ionicons name="hourglass-outline" size={13} color={colors.blue} />
          <Text style={styles.confirmationText}>{plan.confirmationNeeded}</Text>
        </View>
      )}

      {plan.stopLoss != null && plan.target1 != null && (
        <View style={styles.planBox}>
          <View style={styles.planRow}>
            <PlanFigure label="Stop" value={formatPrice(plan.stopLoss)} sub={`${plan.stopPct?.toFixed(1)}%`} color={colors.red} />
            <PlanFigure label="Target 1" value={formatPrice(plan.target1)} sub={`+${plan.potentialGainPct?.toFixed(1)}%`} color={colors.green} />
            {plan.target2 != null && <PlanFigure label="Target 2" value={formatPrice(plan.target2)} color={colors.green} />}
          </View>
          {plan.riskRewardRatio != null && (
            <Text style={styles.rrText}>
              Risk/Reward = <Text style={{ fontWeight: '800', color: colors.text }}>1 : {plan.riskRewardRatio.toFixed(1)}</Text>
            </Text>
          )}
          {position && (
            <Text style={styles.positionText}>
              Suggested size @ {tradeSettings.riskPct}% risk of ${tradeSettings.accountSize.toLocaleString()}:{' '}
              <Text style={{ fontWeight: '800', color: colors.text }}>{position.shares.toLocaleString()} shares</Text> (~
              {formatPrice(position.dollarRisk)} at risk)
            </Text>
          )}
        </View>
      )}

      {plan.warnings.length > 0 && (
        <View style={styles.warningsBox}>
          {plan.warnings.map((w, i) => (
            <View key={i} style={styles.warningRow}>
              <Ionicons name="warning-outline" size={12} color={colors.amber} />
              <Text style={styles.warningText}>{w}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MetaChip({ icon, label, capitalize }: { icon: keyof typeof Ionicons.glyphMap; label: string; capitalize?: boolean }) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={11} color={colors.textDim} />
      <Text style={[styles.metaChipText, capitalize && { textTransform: 'capitalize' }]}>{label}</Text>
    </View>
  );
}

function PlanFigure({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <View style={styles.planFigure}>
      <Text style={styles.planFigureLabel}>{label}</Text>
      <Text style={[styles.planFigureValue, { color }]}>{value}</Text>
      {sub && <Text style={styles.planFigureSub}>{sub}</Text>}
    </View>
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return colors.green;
  if (score >= 60) return colors.amber;
  return colors.red;
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
  statusBanner: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  reasonText: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaChipText: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scoreTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 48,
    textAlign: 'right',
  },
  grid: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  rowLabel: {
    color: colors.textDim,
    fontSize: 12,
  },
  rowValue: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  confirmationBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: `${colors.blue}14`,
  },
  confirmationText: {
    flex: 1,
    color: colors.blue,
    fontSize: 11,
    lineHeight: 15,
  },
  planBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgPanel,
    gap: 6,
  },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planFigure: {
    alignItems: 'center',
    gap: 1,
  },
  planFigureLabel: {
    color: colors.textDim,
    fontSize: 9,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  planFigureValue: {
    fontSize: 13,
    fontWeight: '800',
  },
  planFigureSub: {
    color: colors.textDim,
    fontSize: 9,
  },
  rrText: {
    color: colors.textDim,
    fontSize: 11,
    textAlign: 'center',
  },
  positionText: {
    color: colors.textDim,
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  warningsBox: {
    gap: 4,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
  },
  warningText: {
    flex: 1,
    color: colors.amber,
    fontSize: 10,
    lineHeight: 14,
  },
});
