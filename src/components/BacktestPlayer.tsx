import { useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BacktestResult } from '../lib/backtest';
import type { Candle, Channel } from '../lib/types';
import { formatDate } from '../lib/format';
import { CandleChart, type ChartMarker } from './CandleChart';
import { cardShadow, colors, radius, spacing } from '../constants/theme';

const TICK_MS = 50;
const TARGET_TICKS = 130;

export function BacktestPlayer({
  candles,
  channel,
  backtest,
}: {
  candles: Candle[];
  channel: Channel;
  backtest: BacktestResult;
}) {
  const [revealCount, setRevealCount] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const step = Math.max(1, Math.ceil(candles.length / TARGET_TICKS));
  const finished = revealCount >= candles.length;

  useEffect(() => {
    if (playing && !finished) {
      timerRef.current = setInterval(() => {
        setRevealCount((n) => {
          const next = n + step * speed;
          if (next >= candles.length) {
            setPlaying(false);
            return candles.length;
          }
          return next;
        });
      }, TICK_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, finished, step, speed, candles.length]);

  const markers: ChartMarker[] = useMemo(
    () =>
      backtest.trades.flatMap((t) => [
        { index: t.entryIndex, side: 'buy' as const },
        { index: t.exitIndex, side: 'sell' as const },
      ]),
    [backtest.trades]
  );

  const closedTrades = backtest.trades.filter((t) => t.exitIndex < revealCount);
  const openTrade = backtest.trades.find((t) => t.entryIndex < revealCount && t.exitIndex >= revealCount);
  const runningPnl = closedTrades.reduce((sum, t) => sum + t.pnlPct, 0);
  const wins = closedTrades.filter((t) => t.pnlPct > 0).length;
  const losses = closedTrades.filter((t) => t.pnlPct <= 0).length;
  const progressPct = Math.min(100, (revealCount / candles.length) * 100);

  function handlePlayPause() {
    if (finished) {
      setRevealCount(2);
      setPlaying(true);
    } else {
      setPlaying((p) => !p);
    }
  }

  function handleRestart() {
    setRevealCount(2);
    setPlaying(true);
  }

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleIcon}>
          <Ionicons name="flask" size={13} color={colors.purple} />
        </View>
        <Text style={styles.title}>Test Mode — Replay</Text>
      </View>
      <Text style={styles.subtitle}>
        Hypothetical, not real trades — watch every historical support buy / resistance sell play out. No fees or
        slippage modeled.
      </Text>

      <View style={styles.chartWrap}>
        <CandleChart candles={candles} channels={[channel]} markers={markers} revealCount={revealCount} height={180} />
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
      </View>

      <View style={styles.controlsRow}>
        <Pressable style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons name={finished ? 'refresh' : playing ? 'pause' : 'play'} size={16} color="#fff" />
          <Text style={styles.playButtonText}>{finished ? 'Replay' : playing ? 'Pause' : 'Play'}</Text>
        </Pressable>
        <Pressable style={styles.iconButton} onPress={handleRestart}>
          <Ionicons name="play-skip-back" size={14} color={colors.textDim} />
        </Pressable>
        <Pressable style={styles.speedButton} onPress={() => setSpeed((s) => (s === 1 ? 2 : 1))}>
          <Text style={styles.speedText}>{speed}×</Text>
        </Pressable>
        {openTrade && !finished && (
          <View style={styles.openBadge}>
            <View style={styles.openDot} />
            <Text style={styles.openBadgeText}>in position</Text>
          </View>
        )}
      </View>

      <View style={styles.statsRow}>
        <StatBox label="Trades" value={String(closedTrades.length)} color={colors.text} />
        <StatBox label="Wins" value={String(wins)} color={colors.green} />
        <StatBox label="Losses" value={String(losses)} color={colors.red} />
        <StatBox
          label="Return"
          value={`${runningPnl >= 0 ? '+' : ''}${runningPnl.toFixed(1)}%`}
          color={runningPnl >= 0 ? colors.green : colors.red}
        />
      </View>

      {finished && backtest.trades.length > 0 && (
        <Text style={styles.finishedNote}>
          Full history replayed · last simulated exit {formatDate(backtest.trades[backtest.trades.length - 1].exitTime)}
        </Text>
      )}
    </View>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.purple,
    borderRadius: radius.md,
    backgroundColor: `${colors.purple}14`,
    ...cardShadow,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.purple}26`,
  },
  title: {
    color: colors.purple,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 11,
    marginTop: 4,
    marginBottom: spacing.sm,
    lineHeight: 15,
  },
  chartWrap: {
    marginBottom: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: 4,
    backgroundColor: colors.purple,
    borderRadius: 2,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.purple,
  },
  playButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedButton: {
    width: 36,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedText: {
    color: colors.textDim,
    fontSize: 11,
    fontWeight: '700',
  },
  openBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: `${colors.green}22`,
  },
  openDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.green,
  },
  openBadgeText: {
    color: colors.green,
    fontSize: 9,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.bgCard,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textDim,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  finishedNote: {
    color: colors.textDim,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
