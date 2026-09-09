import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BounceSetupCandidate, BounceStatus } from '../lib/bounceSetup';
import { formatPrice } from '../lib/format';
import { formatChannelAge } from '../lib/channelAge';
import { findSymbol } from '../lib/data/symbols';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const STATUS_META: Record<BounceStatus, { label: string; color: string }> = {
  early_bounce: { label: 'EARLY BOUNCE', color: colors.green },
  near_support: { label: 'NEAR SUPPORT', color: colors.amber },
  in_channel: { label: 'IN CHANNEL', color: colors.textDim },
  breaking: { label: 'CHANNEL BREAKING', color: colors.red },
};

export function BounceSetupCard({ candidate, name }: { candidate: BounceSetupCandidate; name: string }) {
  const status = STATUS_META[candidate.status];
  const kind = findSymbol(candidate.symbol)?.kind === 'stock' ? 'stock' : 'crypto';
  const price = (n: number) => formatPrice(n, kind);

  return (
    <Link href={{ pathname: '/symbol/[symbol]', params: { symbol: candidate.symbol } }} asChild>
      <Pressable style={styles.card}>
        <View style={[styles.accentBar, { backgroundColor: status.color }]} />
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.symbol}>{candidate.symbol}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </View>
          <Text style={styles.currentPrice}>{price(candidate.currentPrice)}</Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: `${status.color}1f`, borderColor: status.color }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>

        <View style={styles.grid}>
          <Cell label="Support" value={price(candidate.support)} />
          <Cell label="Resistance" value={price(candidate.resistance)} />
          <Cell label="Distance from Support" value={`${candidate.distanceFromSupportPct >= 0 ? '+' : ''}${candidate.distanceFromSupportPct.toFixed(1)}%`} />
          <Cell label="Upside to Resistance" value={`+${candidate.roomToResistancePct.toFixed(1)}%`} valueColor={colors.green} />
          <Cell label="Support Touches" value={String(candidate.supportTouches)} />
          <Cell label="RSI(14)" value={candidate.rsi != null ? candidate.rsi.toFixed(0) : '—'} />
          <Cell label="Channel Age" value={formatChannelAge(candidate.channelAgeDays)} />
          <Cell label="Setup Score" value={candidate.rankScore.toFixed(0)} />
        </View>

        <Text style={styles.reason}>{candidate.reason}</Text>
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
    fontSize: 16,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
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
  reason: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
  },
});
