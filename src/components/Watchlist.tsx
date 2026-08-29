import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ScanResult } from '../lib/types';
import { getSignalDetail } from '../lib/scan';
import { formatPrice } from '../lib/format';
import { findSymbol } from '../lib/data/symbols';
import { channelAgeDays, formatChannelAge } from '../lib/channelAge';
import { MiniChannelChart } from './MiniChannelChart';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

function priceOf(result: ScanResult): string {
  const last = result.candles[result.candles.length - 1];
  if (!last) return '—';
  return formatPrice(last.close, findSymbol(result.symbol)?.kind === 'stock' ? 'stock' : 'crypto');
}

const RISK_COLOR = { low: colors.green, medium: colors.amber, high: colors.red } as const;
const STRENGTH_LABEL = { high: 'High', medium: 'Med', low: 'Low' } as const;

// The strict "buy" signal everywhere else in the app requires the NEOS
// engine's full confirmation-candle + quality-score gate — calibrated for
// a ~1-month swing entry, where waiting for that confirmation actually
// matters. On a wide, ~1-year value-channel view (see topActivePicks) that
// bar is a mismatch: a large cap sitting right at support IS the buy zone
// for that timescale, so wideView reads the plan's raw channelState
// instead of waiting on swing-trade confirmation.
function wideViewPill(result: ScanResult): {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
} | null {
  const state = result.tradePlan?.channelState;
  if (state === 'support_sweep_reclaim') {
    // The sweep and reclaim are confirmed either way (that's what got the
    // setup detected at all) — but a poor risk/reward still shouldn't read
    // as a confident green BUY, same as everywhere else this app makes
    // that call.
    return result.tradePlan?.finalStatus === 'support_sweep_reclaim_confirmed'
      ? { label: 'BUY · Sweep Reclaim', color: colors.green, bg: `${colors.green}26`, icon: 'trending-up' }
      : { label: 'WATCH · Sweep Reclaim', color: colors.amber, bg: `${colors.amber}26`, icon: 'eye' };
  }
  if (state === 'bouncing_from_support' || state === 'at_support') {
    return { label: 'BUY · At Support', color: colors.green, bg: `${colors.green}26`, icon: 'trending-up' };
  }
  if (state === 'channel_breakdown' || state === 'trending_below_channel') {
    return { label: 'SELL · Breakdown', color: colors.red, bg: `${colors.red}26`, icon: 'trending-down' };
  }
  if (state === 'approaching_resistance' || state === 'testing_resistance') {
    return { label: 'WATCH · Resistance', color: colors.amber, bg: `${colors.amber}26`, icon: 'eye' };
  }
  return null;
}

function signalPill(
  result: ScanResult,
  wideView?: boolean
): {
  label: string;
  color: string;
  bg: string;
  icon: keyof typeof Ionicons.glyphMap;
} {
  if (wideView) {
    const wide = wideViewPill(result);
    if (wide) return wide;
  }

  const detail = getSignalDetail(result);
  const has = (t: string) => result.alerts.some((a) => a.type === t);

  if (detail.signal === 'buy') {
    if (result.tradePlan?.channelState === 'support_sweep_reclaim') {
      return { label: 'BUY · Sweep Reclaim', color: colors.green, bg: `${colors.green}26`, icon: 'trending-up' };
    }
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

export function Watchlist({
  results,
  names,
  horizontal,
  showChannelAge,
  wideView,
}: {
  results: ScanResult[];
  names: Record<string, string>;
  /** Renders a swipeable row of poster-style cards instead of the default stacked list. */
  horizontal?: boolean;
  /** Shows how long the displayed channel has persisted — meant for long-term value views, not swing signals. */
  showChannelAge?: boolean;
  /** Reads the badge off the raw channel state instead of the swing-trade confirmation gate — see wideViewPill. */
  wideView?: boolean;
}) {
  if (results.length === 0) {
    return (
      <View style={styles.empty}>
        <Ionicons name="moon-outline" size={18} color={colors.textDim} />
        <Text style={styles.emptyText}>Nothing here right now.</Text>
      </View>
    );
  }

  if (horizontal) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
        {results.map((result) => {
          const pill = signalPill(result, wideView);
          const primaryChannel = result.channels[0];
          return (
            <Link key={result.symbol} href={{ pathname: '/symbol/[symbol]', params: { symbol: result.symbol } }} asChild>
              <Pressable style={styles.hCard}>
                <View style={[styles.hCover, { backgroundColor: pill.bg }]}>
                  {result.channels.length > 0 ? (
                    <MiniChannelChart result={result} height={64} />
                  ) : (
                    <Ionicons name={pill.icon} size={26} color={pill.color} />
                  )}
                </View>
                <Text style={styles.hSymbol}>{result.symbol}</Text>
                <Text style={styles.hName} numberOfLines={1}>
                  {names[result.symbol] ?? ''}
                </Text>
                <View style={styles.hBottomRow}>
                  <View style={styles.hPriceRow}>
                    <Text style={styles.hPrice}>{priceOf(result)}</Text>
                    {!result.isLive && <Text style={styles.demoTag}>DEMO</Text>}
                  </View>
                  <Text style={[styles.hPillText, { color: pill.color }]} numberOfLines={1}>
                    {pill.label}
                  </Text>
                  {showChannelAge && primaryChannel && (
                    <Text style={styles.hChannelAge} numberOfLines={1}>
                      In range {formatChannelAge(channelAgeDays(primaryChannel, result.candles))}
                    </Text>
                  )}
                </View>
              </Pressable>
            </Link>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View>
      {results.map((result) => {
        const pill = signalPill(result);
        const detail = getSignalDetail(result);
        return (
          <Link key={result.symbol} href={{ pathname: '/symbol/[symbol]', params: { symbol: result.symbol } }} asChild>
            <Pressable style={styles.card}>
              <View style={[styles.accentBar, { backgroundColor: pill.color }]} />
              <View style={styles.left}>
                <Text style={styles.symbol}>{result.symbol}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {names[result.symbol] ?? ''}
                </Text>
              </View>
              {result.channels.length > 0 && (
                <View style={styles.miniChartWrap}>
                  <MiniChannelChart result={result} height={40} />
                </View>
              )}
              <View style={styles.right}>
                <View style={styles.priceRow}>
                  <Text style={styles.price}>{priceOf(result)}</Text>
                  {!result.isLive && <Text style={styles.demoTag}>DEMO</Text>}
                </View>
                <View style={[styles.pill, { backgroundColor: pill.bg }]}>
                  <Ionicons name={pill.icon} size={11} color={pill.color} />
                  <Text style={[styles.pillText, { color: pill.color }]}>{pill.label}</Text>
                </View>
                {detail.strengthTier && (
                  <Text style={styles.detailText} numberOfLines={1}>
                    +{detail.strengthPct?.toFixed(1)}% · {STRENGTH_LABEL[detail.strengthTier]}
                    {detail.risk && <Text style={{ color: RISK_COLOR[detail.risk] }}> · {detail.risk}</Text>}
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
    maxWidth: 132,
  },
  miniChartWrap: {
    width: 68,
    marginRight: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  price: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  demoTag: {
    color: colors.amber,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.3,
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
  hRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  hCard: {
    width: 130,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    paddingBottom: spacing.sm,
    ...cardShadow,
  },
  hCover: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  hSymbol: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    paddingHorizontal: spacing.sm,
  },
  hName: {
    color: colors.textDim,
    fontSize: 10,
    paddingHorizontal: spacing.sm,
    marginTop: 1,
  },
  hBottomRow: {
    paddingHorizontal: spacing.sm,
    marginTop: 6,
    gap: 2,
  },
  hPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hPrice: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  hPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  hChannelAge: {
    color: colors.textDim,
    fontSize: 9,
    marginTop: 1,
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
