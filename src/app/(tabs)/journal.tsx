import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { groupTradesByYear, realizedPnl, realizedPnlPct, type Trade } from '../../lib/journal';
import { loadTrades, deleteTrade, shareTradesCsv } from '../../lib/journalStorage';
import { formatPrice } from '../../lib/format';
import { cardShadow, colors, radius, spacing } from '../../constants/theme';

export default function JournalScreen() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTrades().then((t) => {
        setTrades(t);
        setLoaded(true);
      });
    }, [])
  );

  const grouped = groupTradesByYear(trades);
  const openCount = trades.filter((t) => t.status === 'open').length;

  async function handleDelete(id: string) {
    Alert.alert('Delete trade?', 'This removes it from your journal permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => setTrades(await deleteTrade(id)),
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <Ionicons name="book" size={18} color={colors.accent} />
          </View>
          <Text style={styles.title}>Trade Journal</Text>
        </View>
        <Text style={styles.subtitle}>
          {trades.length} trade{trades.length === 1 ? '' : 's'} · {openCount} open
        </Text>
        {trades.length > 0 && (
          <Pressable style={styles.exportButton} onPress={() => shareTradesCsv(trades)}>
            <Ionicons name="share-outline" size={15} color={colors.accent} />
            <Text style={styles.exportText}>Export / Share CSV (all years)</Text>
          </Pressable>
        )}
      </View>

      {!loaded ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Loading…</Text>
        </View>
      ) : grouped.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="document-text-outline" size={22} color={colors.textDim} />
          <Text style={styles.emptyText}>
            No trades logged yet. Open any symbol and tap &quot;Log Trade&quot; to start your record.
          </Text>
        </View>
      ) : (
        grouped.map(({ year, trades: yearTrades, realizedTotal }) => (
          <View key={year}>
            <View style={styles.yearHeader}>
              <Text style={styles.yearTitle}>{year}</Text>
              <View style={styles.yearHeaderRight}>
                <Text style={[styles.yearTotal, { color: realizedTotal >= 0 ? colors.green : colors.red }]}>
                  {realizedTotal >= 0 ? '+' : ''}
                  {formatPrice(realizedTotal)} realized
                </Text>
                <Pressable style={styles.yearExportRow} onPress={() => shareTradesCsv(yearTrades, String(year))}>
                  <Ionicons name="download-outline" size={11} color={colors.textDim} />
                  <Text style={styles.yearExport}>Export {year}</Text>
                </Pressable>
              </View>
            </View>

            {yearTrades.map((trade) => {
              const pnl = realizedPnl(trade);
              const pnlPct = realizedPnlPct(trade);
              return (
                <Pressable key={trade.id} style={styles.card} onLongPress={() => handleDelete(trade.id)}>
                  <View style={styles.cardTop}>
                    <Text style={styles.symbol}>{trade.symbol}</Text>
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: trade.status === 'open' ? `${colors.blue}26` : `${colors.textDim}1a` },
                      ]}
                    >
                      <Ionicons
                        name={trade.status === 'open' ? 'radio-button-on' : 'checkmark-circle'}
                        size={9}
                        color={trade.status === 'open' ? colors.blue : colors.textDim}
                      />
                      <Text style={[styles.statusText, { color: trade.status === 'open' ? colors.blue : colors.textDim }]}>
                        {trade.status === 'open' ? 'OPEN' : 'CLOSED'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.detail}>
                    Entry {formatPrice(trade.entryPrice)} × {trade.quantity} · {formatDate(trade.entryDate)}
                  </Text>
                  {trade.status === 'closed' && trade.exitPrice != null && (
                    <Text style={styles.detail}>
                      Exit {formatPrice(trade.exitPrice)} · {formatDate(trade.exitDate!)}
                    </Text>
                  )}
                  {pnl != null && pnlPct != null && (
                    <Text style={[styles.pnl, { color: pnl >= 0 ? colors.green : colors.red }]}>
                      {pnl >= 0 ? '+' : ''}
                      {formatPrice(pnl)} ({pnlPct >= 0 ? '+' : ''}
                      {pnlPct.toFixed(1)}%)
                    </Text>
                  )}
                  <View style={styles.deleteHintRow}>
                    <Ionicons name="trash-outline" size={9} color={colors.textDim} style={{ opacity: 0.5 }} />
                    <Text style={styles.deleteHint}>Long-press to delete</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
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
    paddingBottom: spacing.sm,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  titleIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${colors.accent}22`,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderRadius: radius.sm,
    backgroundColor: `${colors.accent}26`,
    borderWidth: 1,
    borderColor: colors.accent,
    ...cardShadow,
  },
  exportText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  yearHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  yearTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  yearHeaderRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  yearTotal: {
    fontSize: 12,
    fontWeight: '700',
  },
  yearExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  yearExport: {
    color: colors.textDim,
    fontSize: 10,
    textDecorationLine: 'underline',
  },
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
    ...cardShadow,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbol: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  detail: {
    color: colors.textDim,
    fontSize: 11,
  },
  pnl: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  deleteHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  deleteHint: {
    color: colors.textDim,
    fontSize: 9,
    opacity: 0.5,
  },
  empty: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    color: colors.textDim,
    fontSize: 12,
    textAlign: 'center',
  },
});
