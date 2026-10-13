import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { useScanData } from '../../hooks/ScanDataProvider';
import { ALL_SYMBOLS } from '../../lib/data/symbols';
import { evaluateAllSwingSetups, type SwingSetup } from '../../lib/swingSetup';
import { computeTestNumberStats, filterObservations, type SupportTestObservation } from '../../lib/supportReliability';
import { SwingSetupCard } from '../../components/SwingSetupCard';
import { SectionHeader } from '../../components/SectionHeader';
import { Disclaimer } from '../../components/Disclaimer';
import { colors, radius, spacing } from '../../constants/theme';

const names = Object.fromEntries(ALL_SYMBOLS.map((s) => [s.symbol, s.name]));

type FilterTab = 'all' | 'horizontal' | 'ascending' | 'near_support' | 'bounce_confirmed' | 'breakdown_watch' | 'broken';

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'horizontal', label: 'Horizontal Ranges' },
  { key: 'ascending', label: 'Ascending Channels' },
  { key: 'near_support', label: 'Near Support' },
  { key: 'bounce_confirmed', label: 'Bounce Confirmed' },
  { key: 'breakdown_watch', label: 'Breakdown Watch' },
  { key: 'broken', label: 'Broken Ranges' },
];

type SortKey = 'overall' | 'width' | 'upside' | 'breakdownRisk' | 'distanceFromSupport' | 'rewardRisk';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'overall', label: 'Overall Score' },
  { key: 'width', label: 'Channel Width' },
  { key: 'upside', label: 'Actual Upside' },
  { key: 'breakdownRisk', label: 'Breakdown Risk' },
  { key: 'distanceFromSupport', label: 'Distance From Support' },
  { key: 'rewardRisk', label: 'Reward:Risk' },
];

const TOP_N = 20;

function matchesFilter(setup: SwingSetup, filter: FilterTab): boolean {
  switch (filter) {
    case 'all':
      return setup.rangeHealth !== 'broken';
    case 'horizontal':
      return setup.patternType === 'horizontal_range' && setup.rangeHealth !== 'broken';
    case 'ascending':
      return setup.patternType === 'ascending_channel' && setup.rangeHealth !== 'broken';
    case 'near_support':
      return setup.channelPositionPct <= 35 && setup.rangeHealth !== 'broken';
    case 'bounce_confirmed':
      return setup.entryStatus === 'bounce_confirmed';
    case 'breakdown_watch':
      return setup.rangeHealth === 'weakening' || setup.rangeHealth === 'breakdown_warning';
    case 'broken':
      return setup.rangeHealth === 'broken';
  }
}

function sortSetups(setups: SwingSetup[], sort: SortKey): SwingSetup[] {
  const copy = [...setups];
  switch (sort) {
    case 'overall':
      return copy.sort((a, b) => b.overallSetupScore - a.overallSetupScore);
    case 'width':
      return copy.sort((a, b) => b.channelWidthPct - a.channelWidthPct);
    case 'upside':
      return copy.sort((a, b) => b.actualUpsidePct - a.actualUpsidePct);
    case 'breakdownRisk':
      return copy.sort((a, b) => a.breakdownRiskScore - b.breakdownRiskScore);
    case 'distanceFromSupport':
      return copy.sort((a, b) => a.channelPositionPct - b.channelPositionPct);
    case 'rewardRisk':
      return copy.sort((a, b) => (b.riskRewardPlan.rewardToRisk1 ?? -Infinity) - (a.riskRewardPlan.rewardToRisk1 ?? -Infinity));
  }
}

export default function SwingScannerScreen() {
  const { crypto, stocks } = useScanData();
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortKey>('overall');

  const allResults = useMemo(() => [...Object.values(crypto.results), ...Object.values(stocks.results)], [crypto.results, stocks.results]);

  const allSetups = useMemo(() => evaluateAllSwingSetups(allResults), [allResults]);

  const filtered = useMemo(() => sortSetups(allSetups.filter((s) => matchesFilter(s, filter)), sort).slice(0, TOP_N), [allSetups, filter, sort]);

  const reliabilityStats = useMemo(() => {
    const observations: SupportTestObservation[] = [];
    for (const setup of allSetups) {
      for (const record of setup.testRecords) {
        observations.push({ symbol: setup.symbol, record, channelType: setup.patternType === 'horizontal_range' ? 'horizontal' : 'ascending', widthPct: setup.channelWidthPct });
      }
    }
    return computeTestNumberStats(observations);
  }, [allSetups]);

  const loading = crypto.loading || stocks.loading;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Swing Scanner</Text>
        <Text style={styles.subtitle}>Wide horizontal ranges &amp; ascending channels, 15-30% preferred</Text>
        <Disclaimer compact />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {FILTER_TABS.map((tab) => (
          <Pressable key={tab.key} onPress={() => setFilter(tab.key)} style={[styles.chip, filter === tab.key && styles.chipActive]}>
            <Text style={[styles.chipText, filter === tab.key && styles.chipTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sortLabel}>Sort by</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {SORT_OPTIONS.map((opt) => (
          <Pressable key={opt.key} onPress={() => setSort(opt.key)} style={[styles.sortChip, sort === opt.key && styles.chipActive]}>
            <Text style={[styles.chipText, sort === opt.key && styles.chipTextActive]}>{opt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <SectionHeader title="Qualifying Setups" count={filtered.length} color={colors.green} icon="trending-up" />
      {loading && filtered.length === 0 ? (
        <Text style={styles.emptyText}>Scanning…</Text>
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>Nothing matches this filter right now.</Text>
      ) : (
        filtered.map((setup) => <SwingSetupCard key={setup.symbol} setup={setup} name={names[setup.symbol] ?? setup.symbol} />)
      )}

      <SectionHeader title="Support Reliability" color={colors.blue} icon="analytics" />
      <Text style={styles.reliabilityIntro}>
        Real historical bounce/breakdown rates by test number, pooled across every symbol currently scanned. Each stock counts as one
        cluster, not one observation per test — see the methodology note below.
      </Text>
      <View style={styles.reliabilityCard}>
        {reliabilityStats.length === 0 ? (
          <Text style={styles.emptyText}>Not enough scanned history yet to compute this.</Text>
        ) : (
          reliabilityStats.map((bucket) => (
            <View key={bucket.testNumberLabel} style={styles.reliabilityRow}>
              <Text style={styles.reliabilityTest}>{bucket.testNumberLabel} test</Text>
              {bucket.insufficientEvidence ? (
                <Text style={styles.insufficientText}>Insufficient historical evidence ({bucket.clusterCount} stocks).</Text>
              ) : (
                <Text style={styles.reliabilityDetail}>
                  Bounce {(bucket.bounceSuccessRate! * 100).toFixed(0)}% (95% CI {(bucket.confidenceIntervalLow! * 100).toFixed(0)}-
                  {(bucket.confidenceIntervalHigh! * 100).toFixed(0)}%) · Breakdown {(bucket.breakdownRate! * 100).toFixed(0)}% · n=
                  {bucket.sampleSize} across {bucket.clusterCount} stocks
                  {bucket.avgBouncePct != null ? ` · avg bounce +${bucket.avgBouncePct.toFixed(1)}%` : ''}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
      <Text style={styles.methodologyNote}>
        Business Quality scoring and Business Insider discovery are not available in this build — no fundamentals data source or
        licensed news feed is connected. The Overall Setup Score is renormalized across the remaining factors rather than silently
        scoring out of 75.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 140,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: 4,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  sortLabel: {
    color: colors.textDim,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: `${colors.accent}22`,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  reliabilityIntro: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  reliabilityCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  reliabilityRow: {
    gap: 2,
  },
  reliabilityTest: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  reliabilityDetail: {
    color: colors.textDim,
    fontSize: 11,
    lineHeight: 15,
  },
  insufficientText: {
    color: colors.amber,
    fontSize: 11,
    fontStyle: 'italic',
  },
  methodologyNote: {
    color: colors.textDim,
    fontSize: 10,
    lineHeight: 14,
    opacity: 0.8,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
});
