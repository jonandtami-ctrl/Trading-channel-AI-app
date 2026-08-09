import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useScanner } from '../../hooks/useScanner';
import { findSymbol } from '../../lib/data/symbols';
import { formatPrice } from '../../lib/format';
import { getSignal } from '../../lib/scan';
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
import { AlertsFeed } from '../../components/AlertsFeed';
import { SectionHeader } from '../../components/SectionHeader';
import { TimeframeSelector } from '../../components/TimeframeSelector';
import { TradeModal } from '../../components/TradeModal';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

const DETAIL_REFRESH_MS = 60 * 1000;

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
  const [timeframe, setTimeframe] = useState<Timeframe>(DEFAULT_TIMEFRAME);
  const { results, loading } = useScanner(info ? [info] : [], DETAIL_REFRESH_MS, timeframe);
  const result = symbol ? results[symbol] : undefined;

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
        <View style={styles.priceRow}>
          <Text style={styles.price}>{last ? formatPrice(last.close) : '—'}</Text>
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
            Open: {openTrade.quantity} @ {formatPrice(openTrade.entryPrice)} · unrealized{' '}
            {unrealizedPnl(openTrade, last.close) >= 0 ? '+' : ''}
            {formatPrice(unrealizedPnl(openTrade, last.close))}
          </Text>
        )}
      </View>

      <TimeframeSelector selected={timeframe} onSelect={setTimeframe} />

      <View style={styles.chartWrap}>
        <ZoomableChart candles={result.candles} channels={result.channels} />
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
        <View style={styles.spinnerWrap}>
          <Text style={styles.spinnerText}>No active channel — price isn&apos;t currently consolidating.</Text>
        </View>
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
  chartWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
