import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../../hooks/useScanner';
import { findSymbol } from '../../lib/data/symbols';
import { fetchIntradayCandles } from '../../lib/data/fetch';
import type { Candle } from '../../lib/types';
import { formatPrice, formatDate } from '../../lib/format';
import { getSignal } from '../../lib/scan';
import { recentLevels } from '../../lib/levels';
import { tradingViewUrl } from '../../lib/tradingview';
import { backtestChannel } from '../../lib/backtest';
import { computeTradePlan } from '../../lib/tradePlan';
import { DEFAULT_TIMEFRAME, type Timeframe } from '../../lib/timeframes';
import { loadPinnedSymbols, togglePin } from '../../lib/pins';
import { unrealizedPnl, type Trade } from '../../lib/journal';
import { loadTrades, logTrade, closeTrade } from '../../lib/journalStorage';
import { DEFAULT_TRADE_SETTINGS, loadTradeSettings, type TradeSettings } from '../../lib/tradeSettingsStorage';
import { LiveBadge } from '../../components/LiveBadge';
import { Disclaimer } from '../../components/Disclaimer';
import { ZoomableChart } from '../../components/ZoomableChart';
import { BacktestPlayer } from '../../components/BacktestPlayer';
import { TradePlanCard } from '../../components/TradePlanCard';
import { CurrentTrend } from '../../components/CurrentTrend';
import { AlertsFeed } from '../../components/AlertsFeed';
import { SectionHeader } from '../../components/SectionHeader';
import { TimeframeSelector } from '../../components/TimeframeSelector';
import { TradeModal } from '../../components/TradeModal';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

// A single symbol only costs 1 Twelve Data credit per refresh, so this can
// stay fairly fast, but leaving a detail screen open all day at 60s would
// still add up (1,440 credits) — 2 minutes keeps it feeling live without
// eating into the shared daily budget the dashboard scan also draws from.
const DETAIL_REFRESH_MS = 2 * 60 * 1000;

const SIGNAL_META: Record<string, { label: string; color: string }> = {
  buy: { label: 'BUY', color: colors.green },
  sell: { label: 'SELL', color: colors.red },
  watch_support: { label: 'WATCH · SUPPORT', color: colors.amber },
  watch_resistance: { label: 'WATCH · RESISTANCE', color: colors.amber },
};

export default function SymbolScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const navigation = useNavigation();
  const info = symbol ? findSymbol(symbol) : undefined;
  const priceKind = info?.kind === 'stock' ? 'stock' : 'crypto';
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const { results, loading } = useScanner(info ? [info] : [], DETAIL_REFRESH_MS);
  const result = symbol ? results[symbol] : undefined;

  // "1D" needs real intraday data — daily bars give literally one candle —
  // so it's fetched separately and lazily, only once actually selected.
  const [intraday, setIntraday] = useState<{ candles: Candle[]; isLive: boolean } | null>(null);
  useEffect(() => {
    if (timeframe.label !== '1D' || !symbol) return;
    let cancelled = false;
    setIntraday(null);
    fetchIntradayCandles(symbol).then((r) => {
      if (!cancelled) setIntraday(r);
    });
    return () => {
      cancelled = true;
    };
  }, [timeframe.label, symbol]);

  const [pinned, setPinned] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [modalMode, setModalMode] = useState<'log' | 'close' | null>(null);
  const [tradeSettings, setTradeSettings] = useState<TradeSettings>(DEFAULT_TRADE_SETTINGS);

  useEffect(() => {
    navigation.setOptions({ title: symbol ?? '' });
  }, [navigation, symbol]);

  useEffect(() => {
    if (!symbol) return;
    loadPinnedSymbols().then((pins) => setPinned(pins.includes(symbol)));
    loadTrades().then(setTrades);
    loadTradeSettings().then(setTradeSettings);
  }, [symbol]);

  if (loading && !result) {
    return (
      <View style={styles.spinnerWrap}>
        <Text style={styles.spinnerText}>loading {symbol}…</Text>
      </View>
    );
  }

  if (!result || !symbol) {
    return (
      <View style={styles.spinnerWrap}>
        <Text style={styles.spinnerText}>Symbol not found.</Text>
      </View>
    );
  }

  const last = result.candles[result.candles.length - 1];
  const signal = getSignal(result);
  const signalMeta = signal ? SIGNAL_META[signal] : null;
  const openTrade = trades.find((t) => t.symbol === symbol && t.status === 'open');

  // The scan always analyzes a full 2-year daily history; "1W"/"1M" just
  // control how much of that the chart displays, so switching between them
  // is instant (no re-fetch, no re-scan) and never comes up empty for a
  // short window. Channel lines stay unfiltered by the zoom window (they
  // already only ever reflect a touch within the last ~60 trading days,
  // and need to keep matching the exact numbers TradePlanCard shows below).
  // The lighter "forming" levels are supplementary, so those do narrow to
  // what's visible. "1D" is the odd one out — it swaps in real intraday
  // candles (see the effect above) instead of slicing the daily history.
  const isIntraday = timeframe.label === '1D';
  const sliceStart = Math.max(0, result.candles.length - timeframe.days);
  const visibleCandles = isIntraday ? intraday?.candles ?? [] : result.candles.slice(sliceStart);
  const visibleLevels = isIntraday
    ? recentLevels(result.levels, result.candles.length)
    : recentLevels(result.levels, result.candles.length).filter(
        (l) => l.touches[l.touches.length - 1].index >= sliceStart
      );

  async function handlePin() {
    const next = await togglePin(symbol!);
    setPinned(next.includes(symbol!));
  }

  async function handleSubmit(price: number, quantity: number, dateIso: string) {
    if (modalMode === 'log') {
      setTrades(await logTrade(symbol!, price, quantity, dateIso));
    } else if (modalMode === 'close' && openTrade) {
      setTrades(await closeTrade(openTrade.id, price, dateIso));
    }
    setModalMode(null);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {result.symbol} · {info?.name}
            {info?.exchange ? ` · ${info.exchange}` : ''}
          </Text>
          <LiveBadge isLive={result.isLive} />
        </View>
        {last && (
          <Text style={styles.dataAsOf}>
            Data as of {formatDate(last.time)}
            {!result.isLive && ' — demo, not a live fetch'}
          </Text>
        )}
        {result.stability && (
          <View style={styles.stableBadge}>
            <Ionicons name="shield-checkmark-outline" size={12} color={colors.green} />
            <Text style={styles.stableBadgeText}>
              Stable range · {formatPrice(result.stability.support, priceKind)}–{formatPrice(result.stability.resistance, priceKind)} · ±
              {(result.stability.widthPct / 2).toFixed(1)}%
            </Text>
          </View>
        )}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{last ? formatPrice(last.close, priceKind) : '—'}</Text>
          {signalMeta && (
            <View style={[styles.signalPill, { backgroundColor: `${signalMeta.color}26` }]}>
              <Text style={[styles.signalText, { color: signalMeta.color }]}>{signalMeta.label}</Text>
            </View>
          )}
        </View>
        {signalMeta && <Disclaimer compact />}

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionButton, pinned && styles.actionButtonActive]} onPress={handlePin}>
            <Ionicons name={pinned ? 'pin' : 'pin-outline'} size={14} color={pinned ? colors.accent : colors.textDim} />
            <Text style={[styles.actionText, pinned && styles.actionTextActive]}>{pinned ? 'Pinned' : 'Pin'}</Text>
          </Pressable>
          {openTrade ? (
            <Pressable style={[styles.actionButton, styles.actionButtonRed]} onPress={() => setModalMode('close')}>
              <Ionicons name="close-circle-outline" size={14} color={colors.red} />
              <Text style={[styles.actionText, styles.actionTextRed]}>Close Trade</Text>
            </Pressable>
          ) : (
            <Pressable style={[styles.actionButton, styles.actionButtonGreen]} onPress={() => setModalMode('log')}>
              <Ionicons name="add-circle-outline" size={14} color={colors.green} />
              <Text style={[styles.actionText, styles.actionTextGreen]}>Log Trade</Text>
            </Pressable>
          )}
        </View>

        {openTrade && last && (
          <Text style={styles.openTradeText}>
            Open: {openTrade.quantity} @ {formatPrice(openTrade.entryPrice, priceKind)} · unrealized{' '}
            {unrealizedPnl(openTrade, last.close) >= 0 ? '+' : ''}
            {formatPrice(unrealizedPnl(openTrade, last.close), priceKind)}
          </Text>
        )}
      </View>

      <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />

      <View style={styles.chartWrap}>
        {isIntraday && !intraday ? (
          <View style={styles.intradayLoading}>
            <Text style={styles.intradayLoadingText}>Loading intraday data…</Text>
          </View>
        ) : (
          <ZoomableChart candles={visibleCandles} channels={result.channels} levels={visibleLevels} />
        )}
        {info && (
          <Pressable style={styles.tvLink} onPress={() => Linking.openURL(tradingViewUrl(info))}>
            <Text style={styles.tvLinkText}>Cross-check on TradingView</Text>
            <Ionicons name="open-outline" size={12} color={colors.accent} />
          </Pressable>
        )}
      </View>

      {result.channels.length > 0 ? (
        result.channels.map((channel, i) => {
          const backtest = backtestChannel(channel);
          const plan = computeTradePlan(symbol, result.candles, channel);
          return (
            <View key={i}>
              <TradePlanCard plan={plan} tradeSettings={tradeSettings} />

              {backtest.trades.length > 0 && (
                <BacktestPlayer candles={result.candles} channel={channel} backtest={backtest} />
              )}
            </View>
          );
        })
      ) : (
        <CurrentTrend candles={visibleCandles} levels={visibleLevels} />
      )}

      <SectionHeader title="Alerts" color={colors.blue} />
      <AlertsFeed alerts={result.alerts} />

      <TradeModal
        visible={modalMode !== null}
        mode={modalMode ?? 'log'}
        symbol={symbol}
        defaultPrice={last ? Number(last.close.toFixed(4)) : 0}
        onCancel={() => setModalMode(null)}
        onSubmit={handleSubmit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    color: colors.textDim,
    fontSize: 12,
    flexShrink: 1,
  },
  dataAsOf: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  price: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '700',
  },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  signalText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    ...cardShadow,
  },
  actionButtonActive: {
    backgroundColor: `${colors.accent}26`,
    borderColor: colors.accent,
  },
  actionButtonGreen: {
    backgroundColor: `${colors.green}26`,
    borderColor: colors.green,
  },
  actionButtonRed: {
    backgroundColor: `${colors.red}26`,
    borderColor: colors.red,
  },
  actionText: {
    color: colors.textDim,
    fontSize: 12,
    fontWeight: '700',
  },
  actionTextActive: {
    color: colors.accent,
  },
  actionTextGreen: {
    color: colors.green,
  },
  actionTextRed: {
    color: colors.red,
  },
  openTradeText: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
  },
  stableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: `${colors.green}1a`,
  },
  stableBadgeText: {
    color: colors.green,
    fontSize: 10,
    fontWeight: '700',
  },
  chartWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  tvLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  tvLinkText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  intradayLoading: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intradayLoadingText: {
    color: colors.textDim,
    fontSize: 12,
  },
  spinnerWrap: {
    padding: 40,
    alignItems: 'center',
  },
  spinnerText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
});
