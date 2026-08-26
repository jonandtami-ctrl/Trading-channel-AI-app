import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import type { TradePlan } from '../lib/tradePlan';
import { calculatePositionSize } from '../lib/positionSize';
import type { TradeSettings } from '../lib/tradeSettingsStorage';
import { formatPrice } from '../lib/format';
import { findSymbol } from '../lib/data/symbols';
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
  const priceKind = findSymbol(plan.symbol)?.kind === 'stock' ? 'stock' : 'crypto';
  const price = (n: number) => formatPrice(n, priceKind);

  return (
    <View style={styles.card}>
      <View style={[styles.statusBanner, { backgroundColor: `${statusColor}1f`, borderColor: statusColor }]}>
        <Text style={[styles.statusText, { color: statusColor }]}>{plan.finalStatusLabel}</Text>
        <Text style={styles.reasonText}>{plan.reason}</Text>
      </View>

      <View style={styles.metaLine}>
        <Text style={styles.metaLineText}>
          {plan.trendLabel} · <Text style={{ textTransform: 'capitalize' }}>{plan.channelDirection}</Text> ·{' '}
          {plan.channelStateLabel}
        </Text>
        <Text style={styles.scoreText}>{plan.qualityScore}/100</Text>
      </View>
      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, { width: `${plan.qualityScore}%`, backgroundColor: scoreColor(plan.qualityScore) }]} />
      </View>

      <View style={styles.grid}>
        <Cell label="Support" value={price(plan.support)} />
        <Cell label="Resistance" value={price(plan.resistance)} />
        <Cell label="Setup type" value={plan.setupType} />
        <Cell label="Last touched" value={touchRecencyLabel(plan.lastTouchDaysAgo)} />
        <Cell label="Proven cycles" value={cyclesLabel(plan.completedCycles, plan.cycleWindowDays)} />
        {plan.entryQuality && <Cell label="Entry quality" value={ENTRY_QUALITY_LABEL[plan.entryQuality]} />}
        <Cell label="Volume" value={`${VOLUME_LABEL[plan.volumeLevel]} (${plan.volumeRatio.toFixed(1)}×)`} />
        {plan.entryZoneLow != null && plan.entryZoneHigh != null && (
          <Cell label="Entry zone" value={`${price(plan.entryZoneLow)} – ${price(plan.entryZoneHigh)}`} wide />
        )}
      </View>

      {plan.confirmationNeeded && (
        <View style={styles.confirmationBox}>
          <Ionicons name="hourglass-outline" size={13} color={colors.blue} />
          <Text style={styles.confirmationText}>{plan.confirmationNeeded}</Text>
        </View>
      )}

      {plan.stopLoss != null && plan.target1 != null && (
        <View style={styles.planBox}>
          <View style={styles.planRow}>
            <PlanFigure label="Stop" value={price(plan.stopLoss)} sub={`${plan.stopPct?.toFixed(1)}%`} color={colors.red} />
            <PlanFigure label="Target 1" value={price(plan.target1)} sub={`+${plan.potentialGainPct?.toFixed(1)}%`} color={colors.green} />
            {plan.target2 != null && <PlanFigure label="Target 2" value={price(plan.target2)} color={colors.green} />}
          </View>
          {(plan.riskRewardRatio != null || position) && (
            <Text style={styles.positionText}>
              {plan.riskRewardRatio != null && (
                <>
                  R:R <Text style={{ fontWeight: '800', color: colors.text }}>1 : {plan.riskRewardRatio.toFixed(1)}</Text>
                  {position && '  ·  '}
                </>
              )}
              {position && (
                <>
                  <Text style={{ fontWeight: '800', color: colors.text }}>{position.shares.toLocaleString()} shares</Text> @{' '}
                  {tradeSettings.riskPct}% risk (~${position.dollarRisk.toFixed(2)})
                </>
              )}
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

function Cell({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.cell, wide && styles.cellWide]}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
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

function touchRecencyLabel(daysAgo: number): string {
  if (daysAgo <= 0) return 'Today';
  if (daysAgo === 1) return '1 day ago';
  return `${daysAgo} days ago`;
}

function cyclesLabel(count: number, windowDays: number): string {
  if (count === 0) return `None (${windowDays}d)`;
  return `${count}× (${windowDays}d)`;
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
  metaLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metaLineText: {
    flex: 1,
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  scoreTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  scoreFill: {
    height: 4,
    borderRadius: 2,
  },
  scoreText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '46%',
    gap: 1,
  },
  cellWide: {
    width: '100%',
  },
  cellLabel: {
    color: colors.textDim,
    fontSize: 10,
  },
  cellValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
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
